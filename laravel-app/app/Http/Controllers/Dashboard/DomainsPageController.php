<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\Audit;
use App\Models\WatchItem;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Port of src/app/dashboard/domains/page.tsx (index) and
 * src/app/dashboard/domains/[domain]/page.tsx (show). The per-domain
 * aggregation happens client-side; the show() variant normalizes and
 * validates the domain exactly like the original (404 otherwise).
 */
class DomainsPageController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        $audits = Audit::where('userId', $user->id)
            ->orderBy('createdAt', 'asc')
            ->get(['id', 'domain', 'target', 'status', 'probability', 'verdict', 'watchItemId', 'createdAt']);

        return Inertia::render('Dashboard/Domains/Index', [
            'audits' => $audits,
        ]);
    }

    public function show(Request $request, string $domain): Response
    {
        $user = $request->user();
        $domain = $this->normalizeDomain(rawurldecode($domain));
        if ($domain === '' || ! preg_match('/^[a-z0-9.-]+\.[a-z]{2,}$/', $domain)) {
            abort(404);
        }

        $audits = Audit::where('userId', $user->id)
            ->whereIn('domain', [$domain, 'www.' . $domain])
            ->orderBy('createdAt', 'asc')
            ->get([
                'id', 'target', 'mode', 'deepScan', 'status', 'probability', 'verdict',
                'batchId', 'watchItemId', 'report', 'createdAt',
            ]);

        $watches = WatchItem::where('userId', $user->id)
            ->whereIn('domain', [$domain, 'www.' . $domain])
            ->orderBy('updatedAt', 'desc')
            ->get();

        return Inertia::render('Dashboard/Domains/Detail', [
            'domain' => $domain,
            'audits' => $audits,
            'watches' => $watches,
        ]);
    }

    /** Port of normalizeDomain from src/lib/guard.ts (client-safe subset). */
    private function normalizeDomain(string $input): string
    {
        $d = mb_strtolower(trim($input));
        $d = preg_replace('#^https?://#', '', $d) ?? $d;
        $d = preg_replace('#^www\.#', '', $d) ?? $d;

        return explode('#', explode('?', explode('/', $d)[0])[0])[0];
    }
}
