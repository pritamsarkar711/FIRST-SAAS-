<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Activity;
use App\Services\MailConfig;
use App\Services\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Port of src/app/api/admin/digest/route.ts.
 *
 * The original endpoint was POST { action: "send" } and triggered the forced
 * weekly monitoring digest run (maybeSendDigests({ force: true })). The
 * routes/web.php contract exposes it as GET /api/admin/digest -> index, so:
 *  - a call with action=send (JSON body or ?action=send query) runs the
 *    forced digest exactly like the original and returns {ok, sent, skipped};
 *  - a plain GET returns the digest status data instead (no side effects).
 *
 * Note: the unchanged settings-manager client still POSTs {action:"send"} -
 * web.php only maps GET here, so the button needs a POST route to light up
 * (flagged in the worklog). The mail goes out through MailConfig::send,
 * which sends plain text; the original's HTML variant is intentionally not
 * duplicated for that reason.
 */
class DigestController extends Controller
{
    private const DIGEST_DEFAULTS = ['enabled' => false, 'lastSentAt' => ''];

    /** Same map as NETWORK_NAMES in src/lib/audit-runner.ts. */
    private const NETWORK_NAMES = [
        'ADSENSE' => 'Google AdSense',
        'EZOIC' => 'Ezoic',
        'MEDIAVINE' => 'Mediavine',
        'RAPTIVE' => 'Raptive',
    ];

    public function index(Request $request): JsonResponse
    {
        $action = (string) ($request->json('action') ?? $request->query('action') ?? '');
        if ($action !== 'send') {
            // Plain data read: current digest configuration status.
            $digest = Settings::get('monitorDigest', self::DIGEST_DEFAULTS);

            return response()->json([
                'ok' => true,
                'enabled' => (bool) ($digest['enabled'] ?? false),
                'lastSentAt' => (string) ($digest['lastSentAt'] ?? ''),
                'sent' => 0,
                'skipped' => '',
            ]);
        }

        /** @var User $admin */
        $admin = $request->user();

        $result = $this->maybeSendDigests(['force' => true]);

        Activity::log([
            'action' => $result['sent'] > 0 ? 'DIGEST_SENT' : 'DIGEST_SKIP',
            'actorEmail' => $admin->email,
            'detail' => $result['sent'] > 0
                ? "Manual digest run sent {$result['sent']} email(s)"
                : "Manual digest run skipped: {$result['skipped']}",
        ]);

        return response()->json([
            'ok' => true,
            'sent' => $result['sent'],
            'skipped' => $result['skipped'],
        ]);
    }

    /**
     * Port of maybeSendDigests() from src/lib/monitor-digest.ts (force path).
     * Weekly digest of monitoring results, sent per user when SMTP is
     * configured; force=true (admin "send now") bypasses the 7-day cadence
     * but still requires the digest to be enabled and SMTP configured.
     *
     * @param array{force?: bool} $opts
     * @return array{sent: int, skipped: string, enabled: bool}
     */
    private function maybeSendDigests(array $opts = []): array
    {
        $force = (bool) ($opts['force'] ?? false);

        /** @var array $cfg */
        $cfg = Settings::get('monitorDigest', self::DIGEST_DEFAULTS);
        if (empty($cfg['enabled'])) {
            return ['sent' => 0, 'skipped' => 'Digest is disabled in admin settings.', 'enabled' => false];
        }

        if (! $force) {
            $last = ! empty($cfg['lastSentAt']) ? strtotime((string) $cfg['lastSentAt']) : 0;
            if ((time() - $last) < 7 * 24 * 3600) {
                return ['sent' => 0, 'skipped' => 'Next digest is not due yet.', 'enabled' => true];
            }
        }

        $smtp = Settings::smtp();
        if (($smtp['host'] ?? '') === '' || ($smtp['user'] ?? '') === '' || ($smtp['pass'] ?? '') === '') {
            return ['sent' => 0, 'skipped' => 'SMTP is not configured, so no email could be sent.', 'enabled' => true];
        }

        $site = Settings::get('site', ['name' => 'Audit Form']);
        $siteName = (string) ($site['name'] ?? 'Audit Form') ?: 'Audit Form';

        // One digest per user who has monitoring items; include paused rows so
        // the owner learns why a monitor stopped checking.
        $users = User::whereHas('watchItems')
            ->where('status', 'ACTIVE')
            ->with(['watchItems' => function ($q) {
                $q->orderBy('createdAt');
            }])
            ->get(['id', 'email', 'name']);

        $sent = 0;
        foreach ($users as $user) {
            $rows = $user->watchItems->map(fn ($w) => [
                'domain' => $w->domain,
                'target' => $w->target,
                'deepScan' => (bool) $w->deepScan,
                'intervalDays' => (int) $w->intervalDays,
                'active' => (bool) $w->active,
                'lastScore' => $w->lastScore === null ? null : (int) $w->lastScore,
                'nextRunAt' => $w->nextRunAt,
                'runs' => (int) $w->runs,
                'pausedReason' => $w->pausedReason,
            ])->all();
            if ($rows === []) {
                continue;
            }

            $count = count($rows);
            $subject = $siteName . ' weekly monitoring digest (' . $count . ' domain' . ($count === 1 ? '' : 's') . ')';
            try {
                if (MailConfig::send($user->email, $subject, $this->buildText($rows, $siteName))) {
                    $sent += 1;
                }
            } catch (\Throwable) {
                // Per-user failure is non-fatal; the rest still get theirs.
            }
        }

        $cfg['lastSentAt'] = now()->toIso8601String();
        Settings::set('monitorDigest', $cfg);

        return [
            'sent' => $sent,
            'skipped' => $sent === 0 ? 'No digest recipients had monitors to report.' : '',
            'enabled' => true,
        ];
    }

    private function networkName(string $code): string
    {
        return self::NETWORK_NAMES[$code] ?? $code;
    }

    private function scoreWord(?int $score): string
    {
        if ($score === null) {
            return 'no check yet';
        }
        if ($score >= 70) {
            return $score . '% (apply-ready)';
        }
        if ($score >= 45) {
            return $score . '% (needs work)';
        }

        return $score . '% (high risk)';
    }

    private function fmtIn(int $ms): string
    {
        $days = (int) ceil($ms / 86400000);
        if ($days <= 0) {
            return 'today';
        }
        if ($days === 1) {
            return 'tomorrow';
        }

        return 'in ' . $days . ' days';
    }

    /** Plain-text variant of buildText() in src/lib/monitor-digest.ts. */
    private function buildText(array $rows, string $siteName): string
    {
        $lines = [$siteName . ' monitoring digest', ''];
        foreach ($rows as $r) {
            $ms = ($r['nextRunAt']?->getTimestamp() ?? time()) - time();
            $state = $r['active'] ? 'next check ' . $this->fmtIn($ms) : 'paused';
            $note = $r['pausedReason'] ? ' [' . $r['pausedReason'] . ']' : '';
            $deep = $r['deepScan'] ? ' · deep scan' : '';
            $lines[] = '- ' . $r['domain'] . ' (' . $this->networkName($r['target']) . ', every ' . $r['intervalDays']
                . ' days, ' . $state . $deep . '): ' . $this->scoreWord($r['lastScore']) . $note;
        }
        $lines[] = '';
        $lines[] = 'Run a check any time from your dashboard.';

        return implode("\n", $lines);
    }
}
