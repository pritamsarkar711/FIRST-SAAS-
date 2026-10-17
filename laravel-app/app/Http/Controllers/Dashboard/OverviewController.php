<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\Audit;
use App\Models\ContentJob;
use App\Models\WatchItem;
use App\Services\Credits;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Port of src/app/dashboard/page.tsx (server component). The original Next.js
 * page fetched these rows server-side; here they are passed as props and the
 * page component performs the same pure-JS aggregation.
 */
class OverviewController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Dashboard/Overview', [
            'user' => [
                'id' => $user->id,
                'credits' => (int) $user->credits,
                'createdAt' => $user->createdAt?->toISOString(),
                'referralCode' => $user->referralCode,
                'twoFactorEnabled' => (bool) $user->twoFactorEnabled,
            ],
            'costs' => Credits::getCosts(),
            'audits' => Audit::where('userId', $user->id)
                ->orderBy('createdAt', 'desc')
                ->limit(15)
                ->get(['id', 'domain', 'target', 'mode', 'status', 'probability', 'verdict', 'createdAt']),
            'jobs' => ContentJob::where('userId', $user->id)
                ->orderBy('createdAt', 'desc')
                ->limit(3)
                ->get(['id', 'type', 'keyword', 'status', 'createdAt']),
            'watchItems' => WatchItem::where('userId', $user->id)
                ->where('active', true)
                ->orderBy('nextRunAt', 'asc')
                ->limit(3)
                ->get(['domain', 'nextRunAt', 'lastScore']),
            'watchCount' => WatchItem::where('userId', $user->id)->count(),
        ]);
    }
}
