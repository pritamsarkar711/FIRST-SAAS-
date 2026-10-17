<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContentJob;
use App\Models\User;
use App\Services\Activity;
use App\Services\Credits;
use App\Services\SafeUrl;
use App\Services\WriterRunner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

/**
 * Port of src/app/api/writer/route.ts (POST start), [id]/route.ts (GET/DELETE)
 * and [id]/publish-wp/route.ts (POST publish to WordPress).
 *
 * `index()` has no Next.js counterpart (the writer history came from the page's
 * server component); it returns the same recent-jobs list so the route contract
 * method exists.
 */
class WriterApiController extends Controller
{
    /** GET /api/writer - recent jobs (same list the writer dashboard page gets). */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $jobs = ContentJob::where('userId', $user->id)
            ->orderByDesc('createdAt')
            ->take(12)
            ->get(['id', 'type', 'keyword', 'status', 'createdAt']);

        return response()->json(['jobs' => $jobs]);
    }

    /** POST /api/writer */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Please sign in first.'], 401);
        }
        if (! Credits::rateLimit('writer:' . Credits::clientIp($request), 6, 10 * 60_000)['ok']) {
            return response()->json(['error' => 'Too many generations started. Wait a few minutes.'], 429);
        }

        $body = $request->json()->all();
        $d = $this->validate($body);
        if ($d === null) {
            return response()->json(['error' => $this->firstIssue($body) ?? 'Invalid input.'], 400);
        }

        /** @var User $user */
        $user = User::find($user->id);
        if (! $user) {
            return response()->json(['error' => 'Please sign in first.'], 401);
        }
        if ($user->status === 'SUSPENDED') {
            return response()->json(['error' => 'This account is suspended.'], 403);
        }

        $costs = Credits::getCosts();
        $writerCosts = is_array($costs['writer'] ?? null) ? $costs['writer'] : [];
        $creditsUsed = (int) ($writerCosts[strtolower($d['mode'])] ?? 15);

        if (! Credits::deduct((string) $user->id, $creditsUsed)) {
            return response()->json(
                ['error' => "Not enough credits. This article needs {$creditsUsed} credits.", 'needCredits' => $creditsUsed],
                402
            );
        }

        $job = ContentJob::create([
            'userId' => (string) $user->id,
            'type' => $d['type'],
            'mode' => $d['mode'],
            'keyword' => $d['keyword'],
            'creditsUsed' => $creditsUsed,
            'input' => json_encode([ // JSON STRING - the runner JSON.parses it
                'keyword' => $d['keyword'],
                'mode' => $d['mode'],
                'words' => $d['words'],
                'imageStyle' => $d['imageStyle'],
                'internalLinks' => WriterRunner::parseLinks($d['internalLinksRaw']),
                'affiliateLinks' => array_map(
                    fn ($l) => ['label' => $l['anchor'] ?: 'product', 'url' => $l['url']],
                    WriterRunner::parseLinks($d['affiliateLinksRaw'])
                ),
                'siteName' => $d['siteName'],
                'audience' => $d['audience'],
                'notes' => $d['notes'],
            ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: '{}',
            'status' => 'PENDING',
        ]);

        defer(fn () => WriterRunner::run((string) $job->id));

        Activity::log([
            'action' => 'WRITER_START',
            'actorEmail' => (string) $user->email,
            'userId' => (string) $user->id,
            'detail' => strtolower($d['type']) . ' article · "' . $d['keyword'] . '" · ' . strtolower($d['mode']) . ' · ' . $d['words'] . ' words',
            'ip' => Credits::clientIp($request),
        ]);

        return response()->json(['ok' => true, 'id' => $job->id, 'creditsUsed' => $creditsUsed]);
    }

    /** GET /api/writer/{id} */
    public function show(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $job = ContentJob::find($id);
        if (! $job || ($job->userId !== $user->id && $user->role !== 'ADMIN')) {
            return response()->json(['error' => 'Not found'], 404);
        }

        return response()->json([
            'id' => $job->id,
            'type' => $job->type,
            'mode' => $job->mode,
            'keyword' => $job->keyword,
            'status' => $job->status,
            'result' => $job->result ? json_decode((string) $job->result, true) : null,
            'images' => $job->images ? json_decode((string) $job->images, true) : [],
            'error' => $job->error,
            'createdAt' => $job->createdAt,
        ]);
    }

    /** DELETE /api/writer/{id} - same contract as [id]/route.ts DELETE. */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }
        $job = ContentJob::find($id);
        if (! $job || $job->userId !== $user->id) {
            return response()->json(['error' => 'Not found'], 404);
        }
        $job->delete();

        return response()->json(['ok' => true]);
    }

    /** POST /api/writer/{id}/publish-wp */
    public function publishWp(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $job = ContentJob::find($id);
        if (! $job || $job->userId !== $user->id || ! $job->result) {
            return response()->json(['error' => 'Article not found'], 404);
        }

        $body = $request->json()->all();
        $siteUrl = isset($body['siteUrl']) && is_string($body['siteUrl']) ? trim($body['siteUrl']) : '';
        $username = isset($body['username']) && is_string($body['username']) ? trim($body['username']) : '';
        $appPassword = isset($body['appPassword']) && is_string($body['appPassword']) ? trim($body['appPassword']) : '';
        $status = $body['status'] ?? 'draft';
        $status = $status === '' ? 'draft' : $status;

        if ($siteUrl === '' || mb_strlen($siteUrl) > 200 || ! filter_var($siteUrl, FILTER_VALIDATE_URL)
            || $username === '' || mb_strlen($username) > 80
            || mb_strlen($appPassword) < 6 || mb_strlen($appPassword) > 120
            || ! in_array($status, ['draft', 'publish'], true)) {
            return response()->json(['error' => 'Fill in your site URL, username and application password.'], 400);
        }

        // SSRF guard on user-supplied WP site
        try {
            SafeUrl::assertPublicUrl($siteUrl);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e instanceof \Exception || $e instanceof \Error ? $e->getMessage() : 'Invalid site URL'], 400);
        }

        $result = json_decode((string) $job->result, true) ?: [];
        $images = $job->images ? (json_decode((string) $job->images, true) ?: []) : [];
        $auth = base64_encode($username . ':' . $appPassword);
        $origin = $request->getSchemeAndHttpHost();
        $siteBase = rtrim($siteUrl, '/');

        try {
            // Upload images to the WP media library first, then swap URLs
            $html = (string) ($result['contentHtml'] ?? '');
            foreach ($images as $img) {
                $img = is_array($img) ? $img : [];
                $file = (string) ($img['file'] ?? '');
                if ($file === '') {
                    continue;
                }
                try {
                    $local = $origin . $file;
                    $binRes = Http::timeout(20)->get($local);
                    if (! $binRes->ok() || $binRes->body() === '') {
                        continue;
                    }
                    $bin = $binRes->body();
                    $fileName = basename($file) ?: 'image.png';
                    $res = Http::withHeaders(['Authorization' => 'Basic ' . $auth])
                        ->timeout(60)
                        ->attach('file', $bin, $fileName)
                        ->post($siteBase . '/wp-json/wp/v2/media');
                    if ($res->ok()) {
                        $remote = $res->json()['source_url'] ?? null;
                        if ($remote) {
                            $quoted = preg_quote($file, '/');
                            $html = preg_replace('/' . $quoted . '/', $remote, $html) ?? $html;
                        }
                    }
                } catch (\Throwable) {
                    // keep local URL if upload fails
                }
            }

            $create = Http::withHeaders([
                'Authorization' => 'Basic ' . $auth,
                'Accept' => 'application/json',
            ])
                ->asJson()
                ->timeout(30)
                ->post($siteBase . '/wp-json/wp/v2/posts', [
                    'title' => $result['title'] ?? '',
                    'content' => $html,
                    'excerpt' => $result['excerpt'] ?? '',
                    'slug' => $result['slug'] ?? '',
                    'status' => $status,
                ]);

            $data = $create->json() ?: [];
            if (! $create->ok()) {
                $msg = $data['message'] ?? ('WordPress responded with ' . $create->status() . '. Check the application password and that the REST API is enabled.');

                return response()->json(['error' => mb_substr((string) $msg, 0, 300)], 400);
            }

            return response()->json(['ok' => true, 'link' => $data['link'] ?? null, 'id' => $data['id'] ?? null]);
        } catch (\Throwable $e) {
            return response()->json(['error' => mb_substr($e->getMessage(), 0, 300) ?: 'Could not reach your WordPress site.'], 400);
        }
    }

    /** zod-parity validation for the writer start body. */
    private function validate(array $b): ?array
    {
        $type = $b['type'] ?? null;
        $keyword = isset($b['keyword']) && is_string($b['keyword']) ? trim($b['keyword']) : '';
        $mode = $b['mode'] ?? null;
        $words = $b['words'] ?? null;
        $imageStyle = $b['imageStyle'] ?? null;
        $internalLinksRaw = $b['internalLinksRaw'] ?? '';
        $affiliateLinksRaw = $b['affiliateLinksRaw'] ?? '';
        $siteName = $b['siteName'] ?? '';
        $audience = $b['audience'] ?? '';
        $notes = $b['notes'] ?? '';

        if (! is_string($type) || ! in_array($type, ['ADSENSE', 'AFFILIATE'], true)) {
            return null;
        }
        if (mb_strlen($keyword) < 3 || mb_strlen($keyword) > 120) {
            return null;
        }
        if (! is_string($mode) || ! in_array($mode, ['STANDARD', 'PREMIUM'], true)) {
            return null;
        }
        if (! self::validWordCount($words)) {
            return null;
        }
        if (! is_string($imageStyle) || ! in_array($imageStyle, ['vector', 'photo', 'brutalist', 'diagram'], true)) {
            return null;
        }
        foreach ([$internalLinksRaw, $affiliateLinksRaw, $siteName, $audience, $notes] as $i => $v) {
            if (! is_string($v)) {
                return null;
            }
        }
        if (mb_strlen((string) $internalLinksRaw) > 2000 || mb_strlen((string) $affiliateLinksRaw) > 2000
            || mb_strlen((string) $siteName) > 120 || mb_strlen((string) $audience) > 200
            || mb_strlen((string) $notes) > 600) {
            return null;
        }

        return [
            'type' => $type,
            'keyword' => $keyword,
            'mode' => $mode,
            'words' => $words,
            'imageStyle' => $imageStyle,
            'internalLinksRaw' => $internalLinksRaw,
            'affiliateLinksRaw' => $affiliateLinksRaw,
            'siteName' => $siteName,
            'audience' => $audience,
            'notes' => $notes,
        ];
    }

    /** Approximation of zod's issues[0].message for the common fields. */
    private function firstIssue(array $b): ?string
    {
        $type = $b['type'] ?? null;
        if (! is_string($type) || ! in_array($type, ['ADSENSE', 'AFFILIATE'], true)) {
            return 'Invalid type.';
        }
        $keyword = isset($b['keyword']) && is_string($b['keyword']) ? trim($b['keyword']) : '';
        if (mb_strlen($keyword) < 3 || mb_strlen($keyword) > 120) {
            return 'Keyword must be between 3 and 120 characters.';
        }
        $mode = $b['mode'] ?? null;
        if (! is_string($mode) || ! in_array($mode, ['STANDARD', 'PREMIUM'], true)) {
            return 'Invalid mode.';
        }
        $words = $b['words'] ?? null;
        if (! self::validWordCount($words)) {
            return 'Words must be an integer between 800 and 4000.';
        }
        $imageStyle = $b['imageStyle'] ?? null;
        if (! is_string($imageStyle) || ! in_array($imageStyle, ['vector', 'photo', 'brutalist', 'diagram'], true)) {
            return 'Invalid image style.';
        }

        return null;
    }

    /** zod z.number().int() parity: integral numbers only, 800..4000. */
    private static function validWordCount(mixed $words): bool
    {
        if (is_int($words)) {
            return $words >= 800 && $words <= 4000;
        }
        if (is_float($words) && floor($words) === $words) {
            return $words >= 800 && $words <= 4000;
        }

        return false;
    }
}
