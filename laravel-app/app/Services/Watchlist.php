<?php

namespace App\Services;

use App\Models\Audit;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WatchItem;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Port of src/lib/watchlist.ts - monitored-domain scheduler.
 */
class Watchlist
{
    /** Fallback limit for accounts without an active plan (admin-tunable via Setting). */
    public const WATCH_LIMIT_DEFAULT = 1;

    public const INTERVALS = [7, 14, 30];

    public const DOMAIN_RE = '/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/';

    /**
     * How many domains this account may monitor at once: the active plan's
     * monitorLimit when there is one, otherwise the platform free-tier default.
     *
     * @return array{limit: int, planName: ?string}
     */
    public static function getMonitorLimit(int|string $userId): array
    {
        $sub = Subscription::where('userId', $userId)
            ->where('status', 'ACTIVE')
            ->orderByDesc('startedAt')
            ->first();

        if ($sub) {
            $plan = $sub->planId ? Plan::find($sub->planId) : null;
            if ($plan && $plan->monitorLimit !== null) {
                return ['limit' => (int) $plan->monitorLimit, 'planName' => $sub->planName];
            }
        }

        $free = Settings::get('monitorLimitFree', self::WATCH_LIMIT_DEFAULT);

        return [
            'limit' => (is_numeric($free) && (int) $free >= 0) ? (int) $free : self::WATCH_LIMIT_DEFAULT,
            'planName' => null,
        ];
    }

    /**
     * Starts one monitored audit for a watch item: validates, deducts credits,
     * creates the Audit row linked to the item and fires the background runner.
     * Does not throw into callers.
     *
     * @param array{id: string, userId: string, domain: string, target: string, mode: string, deepScan?: ?bool, runs: int, intervalDays: int} $item
     * @return array{ok: bool, reason?: string, auditId?: string, need?: int}
     */
    public static function startWatchRun(array $item): array
    {
        try {
            $costs = Credits::getCosts();
            $modeKey = strtolower((string) $item['mode']);
            $auditCost = is_array($costs['audit'] ?? null) ? ($costs['audit'][$modeKey] ?? 12) : 12;
            $creditsUsed = (int) $auditCost + (($item['deepScan'] ?? false) === true ? (int) ($costs['deepScan'] ?? 6) : 0);

            if (! Credits::deduct((string) $item['userId'], $creditsUsed)) {
                return ['ok' => false, 'reason' => 'NOT_ENOUGH_CREDITS', 'need' => $creditsUsed];
            }

            $audit = Audit::create([
                'userId' => (string) $item['userId'],
                'domain' => (string) $item['domain'],
                'target' => (string) $item['target'],
                'mode' => (string) $item['mode'],
                'deepScan' => ($item['deepScan'] ?? false) === true,
                'status' => 'PENDING',
                'creditsUsed' => $creditsUsed,
                'watchItemId' => (string) $item['id'],
            ]);

            $now = now();
            /** @var WatchItem|null $watchItem */
            $watchItem = WatchItem::find((string) $item['id']);
            $watchItem?->update([
                'lastRunAt' => $now,
                'nextRunAt' => now()->addMilliseconds((int) ($item['intervalDays'] * 24 * 60 * 60 * 1000)),
                'pausedReason' => null,
            ]);
            $watchItem?->increment('runs');

            defer(fn () => AuditRunner::run((string) $audit->id));

            Activity::log([
                'action' => 'WATCH_RUN',
                'userId' => (string) $item['userId'],
                'actorEmail' => 'system',
                'detail' => sprintf(
                    '%s · %s · %s%s · scheduled check #%d',
                    $item['domain'],
                    $item['target'],
                    strtolower((string) $item['mode']),
                    ($item['deepScan'] ?? false) ? ' · deep' : '',
                    ((int) $item['runs']) + 1
                ),
            ]);

            return ['ok' => true, 'auditId' => (string) $audit->id];
        } catch (\Throwable $e) {
            Log::warning('startWatchRun failed: ' . $e->getMessage());

            return ['ok' => false, 'reason' => 'INVALID'];
        }
    }

    /**
     * Lazy scheduler. When $userId is provided only that user's due items run
     * (used when a signed-in dashboard loads). Without a user filter it
     * processes every due item (external cron / watchlist:tick).
     *
     * @return array{ran: int, skipped: int, checked: int}
     */
    public static function tickWatchlist(array $opts = []): array
    {
        $now = now();
        $q = WatchItem::query()
            ->where('active', true)
            ->where('nextRunAt', '<=', $now);
        if (! empty($opts['userId'])) {
            $q->where('userId', $opts['userId']);
        }
        $due = $q->orderBy('nextRunAt')
            ->take(! empty($opts['userId']) ? 5 : 15)
            ->get();

        $ran = 0;
        $skipped = 0;

        foreach ($due as $item) {
            $user = User::find($item->userId);
            if (! $user || $user->status !== 'ACTIVE') {
                $skipped++;
                continue;
            }

            $result = self::startWatchRun([
                'id' => (string) $item->id,
                'userId' => (string) $item->userId,
                'domain' => (string) $item->domain,
                'target' => (string) $item->target,
                'mode' => (string) $item->mode,
                'deepScan' => (bool) $item->deepScan,
                'runs' => (int) $item->runs,
                'intervalDays' => (int) $item->intervalDays,
            ]);

            if ($result['ok']) {
                $ran++;
            } elseif (($result['reason'] ?? null) === 'NOT_ENOUGH_CREDITS') {
                $skipped++;
                /** @var WatchItem|null $alreadyPaused */
                $alreadyPaused = WatchItem::find((string) $item->id);
                if ($alreadyPaused && $alreadyPaused->active) {
                    $alreadyPaused->update([
                        'active' => false,
                        'pausedReason' => 'Paused automatically: not enough credits for the scheduled check.',
                    ]);
                    Notify::send(
                        (string) $item->userId,
                        'SYSTEM',
                        "Monitoring paused: {$item->domain}",
                        "The scheduled check needs {$result['need']} credits but your balance is too low. Top up and re-enable monitoring whenever you are ready.",
                        '/dashboard/watchlist'
                    );
                }
            } else {
                $skipped++;
            }
        }

        return ['ran' => $ran, 'skipped' => $skipped, 'checked' => $due->count()];
    }

    /**
     * Validates + adds a domain to the user's watchlist.
     *
     * @param array{domain: string, target: string, mode: string, intervalDays: int, deepScan?: ?bool} $input
     * @return array{ok: bool, id?: string, error?: string}
     */
    public static function addWatchItem(int|string $userId, array $input): array
    {
        $domain = SafeUrl::normalizeDomain((string) ($input['domain'] ?? ''));
        if (! preg_match(self::DOMAIN_RE, $domain)) {
            return ['ok' => false, 'error' => 'Enter a valid domain like example.com.'];
        }

        $count = WatchItem::where('userId', $userId)->count();
        ['limit' => $limit, 'planName' => $planName] = self::getMonitorLimit((string) $userId);
        if ($count >= $limit) {
            return [
                'ok' => false,
                'error' => $planName
                    ? "Your {$planName} plan covers {$limit} monitored " . ($limit === 1 ? 'domain' : 'domains') . ' and all are in use. Upgrade your plan for more slots.'
                    : "Monitoring on the free tier covers {$limit} domain. Upgrade to a plan for more monitored domains.",
            ];
        }

        $dupe = WatchItem::where('userId', $userId)->where('domain', $domain)->where('target', (string) $input['target'])->first();
        if ($dupe) {
            return ['ok' => false, 'error' => "{$domain} is already being monitored for {$input['target']}."];
        }

        try {
            SafeUrl::assertPublicUrl($domain);
        } catch (\Throwable) {
            return ['ok' => false, 'error' => 'That domain cannot be reached for monitoring.'];
        }

        $item = WatchItem::create([
            'userId' => (string) $userId,
            'domain' => $domain,
            'target' => (string) $input['target'],
            'mode' => (string) $input['mode'],
            'deepScan' => ($input['deepScan'] ?? false) === true,
            'intervalDays' => (int) $input['intervalDays'],
            'active' => true,
            'nextRunAt' => now()->addMilliseconds((int) $input['intervalDays'] * 24 * 60 * 60 * 1000),
        ]);

        Activity::log([
            'action' => 'WATCH_ADD',
            'userId' => (string) $userId,
            'actorEmail' => 'self',
            'detail' => sprintf(
                '%s · every %d days · %s%s',
                $domain,
                (int) $input['intervalDays'],
                strtolower((string) $input['mode']),
                ($input['deepScan'] ?? false) ? ' · deep' : ''
            ),
        ]);

        return ['ok' => true, 'id' => (string) $item->id];
    }

    /**
     * The stored automation key for external cron ticks (settings row
     * 'watchTickKey'), generated on first use - port of ensureKey().
     */
    public static function ensureTickKey(): string
    {
        $existing = Settings::get('watchTickKey', null);
        if (is_string($existing) && $existing !== '') {
            return $existing;
        }

        $key = 'wt_' . str_replace('-', '', (string) Str::uuid());
        Settings::set('watchTickKey', $key);

        return $key;
    }
}
