<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\WatchItem;
use App\Services\Activity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Port of src/app/api/admin/monitors/route.ts (GET 1:1, incl. the
 * overdueMinutes computation and summary counts).
 * PATCH /api/admin/monitors is declared by the routes/web.php contract (the
 * original route.ts had no mutation handler); it toggles/edits a monitor.
 */
class MonitorsController extends Controller
{
    public function index(): JsonResponse
    {
        $items = WatchItem::orderByDesc('createdAt')
            ->with('user:id,email,status')
            ->get();

        $nowMs = (int) (microtime(true) * 1000);

        $monitors = $items->map(function (WatchItem $w) use ($nowMs) {
            $nextRunMs = $w->nextRunAt ? $w->nextRunAt->getTimestampMs() : 0;

            return [
                'id' => $w->id,
                'domain' => $w->domain,
                'target' => $w->target,
                'mode' => $w->mode,
                'deepScan' => (bool) $w->deepScan,
                'intervalDays' => (int) $w->intervalDays,
                'active' => (bool) $w->active,
                'pausedReason' => $w->pausedReason,
                'runs' => (int) $w->runs,
                'lastScore' => $w->lastScore === null ? null : (int) $w->lastScore,
                'lastRunAt' => $w->lastRunAt,
                'nextRunAt' => $w->nextRunAt,
                'overdueMinutes' => $w->active && $nextRunMs < $nowMs
                    ? (int) round(($nowMs - $nextRunMs) / 60000)
                    : null,
                'user' => [
                    'email' => $w->user->email ?? '',
                    'status' => $w->user->status ?? '',
                ],
                'createdAt' => $w->createdAt,
            ];
        });

        return response()->json([
            'monitors' => $monitors,
            'summary' => [
                'total' => $monitors->count(),
                'active' => $monitors->where('active', true)->count(),
                'deep' => $monitors->where('deepScan', true)->count(),
                'overdue' => $monitors->whereNotNull('overdueMinutes')->count(),
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        /** @var \App\Models\User $admin */
        $admin = $request->user();

        $data = $request->json()->all();
        $id = (string) ($data['id'] ?? '');
        if ($id === '') {
            return response()->json(['error' => 'Monitor id required.'], 400);
        }

        $monitor = WatchItem::find($id);
        if (! $monitor) {
            return response()->json(['error' => 'Monitor not found.'], 404);
        }

        $changes = [];
        if (array_key_exists('active', $data)) {
            $changes['active'] = (bool) $data['active'];
            if (! $changes['active'] && array_key_exists('pausedReason', $data)) {
                $changes['pausedReason'] = $data['pausedReason'] !== null ? (string) $data['pausedReason'] : null;
            }
        }
        if (array_key_exists('intervalDays', $data) && is_numeric($data['intervalDays'])) {
            $changes['intervalDays'] = max(1, (int) $data['intervalDays']);
        }
        if (array_key_exists('deepScan', $data)) {
            $changes['deepScan'] = (bool) $data['deepScan'];
        }

        if ($changes === []) {
            return response()->json(['error' => 'Nothing to update.'], 400);
        }

        $monitor->fill($changes)->save();

        Activity::log([
            'action' => 'WATCH_UPDATE',
            'actorEmail' => $admin->email,
            'userId' => $monitor->userId,
            'detail' => "Admin updated monitor {$monitor->domain}",
        ]);

        return response()->json(['ok' => true]);
    }
}
