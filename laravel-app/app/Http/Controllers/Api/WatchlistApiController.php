<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Audit;
use App\Models\WatchItem;
use App\Services\Activity;
use App\Services\Credits;
use App\Services\Watchlist;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Port of src/app/api/watchlist/route.ts (GET/POST), [id]/route.ts
 * (PATCH/DELETE), [id]/run/route.ts (POST) and tick/route.ts (POST).
 */
class WatchlistApiController extends Controller
{
    /** GET /api/watchlist */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $items = WatchItem::where('userId', $user->id)
            ->orderByDesc('createdAt')
            ->with(['audits' => function ($q) {
                $q->orderByDesc('createdAt')->take(8)->select(['id', 'watchItemId', 'probability', 'status', 'verdict', 'createdAt']);
            }])
            ->get();
        $plan = Watchlist::getMonitorLimit((string) $user->id);

        $out = [];
        foreach ($items as $i) {
            $audits = $i->audits;
            $out[] = [
                'id' => $i->id,
                'domain' => $i->domain,
                'target' => $i->target,
                'mode' => $i->mode,
                'deepScan' => (bool) $i->deepScan,
                'intervalDays' => (int) $i->intervalDays,
                'active' => (bool) $i->active,
                'lastAuditId' => $i->lastAuditId,
                'lastScore' => $i->lastScore,
                'lastRunAt' => $i->lastRunAt?->toISOString(),
                'nextRunAt' => $i->nextRunAt?->toISOString(),
                'runs' => (int) $i->runs,
                'pausedReason' => $i->pausedReason,
                'running' => $audits->contains(fn ($a) => $a->status === 'PENDING' || $a->status === 'RUNNING'),
                'history' => $audits
                    ->filter(fn ($a) => $a->status === 'DONE')
                    ->map(fn ($a) => ['id' => $a->id, 'probability' => $a->probability, 'createdAt' => $a->createdAt?->toISOString()])
                    ->values(),
            ];
        }

        return response()->json([
            'items' => $out,
            'credits' => (int) $user->credits,
            'limit' => $plan['limit'],
            'planName' => $plan['planName'],
        ]);
    }

    /** POST /api/watchlist */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Please sign in first.'], 401);
        }
        if (! Credits::rateLimit('watch:' . Credits::clientIp($request), 12, 10 * 60_000)['ok']) {
            return response()->json(['error' => 'Too many changes. Wait a few minutes.'], 429);
        }
        if ($user->status === 'SUSPENDED') {
            return response()->json(['error' => 'This account is suspended.'], 403);
        }

        $body = $request->json()->all();
        $data = $this->validateCreate($body);
        if ($data === null) {
            return response()->json(['error' => 'Check the monitoring settings and try again.'], 400);
        }

        $result = Watchlist::addWatchItem((string) $user->id, $data);
        if (! $result['ok']) {
            return response()->json(['error' => $result['error'] ?? 'Invalid request.'], 400);
        }

        return response()->json(['ok' => true, 'id' => $result['id']]);
    }

    /** PATCH /api/watchlist/{id} */
    public function update(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $item = $this->ownedItem($id, (string) $user->id);
        if (! $item) {
            return response()->json(['error' => 'Not found.'], 404);
        }

        $body = $request->json()->all();
        $active = $body['active'] ?? null;
        $intervalDays = $body['intervalDays'] ?? null;
        $deepScan = $body['deepScan'] ?? null;
        if (($active !== null && ! is_bool($active))
            || ($deepScan !== null && ! is_bool($deepScan))
            || ($intervalDays !== null && ! in_array($intervalDays, Watchlist::INTERVALS, true))) {
            return response()->json(['error' => 'Invalid update.'], 400);
        }

        $data = [];
        if (is_bool($active)) {
            $data['active'] = $active;
            // re-enabling schedules from now, clearing any auto-pause note
            if ($active) {
                $data['pausedReason'] = null;
                $data['nextRunAt'] = now()->addMilliseconds((int) $item->intervalDays * 24 * 60 * 60 * 1000);
            }
        }
        if (is_bool($deepScan)) {
            $data['deepScan'] = $deepScan;
        }
        if ($intervalDays !== null) {
            $data['intervalDays'] = (int) $intervalDays;
            // Recompute the next run from the last actual run so the schedule
            // stays meaningful: never run -> one interval from now; otherwise
            // lastRun + new interval.
            $base = $item->lastRunAt ? $item->lastRunAt->getTimestampMs() : now()->getTimestampMs();
            $candidate = $base + ((int) $intervalDays) * 24 * 60 * 60 * 1000;
            $data['nextRunAt'] = \Illuminate\Support\Carbon::createFromTimestampMs(
                (int) max($candidate, now()->getTimestampMs() + 60_000)
            );
        }

        $item->update($data);

        $detail = 'interval ' . $item->intervalDays . 'd';
        if (array_key_exists('active', $data) && $data['active'] === false) {
            $detail = 'paused';
        } elseif (array_key_exists('active', $data) && $data['active'] === true) {
            $detail = 'resumed';
        } elseif (array_key_exists('deepScan', $data)) {
            $detail = $data['deepScan'] ? 'deep scan on' : 'deep scan off';
        }
        Activity::log([
            'action' => 'WATCH_UPDATE',
            'userId' => (string) $user->id,
            'actorEmail' => 'self',
            'detail' => $item->domain . ' · ' . $detail,
        ]);

        return response()->json(['ok' => true]);
    }

    /** DELETE /api/watchlist/{id} */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $item = $this->ownedItem($id, (string) $user->id);
        if (! $item) {
            return response()->json(['error' => 'Not found.'], 404);
        }

        $domain = (string) $item->domain;
        $item->delete();

        Activity::log([
            'action' => 'WATCH_REMOVE',
            'userId' => (string) $user->id,
            'actorEmail' => 'self',
            'detail' => $domain,
        ]);

        return response()->json(['ok' => true]);
    }

    /** POST /api/watchlist/{id}/run - manual "check now" (costs normal audit credits). */
    public function run(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Please sign in first.'], 401);
        }
        if (! Credits::rateLimit('watchrun:' . Credits::clientIp($request), 8, 10 * 60_000)['ok']) {
            return response()->json(['error' => 'Too many checks started. Wait a few minutes.'], 429);
        }
        if ($user->status === 'SUSPENDED') {
            return response()->json(['error' => 'This account is suspended.'], 403);
        }

        $item = WatchItem::find($id);
        if (! $item || $item->userId !== $user->id) {
            return response()->json(['error' => 'Not found.'], 404);
        }

        // prevent double-fire while a check from this item is already running
        $running = Audit::where('watchItemId', $item->id)->whereIn('status', ['PENDING', 'RUNNING'])->first(['id']);
        if ($running) {
            return response()->json(['error' => 'A check for this domain is already in progress.'], 409);
        }

        $result = Watchlist::startWatchRun([
            'id' => (string) $item->id,
            'userId' => (string) $item->userId,
            'domain' => (string) $item->domain,
            'target' => (string) $item->target,
            'mode' => (string) $item->mode,
            'deepScan' => (bool) $item->deepScan,
            'runs' => (int) $item->runs,
            'intervalDays' => (int) $item->intervalDays,
        ]);
        if (! $result['ok']) {
            if (($result['reason'] ?? null) === 'NOT_ENOUGH_CREDITS') {
                return response()->json(
                    ['error' => "Not enough credits. This check needs {$result['need']} credits.", 'needCredits' => $result['need']],
                    402
                );
            }

            return response()->json(['error' => 'Could not start the check. Try again.'], 400);
        }

        return response()->json(['ok' => true, 'auditId' => $result['auditId']]);
    }

    /**
     * POST /api/watchlist/tick - the lazy scheduler.
     * Signed-in user: only that user's due items (fired when the dashboard loads).
     * ?key=<automation key>: every due item, for an external cron.
     */
    public function tick(Request $request): JsonResponse
    {
        if (! Credits::rateLimit('watchtick:' . Credits::clientIp($request), 6, 5 * 60_000)['ok']) {
            return response()->json(['error' => 'Too many ticks.'], 429);
        }

        $key = $request->query('key');
        if ($key) {
            $expected = Watchlist::ensureTickKey();
            if ($key === $expected) {
                $result = Watchlist::tickWatchlist(['key' => $key]);
                // Weekly digest rides on the automation tick; failures are non-fatal.
                $digest = $this->maybeDigest();
                if ($digest['sent'] > 0) {
                    Activity::log([
                        'action' => 'DIGEST_SENT',
                        'actorEmail' => 'automation',
                        'detail' => "{$digest['sent']} monitoring digest email(s) sent",
                    ]);
                }

                return response()->json([
                    'ok' => true,
                    'ran' => $result['ran'],
                    'skipped' => $result['skipped'],
                    'checked' => $result['checked'],
                    'digest' => $digest['skipped'] ? ['sent' => $digest['sent'], 'skipped' => $digest['skipped']] : ['sent' => $digest['sent']],
                ]);
            }

            return response()->json(['error' => 'Invalid key.'], 403);
        }

        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $result = Watchlist::tickWatchlist(['userId' => (string) $user->id]);

        return response()->json([
            'ok' => true,
            'ran' => $result['ran'],
            'skipped' => $result['skipped'],
            'checked' => $result['checked'],
        ]);
    }

    /**
     * Digest hook: the monitor-digest module is a separate port; when its
     * service class is present it runs with the same cadence rules.
     *
     * @return array{sent: int, skipped: ?string, enabled: bool}
     */
    private function maybeDigest(): array
    {
        try {
            if (class_exists(\App\Services\Digest::class) && method_exists(\App\Services\Digest::class, 'maybeSendDigests')) {
                return \App\Services\Digest::maybeSendDigests();
            }
        } catch (\Throwable) {
        }

        return ['sent' => 0, 'skipped' => 'Digest module is not installed.', 'enabled' => false];
    }

    /** @return WatchItem|null */
    private function ownedItem(string $id, string $userId): ?WatchItem
    {
        $item = WatchItem::find($id);
        if (! $item || $item->userId !== $userId) {
            return null;
        }

        return $item;
    }

    private function validateCreate(array $body): ?array
    {
        $domain = isset($body['domain']) && is_string($body['domain']) ? trim($body['domain']) : null;
        $target = $body['target'] ?? null;
        $mode = $body['mode'] ?? null;
        $intervalDays = $body['intervalDays'] ?? null;
        $deepScan = $body['deepScan'] ?? false;

        if ($domain === null || mb_strlen($domain) < 4 || mb_strlen($domain) > 120) {
            return null;
        }
        if (! is_string($target) || ! in_array($target, ['ADSENSE', 'EZOIC', 'MEDIAVINE', 'RAPTIVE'], true)) {
            return null;
        }
        if (! is_string($mode) || ! in_array($mode, ['NORMAL', 'STANDARD', 'PREMIUM'], true)) {
            return null;
        }
        if (! in_array($intervalDays, Watchlist::INTERVALS, true)) {
            return null;
        }
        if ($deepScan === null) {
            $deepScan = false;
        }
        if (! is_bool($deepScan)) {
            return null;
        }

        return [
            'domain' => $domain,
            'target' => $target,
            'mode' => $mode,
            'intervalDays' => (int) $intervalDays,
            'deepScan' => $deepScan,
        ];
    }
}
