<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Audit;
use App\Models\User;
use App\Services\Activity;
use App\Services\AuditRunner;
use App\Services\Credits;
use App\Services\SafeUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Port of src/app/api/audit/route.ts (GET batch progress + POST start),
 * [id]/route.ts (GET/DELETE) and [id]/share/route.ts (POST).
 * The [id]/pdf route is intentionally NOT ported (PDF download is now
 * generated client-side with @react-pdf/renderer).
 */
class AuditApiController extends Controller
{
    private const DOMAIN_RE = '/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/';
    private const IP_RE = '/^\d{1,3}(\.\d{1,3}){3}$/';
    private const NETWORKS = ['ADSENSE', 'EZOIC', 'MEDIAVINE', 'RAPTIVE'];
    private const MODES = ['NORMAL', 'STANDARD', 'PREMIUM'];

    /** Batch progress polling: GET /api/audit?batch=<batchId> */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $batchId = (string) $request->query('batch', '');
        if ($batchId === '') {
            return response()->json(['error' => 'Missing batch id.'], 400);
        }

        $audits = Audit::where('batchId', $batchId)
            ->where('userId', $user->id)
            ->orderBy('createdAt')
            ->get(['id', 'domain', 'status', 'probability', 'verdict', 'error']);

        return response()->json(['audits' => $audits]);
    }

    /** POST /api/audit - start one or a batch of audits. */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Please sign in first.'], 401);
        }
        if (! Credits::rateLimit('audit:' . Credits::clientIp($request), 10, 10 * 60_000)['ok']) {
            return response()->json(['error' => 'Too many audits started. Wait a few minutes.'], 429);
        }

        $body = $request->json()->all();
        if (! is_array($body)) {
            $body = [];
        }
        $isBatch = isset($body['domains']) && is_array($body['domains']);

        $data = $this->validateStart($body, $isBatch);
        if ($data === null) {
            return response()->json(['error' => 'Invalid audit request.'], 400);
        }

        /** @var User $user */
        $user = User::find($user->id);
        if (! $user) {
            return response()->json(['error' => 'Please sign in first.'], 401);
        }
        if ($user->status === 'SUSPENDED') {
            return response()->json(['error' => 'This account is suspended.'], 403);
        }

        $network = $data['network'];
        $mode = $data['mode'];
        $deepScan = $data['deepScan'] === true;
        $costs = Credits::getCosts();
        $auditCost = is_array($costs['audit'] ?? null) ? ($costs['audit'][strtolower($mode)] ?? 12) : 12;
        $creditsUsed = (int) $auditCost + ($deepScan ? (int) ($costs['deepScan'] ?? 6) : 0);

        // Resolve every target up front. Invalid domains are reported before any credit moves.
        $rawDomains = $isBatch ? array_values($data['domains']) : [$data['domain']];
        $seen = [];
        $valid = [];
        $invalid = [];
        foreach ($rawDomains as $raw) {
            $domain = SafeUrl::normalizeDomain((string) $raw);
            if (! preg_match(self::DOMAIN_RE, $domain) || preg_match(self::IP_RE, $domain) || isset($seen[$domain])) {
                $invalid[] = (string) $raw;
                continue;
            }
            $seen[$domain] = true;
            try {
                SafeUrl::assertPublicUrl($domain);
                $valid[] = $domain;
            } catch (\Throwable) {
                $invalid[] = (string) $raw;
            }
        }

        if ($valid === []) {
            return response()->json(
                ['error' => 'None of those domains can be audited.', 'invalid' => $invalid],
                400
            );
        }

        $totalCost = $creditsUsed * count($valid);
        if (! Credits::deduct((string) $user->id, $totalCost)) {
            return response()->json(
                [
                    'error' => sprintf(
                        'Not enough credits. %d %s %d credits.',
                        count($valid),
                        count($valid) === 1 ? 'audit needs' : 'audits need',
                        $totalCost
                    ),
                    'needCredits' => $totalCost,
                ],
                402
            );
        }

        $batchId = $isBatch && count($valid) > 1
            ? 'b' . base_convert((string) now()->getTimestampMs(), 10, 36) . $this->randomBase36(4)
            : null;

        $created = [];
        DB::transaction(function () use ($valid, $user, $network, $mode, $deepScan, $creditsUsed, $batchId, &$created) {
            foreach ($valid as $domain) {
                $created[] = Audit::create([
                    'userId' => (string) $user->id,
                    'domain' => $domain,
                    'target' => $network,
                    'mode' => $mode,
                    'deepScan' => $deepScan,
                    'status' => 'PENDING',
                    'creditsUsed' => $creditsUsed,
                    'batchId' => $batchId,
                ]);
            }
        });

        // Fire-and-forget: the deferred callbacks run right after the response
        // is sent, while the UI polls.
        foreach ($created as $audit) {
            defer(fn () => AuditRunner::run((string) $audit->id));
        }

        Activity::log([
            'action' => $isBatch && count($valid) > 1 ? 'AUDIT_BATCH_START' : 'AUDIT_START',
            'actorEmail' => (string) $user->email,
            'userId' => (string) $user->id,
            'detail' => implode(', ', $valid) . " · {$network} · " . strtolower($mode) . ($deepScan ? ' · deep' : ''),
            'ip' => Credits::clientIp($request),
        ]);

        return response()->json([
            'ok' => true,
            'id' => $created !== [] ? (string) $created[0]->id : null,
            'batchId' => $batchId,
            'audits' => array_map(fn ($a) => ['id' => (string) $a->id, 'domain' => $a->domain], $created),
            'creditsUsed' => $totalCost,
            'invalid' => $invalid,
        ]);
    }

    /** GET /api/audit/{id} */
    public function show(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $audit = Audit::find($id);
        if (! $audit || ($audit->userId !== $user->id && $user->role !== 'ADMIN')) {
            return response()->json(['error' => 'Not found'], 404);
        }

        return response()->json([
            'id' => $audit->id,
            'status' => $audit->status,
            'probability' => $audit->probability,
            'verdict' => $audit->verdict,
            'report' => $audit->report ? json_decode((string) $audit->report, true) : null,
            'error' => $audit->error,
            'domain' => $audit->domain,
            'target' => $audit->target,
            'mode' => $audit->mode,
            'createdAt' => $audit->createdAt,
        ]);
    }

    /** DELETE /api/audit/{id} */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $audit = Audit::find($id);
        if (! $audit || $audit->userId !== $user->id) {
            return response()->json(['error' => 'Not found'], 404);
        }
        $domain = (string) $audit->domain;
        $audit->delete();

        Activity::log([
            'action' => 'AUDIT_DELETE',
            'actorEmail' => (string) $user->email,
            'userId' => (string) $user->id,
            'detail' => $domain,
        ]);

        return response()->json(['ok' => true]);
    }

    /** POST /api/audit/{id}/share - create (or return) the public share token. */
    public function share(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $audit = Audit::find($id);
        if (! $audit || $audit->userId !== $user->id) {
            return response()->json(['error' => 'Not found'], 404);
        }
        if ($audit->status !== 'DONE' || ! $audit->report) {
            return response()->json(['error' => 'Only completed audits can be shared.'], 400);
        }

        $token = (string) ($audit->shareToken ?: bin2hex(random_bytes(12)));
        $audit->update(['shareToken' => $token]);

        return response()->json(['ok' => true, 'url' => "/share/{$token}"]);
    }

    /**
     * zod-parity validation for single + batch bodies. Returns the validated
     * fields or null (invalid).
     *
     * @return array{network: string, mode: string, deepScan: bool, domain?: string, domains?: array}|null
     */
    private function validateStart(array $body, bool $isBatch): ?array
    {
        $network = $body['network'] ?? null;
        $mode = $body['mode'] ?? null;
        $deepScan = $body['deepScan'] ?? false;

        if (! is_string($network) || ! in_array($network, self::NETWORKS, true)) {
            return null;
        }
        if (! is_string($mode) || ! in_array($mode, self::MODES, true)) {
            return null;
        }
        if ($deepScan === null) {
            $deepScan = false;
        }
        if (! is_bool($deepScan)) {
            return null;
        }

        if ($isBatch) {
            $domains = $body['domains'];
            if (count($domains) < 1 || count($domains) > 10) {
                return null;
            }
            foreach ($domains as $d) {
                $t = is_string($d) ? trim($d) : '';
                if (mb_strlen($t) < 4 || mb_strlen($t) > 120) {
                    return null;
                }
            }

            return ['network' => $network, 'mode' => $mode, 'deepScan' => $deepScan, 'domains' => $domains];
        }

        $domain = $body['domain'] ?? null;
        if (! is_string($domain)) {
            return null;
        }
        $domain = trim($domain);
        if (mb_strlen($domain) < 4 || mb_strlen($domain) > 120) {
            return null;
        }

        return ['network' => $network, 'mode' => $mode, 'deepScan' => $deepScan, 'domain' => $domain];
    }

    private function randomBase36(int $len): string
    {
        $alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
        $out = '';
        for ($i = 0; $i < $len; $i++) {
            $out .= $alphabet[random_int(0, 35)];
        }

        return $out;
    }

    /** DELETE /api/audit/{id}/share - revoke the public share link. */
    public function shareRevoke(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $audit = Audit::find($id);
        if (! $audit || ($audit->userId !== $user->id && $user->role !== 'ADMIN')) {
            return response()->json(['error' => 'Not found'], 404);
        }

        $audit->shareToken = null;
        $audit->save();

        \App\Services\Activity::log([
            'action' => 'AUDIT_SHARE',
            'actorEmail' => $user->email,
            'userId' => $user->id,
            'detail' => "Revoked public share link for {$audit->domain}",
        ]);

        return response()->json(['ok' => true]);
    }

    /** GET /api/audit/{id}/pdf no longer streams a PDF (client-side renderer) - returns the report payload. */
    public function pdf(Request $request, string $id): JsonResponse
    {
        return $this->show($request, $id);
    }
}
