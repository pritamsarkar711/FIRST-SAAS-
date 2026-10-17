<?php

namespace App\Services;

use App\Models\Audit;
use App\Models\WatchItem;

/**
 * Port of src/lib/audit-runner.ts - the audit pipeline for one Audit row.
 * Designed to run in the background (deferred after the HTTP response, or
 * from the queue/CLI).
 */
class AuditRunner
{
    private const NETWORK_NAMES = [
        'ADSENSE' => 'Google AdSense',
        'EZOIC' => 'Ezoic',
        'MEDIAVINE' => 'Mediavine',
        'RAPTIVE' => 'Raptive',
    ];

    private const MODE_HINTS = [
        'NORMAL' => 'Mode: NORMAL. Be efficient: 3 items per section, keep details to 1-2 sentences each.',
        'STANDARD' => 'Mode: STANDARD. Use 4-5 items per section with specific, evidence-based details.',
        'PREMIUM' => 'Mode: PREMIUM. Maximum thoroughness: 5-6 items per section, scrutinize every signal in the crawl data, cross-reference sections, and surface subtle risks most reviewers would miss.',
    ];

    private const DEEP_HINT = 'This was a DEEP SCAN: the crawler sampled up to 10 articles, traversed the full sitemap index, verified the About/Contact/Privacy/Terms pages with real HTTP fetches (navPageChecks), probed one category page (categoryCheck), and measured content freshness (contentFreshness) plus the share of thin articles (thinArticleRatio). Weigh this verified evidence in your verdict and cite it in the findings.';

    public static function networkName(string $code): string
    {
        return self::NETWORK_NAMES[$code] ?? $code;
    }

    /** Runs the full audit pipeline for an Audit row. Never throws into callers. */
    public static function run(string $auditId): void
    {
        /** @var Audit|null $audit */
        $audit = Audit::find($auditId);
        if (! $audit || $audit->status !== 'PENDING') {
            return;
        }

        try {
            $audit->update(['status' => 'RUNNING']);

            $signals = Crawler::crawlSite($audit->domain, (bool) $audit->deepScan);
            $audit->update(['signals' => json_encode($signals)]);

            $prompts = Settings::get('prompts', Prompts::defaults());
            $master = (string) ($prompts['audit'] ?? '') ?: Prompts::AUDIT_DEFAULT;

            $system = $master
                . "\n\n" . (self::MODE_HINTS[$audit->mode] ?? self::MODE_HINTS['STANDARD'])
                . ($audit->deepScan ? "\n\n" . self::DEEP_HINT : '')
                . "\n\nTarget ad network: " . self::networkName((string) $audit->target);

            $user = "Website URL: {$audit->domain}\n"
                . "Crawl results (real data, JSON):\n"
                . json_encode($signals, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
                . "\n\nProduce the JSON verdict for " . self::networkName((string) $audit->target) . ' approval readiness of this site.';

            $res = Ai::json([
                'system' => $system,
                'user' => $user,
                'mode' => $audit->mode === 'PREMIUM' ? 'premium' : ($audit->mode === 'NORMAL' ? 'normal' : 'standard'),
                'maxTokens' => $audit->mode === 'PREMIUM' ? 12000 : 8000,
                'temperature' => 0.3,
            ]);
            $data = is_array($res['data']) ? $res['data'] : [];

            // Normalize + validate minimally (identical rules to audit-runner.ts)
            $sections = [];
            foreach (array_slice(is_array($data['sections'] ?? null) ? array_values($data['sections']) : [], 0, 8) as $i => $s) {
                $s = is_array($s) ? $s : [];
                $score = self::clampInt($s['score'] ?? null, 0, 100);
                $status = in_array($s['status'] ?? null, ['ok', 'warn', 'risk'], true)
                    ? $s['status']
                    : ($score >= 70 ? 'ok' : ($score >= 45 ? 'warn' : 'risk'));
                $items = [];
                foreach (array_slice(is_array($s['items'] ?? null) ? array_values($s['items']) : [], 0, 8) as $it) {
                    $it = is_array($it) ? $it : [];
                    $items[] = [
                        'label' => mb_substr((string) ($it['label'] ?? ''), 0, 200),
                        'status' => in_array($it['status'] ?? null, ['ok', 'warn', 'risk'], true) ? $it['status'] : 'warn',
                        'detail' => mb_substr((string) ($it['detail'] ?? ''), 0, 900),
                    ];
                }
                $sections[] = [
                    'key' => (string) ($s['key'] ?? '') ?: "section{$i}",
                    'title' => (string) ($s['title'] ?? '') ?: 'Section ' . ($i + 1),
                    'score' => $score,
                    'status' => $status,
                    'items' => $items,
                ];
            }

            $roadmap = [];
            foreach (array_slice(is_array($data['roadmap'] ?? null) ? array_values($data['roadmap']) : [], 0, 12) as $i => $r) {
                $r = is_array($r) ? $r : [];
                $roadmap[] = [
                    'step' => (int) ($r['step'] ?? 0) ?: ($i + 1),
                    'title' => mb_substr((string) ($r['title'] ?? ''), 0, 200),
                    'detail' => mb_substr((string) ($r['detail'] ?? ''), 0, 900),
                ];
            }

            $report = [
                'probability' => self::clampInt($data['probability'] ?? null, 0, 100),
                'verdict' => in_array($data['verdict'] ?? null, ['APPLY_NOW', 'WAIT_AND_IMPROVE', 'HIGH_RISK_OF_REJECTION'], true)
                    ? $data['verdict']
                    : 'WAIT_AND_IMPROVE',
                'summary' => mb_substr((string) ($data['summary'] ?? ''), 0, 1200),
                'sections' => $sections,
                'strengths' => self::arr($data['strengths'] ?? null),
                'risks' => self::arr($data['risks'] ?? null),
                'criticalFixes' => self::arr($data['criticalFixes'] ?? null),
                'roadmap' => $roadmap,
            ];

            $reportJson = json_encode($report, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            if ($reportJson === false) {
                $reportJson = json_encode($report);
            }

            $audit->update([
                'status' => 'DONE',
                'report' => $reportJson, // JSON STRING - the client JSON.parses it
                'probability' => $report['probability'],
                'verdict' => $report['verdict'],
            ]);

            if ($audit->watchItemId) {
                try {
                    WatchItem::whereKey($audit->watchItemId)->update([
                        'lastAuditId' => $auditId,
                        'lastScore' => $report['probability'],
                    ]);
                } catch (\Throwable) {
                    // non-fatal, like the original .catch(() => {})
                }
                $score = $report['probability'];
                $phrase = $report['verdict'] === 'APPLY_NOW' ? 'apply now' : ($report['verdict'] === 'WAIT_AND_IMPROVE' ? 'wait and improve' : 'high risk');
                Notify::send(
                    (string) $audit->userId,
                    'AUDIT',
                    "Scheduled check ready: {$audit->domain}",
                    "Your monitored check finished with {$score}% approval probability ({$phrase}). The next automatic check follows the schedule.",
                    "/dashboard/audit/{$auditId}"
                );
            } else {
                $phrase = $report['verdict'] === 'APPLY_NOW' ? 'Apply now' : ($report['verdict'] === 'WAIT_AND_IMPROVE' ? 'Wait and improve' : 'High risk of rejection');
                Notify::send(
                    (string) $audit->userId,
                    'AUDIT',
                    "Audit ready: {$audit->domain}",
                    self::networkName((string) $audit->target) . " verdict: {$phrase} — {$report['probability']}% approval probability.",
                    "/dashboard/audit/{$auditId}"
                );
            }
        } catch (\Throwable $e) {
            $message = $e instanceof \Error || $e instanceof \Exception
                ? $e->getMessage()
                : 'The audit engine hit an unexpected error. Credits were refunded.';
            if ($message === '') {
                $message = 'The audit engine hit an unexpected error. Credits were refunded.';
            }

            // refund credits on failure
            try {
                Credits::add((string) $audit->userId, (int) $audit->creditsUsed);
            } catch (\Throwable) {
            }

            try {
                Notify::send(
                    (string) $audit->userId,
                    'AUDIT',
                    "Audit failed: {$audit->domain}",
                    mb_substr($message, 0, 200) . ' Credits were refunded to your balance.',
                    '/dashboard/audit'
                );
            } catch (\Throwable) {
            }

            try {
                $audit->update(['status' => 'FAILED', 'error' => mb_substr($message, 0, 500)]);
            } catch (\Throwable) {
            }
        }
    }

    private static function clampInt(mixed $v, int $min, int $max): int
    {
        $n = is_numeric($v) ? round((float) $v) : null;
        if ($n === null || ! is_finite($n)) {
            return $min;
        }

        return (int) max($min, min($max, $n));
    }

    /** @return string[] */
    private static function arr(mixed $v): array
    {
        if (! is_array($v)) {
            return [];
        }

        return array_slice(array_map(fn ($x) => mb_substr((string) $x, 0, 500), array_values($v)), 0, 10);
    }
}
