<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\IndexRequest;
use App\Models\User;
use App\Services\Activity;
use App\Services\Credits;
use App\Services\SafeUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

/**
 * Port of src/app/api/indexer/route.ts (POST submit to IndexNow, GET history).
 */
class IndexerApiController extends Controller
{
    private const ENGINES = ['https://api.indexnow.org/indexnow'];

    /** Per-user verification key file name (port of userKey()). */
    private function userKey(string $userId): string
    {
        $secret = (string) (config('app.key') ?: 'adaudit');

        return substr(hash('sha256', "{$userId}:{$secret}"), 0, 32);
    }

    /** POST /api/indexer */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Please sign in first.'], 401);
        }
        if (! Credits::rateLimit('indexer:' . Credits::clientIp($request), 8, 10 * 60_000)['ok']) {
            return response()->json(['error' => 'Too many submissions. Wait a few minutes.'], 429);
        }

        $body = $request->json()->all();
        $domain = isset($body['domain']) && is_string($body['domain']) ? trim($body['domain']) : '';
        $urls = $body['urls'] ?? null;

        if ($domain === '' || mb_strlen($domain) < 4 || mb_strlen($domain) > 120
            || ! is_array($urls) || count($urls) < 1 || count($urls) > 20) {
            return response()->json(['error' => 'Provide your domain and 1 to 20 URLs.'], 400);
        }
        foreach ($urls as $u) {
            if (! is_string($u) || mb_strlen(trim($u)) > 2000 || ! filter_var(trim($u), FILTER_VALIDATE_URL)) {
                return response()->json(['error' => 'Provide your domain and 1 to 20 URLs.'], 400);
            }
        }
        $urls = array_map(fn ($u) => trim((string) $u), $urls);

        /** @var User $user */
        $user = User::find($user->id);
        if (! $user) {
            return response()->json(['error' => 'Please sign in first.'], 401);
        }

        $domain = SafeUrl::normalizeDomain($domain);
        // All URLs must belong to the domain
        foreach ($urls as $u) {
            if (SafeUrl::normalizeDomain($u) !== $domain) {
                return response()->json(['error' => 'Every URL must be on the same domain.'], 400);
            }
        }
        try {
            SafeUrl::assertPublicUrl($domain);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e instanceof \Exception || $e instanceof \Error ? $e->getMessage() : 'Invalid domain'], 400);
        }

        $costs = Credits::getCosts();
        $creditsUsed = (int) ($costs['index'] ?? 2);
        if (! Credits::deduct((string) $user->id, $creditsUsed)) {
            return response()->json(
                ['error' => "Not enough credits. A batch costs {$creditsUsed}.", 'needCredits' => $creditsUsed],
                402
            );
        }

        $key = $this->userKey((string) $user->id);
        $keyFileUrl = "https://{$domain}/{$key}.txt";

        // Verify the key file is live at the user's site
        $verified = false;
        try {
            $res = Http::withHeaders(['User-Agent' => 'Audit FormBot/1.0'])
                ->timeout(10)
                ->get($keyFileUrl);
            if ($res->ok()) {
                $verified = trim($res->body()) === $key;
            }
        } catch (\Throwable) {
            // not verified
        }

        if (! $verified) {
            // refund: nothing was submitted
            Credits::add((string) $user->id, $creditsUsed);
            $reqRow = IndexRequest::create([
                'userId' => (string) $user->id,
                'urls' => json_encode($urls, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: '[]',
                'keyFileUrl' => $keyFileUrl,
                'status' => 'PENDING',
                'creditsUsed' => 0,
            ]);

            return response()->json([
                'ok' => false,
                'key' => $key,
                'keyFileUrl' => $keyFileUrl,
                'requestId' => $reqRow->id,
                'error' => "The key file was not found at {$keyFileUrl} or does not match. Upload a file named {$key}.txt containing exactly: {$key} — then submit again. Credits were not charged.",
            ]);
        }

        $submitted = 0;
        $errors = [];
        foreach (self::ENGINES as $endpoint) {
            try {
                $res = Http::withHeaders([
                    'Content-Type' => 'application/json; charset=utf-8',
                    'Host' => 'api.indexnow.org',
                ])
                    ->timeout(20)
                    ->post($endpoint, [
                        'host' => $domain,
                        'key' => $key,
                        'keyLocation' => $keyFileUrl,
                        'urlList' => $urls,
                    ]);
                if ($res->ok() || $res->status() === 202) {
                    $submitted = count($urls);
                } else {
                    $errors[] = 'IndexNow responded ' . $res->status();
                }
            } catch (\Throwable $e) {
                $errors[] = mb_substr($e->getMessage(), 0, 120) ?: 'Submission failed';
            }
        }

        $row = IndexRequest::create([
            'userId' => (string) $user->id,
            'urls' => json_encode($urls, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: '[]',
            'keyFileUrl' => $keyFileUrl,
            'status' => $submitted > 0 ? ($errors !== [] ? 'PARTIAL' : 'SUBMITTED') : 'FAILED',
            'result' => json_encode(['submitted' => $submitted, 'errors' => $errors], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: '{}',
            'creditsUsed' => $creditsUsed,
        ]);

        if ($submitted === 0) {
            return response()->json([
                'ok' => false,
                'key' => $key,
                'keyFileUrl' => $keyFileUrl,
                'requestId' => $row->id,
                'error' => implode('; ', $errors) ?: 'Submission failed.',
            ]);
        }

        Activity::log([
            'action' => 'INDEXER_SUBMIT',
            'actorEmail' => (string) $user->email,
            'userId' => (string) $user->id,
            'detail' => "{$submitted} URLs on {$domain}",
            'ip' => Credits::clientIp($request),
        ]);

        return response()->json([
            'ok' => true,
            'key' => $key,
            'keyFileUrl' => $keyFileUrl,
            'requestId' => $row->id,
            'submitted' => $submitted,
        ]);
    }

    /** GET /api/indexer */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $history = IndexRequest::where('userId', $user->id)
            ->orderByDesc('createdAt')
            ->take(10)
            ->get(['id', 'urls', 'status', 'result', 'createdAt']);

        return response()->json([
            'key' => $this->userKey((string) $user->id),
            'history' => $history->map(fn ($h) => [
                'id' => $h->id,
                'urls' => json_decode((string) $h->urls, true) ?: [],
                'status' => $h->status,
                'result' => $h->result ? json_decode((string) $h->result, true) : null,
                'createdAt' => $h->createdAt,
            ]),
        ]);
    }
}
