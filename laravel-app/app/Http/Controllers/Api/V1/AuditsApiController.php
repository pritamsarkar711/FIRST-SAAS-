<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Audit;
use App\Models\User;
use App\Services\Activity;
use App\Services\ApiKeys;
use App\Services\AuditRunner;
use App\Services\Credits;
use App\Services\SafeUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Port of src/app/api/v1/audits/route.ts and v1/audits/[id]/route.ts - the
 * public developer API authenticated by an API key (ApiKeyAuth middleware,
 * alias `api.key`).
 */
class AuditsApiController extends Controller
{
    private const DOMAIN_RE = '/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/';
    private const IP_RE = '/^\d{1,3}(\.\d{1,3}){3}$/';
    private const NETWORKS = ['ADSENSE', 'EZOIC', 'MEDIAVINE', 'RAPTIVE'];
    private const MODES = ['NORMAL', 'STANDARD', 'PREMIUM'];

    /** POST /api/v1/audits - start one audit. Same engine, credits and guards as the app. */
    public function store(Request $request): JsonResponse
    {
        $keyId = (string) $request->attributes->get('apiKeyId', '');
        $keyName = (string) $request->attributes->get('apiKeyName', '');
        $actorEmail = (string) $request->attributes->get('apiKeyActorEmail', '');
        $userId = (string) $request->attributes->get('apiKeyUserId', '');

        if (! Credits::rateLimit("v1audit:{$keyId}", 30, 10 * 60_000)['ok']) {
            return ApiKeys::v1Error('Rate limit exceeded. 30 audit starts per 10 minutes per key.', 429);
        }

        $body = $request->json()->all();
        if (! is_array($body)) {
            $body = [];
        }
        $parsed = $this->validateStart($body);
        if ($parsed === null) {
            return ApiKeys::v1Error('Invalid request body. Provide { domain, network?, mode?, deep_scan? }.', 400, [
                'fields' => [
                    'domain (required)',
                    'network: ADSENSE | EZOIC | MEDIAVINE | RAPTIVE',
                    'mode: NORMAL | STANDARD | PREMIUM',
                    'deep_scan: true samples 10 articles and verifies policy pages (extra credits)',
                ],
            ]);
        }

        $user = User::find($userId);
        if (! $user) {
            return ApiKeys::v1Error('Account not found.', 401);
        }

        $domain = SafeUrl::normalizeDomain((string) $parsed['domain']);
        if (! preg_match(self::DOMAIN_RE, $domain) || preg_match(self::IP_RE, $domain)) {
            return ApiKeys::v1Error('That domain does not look valid. Example: myblog.com', 400);
        }
        try {
            SafeUrl::assertPublicUrl($domain);
        } catch (\Throwable) {
            return ApiKeys::v1Error('That domain cannot be audited from this service.', 400);
        }

        $costs = Credits::getCosts();
        $modeKey = strtolower($parsed['mode']);
        $auditCost = is_array($costs['audit'] ?? null) ? ($costs['audit'][$modeKey] ?? 12) : 12;
        $creditsUsed = (int) $auditCost + ($parsed['deepScan'] === true ? (int) ($costs['deepScan'] ?? 6) : 0);

        if (! Credits::deduct((string) $user->id, $creditsUsed)) {
            return ApiKeys::v1Error("Not enough credits. This audit costs {$creditsUsed} credits.", 402, [
                'credits_needed' => $creditsUsed,
                'top_up' => '/dashboard/billing',
            ]);
        }

        $audit = Audit::create([
            'userId' => (string) $user->id,
            'domain' => $domain,
            'target' => $parsed['network'],
            'mode' => $parsed['mode'],
            'deepScan' => $parsed['deepScan'] === true,
            'status' => 'PENDING',
            'creditsUsed' => $creditsUsed,
        ]);

        defer(fn () => AuditRunner::run((string) $audit->id));

        Activity::log([
            'action' => 'API_AUDIT_START',
            'actorEmail' => $actorEmail !== '' ? $actorEmail : (string) $user->email,
            'userId' => (string) $user->id,
            'detail' => "{$domain} · {$parsed['network']} · " . strtolower($parsed['mode']) . ($parsed['deepScan'] === true ? ' · deep' : '') . " · key {$keyName}",
            'ip' => Credits::clientIp($request),
        ]);

        return ApiKeys::v1Json([
            'ok' => true,
            'audit' => self::publicAudit($audit),
            'poll' => "/api/v1/audits/{$audit->id}",
            'next_check_hint' => 'Poll every 5 seconds until status is done or failed. A full check usually takes 1 to 3 minutes.',
        ], 202);
    }

    /** GET /api/v1/audits/{id} - poll status; the full report JSON is included once DONE. */
    public function show(Request $request, string $id): JsonResponse
    {
        $userId = (string) $request->attributes->get('apiKeyUserId', '');

        if ($id === '' || strlen($id) > 64) {
            return ApiKeys::v1Error('Invalid audit id.', 400);
        }

        $audit = Audit::where('id', $id)->where('userId', $userId)->first();
        if (! $audit) {
            return ApiKeys::v1Error('Audit not found (or it belongs to another key owner).', 404);
        }

        $base = [
            'ok' => true,
            'audit' => self::publicAudit($audit),
        ];

        if ($audit->status !== 'DONE' || ! $audit->report) {
            return ApiKeys::v1Json($base);
        }

        $report = [];
        $signals = null;
        try {
            $decoded = json_decode((string) $audit->report, true);
            if (is_array($decoded)) {
                $report = $decoded;
            }
        } catch (\Throwable) {
            // keep empty
        }
        if ($audit->signals) {
            try {
                $signals = json_decode((string) $audit->signals, true);
            } catch (\Throwable) {
                // ignore
            }
        }

        return ApiKeys::v1Json(array_merge($base, [
            'report' => $report,
            'crawl_signals' => $signals,
            // session-authenticated page in the original; PDF is now generated
            // client-side, the key is kept for response-shape parity
            'pdf_url' => "/api/audit/{$audit->id}/pdf",
            'share_hint' => 'Share links can be created from the dashboard report page.',
        ]));
    }

    /**
     * Same shape as publicAudit() in the original.
     *
     * @return array<string, mixed>
     */
    private static function publicAudit(Audit $a): array
    {
        return [
            'id' => $a->id,
            'domain' => $a->domain,
            'network' => $a->target,
            'mode' => strtolower((string) $a->mode),
            'deep_scan' => (bool) $a->deepScan,
            'status' => strtolower((string) $a->status), // pending | running | done | failed
            'probability' => $a->status === 'DONE' ? $a->probability : null,
            'verdict' => $a->verdict,
            'error' => $a->error,
            'credits_used' => (int) $a->creditsUsed,
            'created_at' => $a->createdAt?->toISOString(),
            'updated_at' => $a->updatedAt?->toISOString(),
        ];
    }

    /**
     * zod-parity validation with defaults (network ADSENSE, mode STANDARD,
     * deep_scan false). Returns null when invalid.
     *
     * @return array{domain: string, network: string, mode: string, deepScan: bool}|null
     */
    private function validateStart(array $b): ?array
    {
        $domain = isset($b['domain']) && is_string($b['domain']) ? trim($b['domain']) : '';
        if ($domain === '' || mb_strlen($domain) < 4 || mb_strlen($domain) > 120) {
            return null;
        }

        $network = $b['network'] ?? 'ADSENSE';
        if (! is_string($network) || ! in_array($network, self::NETWORKS, true)) {
            return null;
        }

        $mode = $b['mode'] ?? 'STANDARD';
        if (! is_string($mode) || ! in_array($mode, self::MODES, true)) {
            return null;
        }

        $deepScan = $b['deep_scan'] ?? false;
        if ($deepScan === null) {
            $deepScan = false;
        }
        if (! is_bool($deepScan)) {
            return null;
        }

        return ['domain' => $domain, 'network' => $network, 'mode' => $mode, 'deepScan' => $deepScan];
    }
}
