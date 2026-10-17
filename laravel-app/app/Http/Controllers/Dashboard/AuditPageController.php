<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\Audit;
use App\Services\Credits;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Port of src/app/dashboard/audit/page.tsx (index) and
 * src/app/dashboard/audit/[id]/page.tsx (show).
 */
class AuditPageController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $costs = Credits::getCosts();
        $q = $request->query();

        $history = Audit::where('userId', $user->id)
            ->orderBy('createdAt', 'desc')
            ->limit(20)
            ->get(['id', 'domain', 'target', 'mode', 'deepScan', 'status', 'probability', 'verdict', 'batchId', 'createdAt']);

        return Inertia::render('Dashboard/Audit/Index', [
            'costs' => $costs['audit'],
            'deepCost' => $costs['deepScan'] ?? 6,
            'credits' => (int) $user->credits,
            'history' => $history,
            'initialDomain' => is_string($q['domain'] ?? null) ? $q['domain'] : '',
            'initialNetwork' => is_string($q['network'] ?? null) ? $q['network'] : 'ADSENSE',
            'initialDeep' => ($q['deep'] ?? null) === '1',
            'autostart' => ($q['n'] ?? null) === '1' || ($q['autostart'] ?? null) === '1',
        ]);
    }

    public function show(Request $request, string $id): Response
    {
        $user = $request->user();
        $audit = Audit::find($id);
        if (! $audit || $audit->userId !== $user->id) {
            abort(404);
        }

        // Previous completed audit of the same domain + network, for progress comparison
        $previous = null;
        if ($audit->status === 'DONE' && $audit->report) {
            $prev = Audit::where('userId', $user->id)
                ->where('domain', $audit->domain)
                ->where('target', $audit->target)
                ->where('status', 'DONE')
                ->where('createdAt', '<', $audit->createdAt)
                ->orderBy('createdAt', 'desc')
                ->first(['id', 'probability', 'verdict', 'report', 'createdAt']);
            if ($prev) {
                $previous = [
                    'id' => $prev->id,
                    'probability' => (int) $prev->probability,
                    'verdict' => $prev->verdict,
                    'report' => $prev->report ? json_decode($prev->report) : null,
                    'createdAt' => $prev->createdAt?->toISOString(),
                ];
            }
        }

        return Inertia::render('Dashboard/Audit/Detail', [
            'audit' => [
                'id' => $audit->id,
                'domain' => $audit->domain,
                'target' => $audit->target,
                'mode' => $audit->mode,
                'deepScan' => (bool) $audit->deepScan,
                'probability' => (int) $audit->probability,
                'verdict' => $audit->verdict,
                'status' => $audit->status,
                'error' => $audit->error,
                'shareToken' => $audit->shareToken,
                'createdAt' => $audit->createdAt?->toISOString(),
                'report' => $audit->report ? json_decode($audit->report) : null,
                'signals' => $audit->signals ? json_decode($audit->signals) : null,
            ],
            'previous' => $previous,
        ]);
    }
}
