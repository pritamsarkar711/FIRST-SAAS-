<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Audit;
use App\Models\Payment;
use App\Models\User;
use App\Models\WatchItem;
use App\Services\Settings;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin panel pages (/manage/*). The original Next.js app rendered these
 * from server components + the (panel) layout; here the manage layout role
 * is folded into every page (each Manage/* page wraps itself in the admin
 * shell, receiving `adminName` the way the old layout passed it).
 */
class PanelController extends Controller
{
    private function adminName(User $user): string
    {
        return (string) ($user->name ?: $user->email);
    }

    public function showLogin(): Response
    {
        // Google sign-in appears only when OAuth credentials are configured
        // (environment first, then the admin-panel setting) - mirrors auth.ts.
        return Inertia::render('Manage/Login', [
            'googleEnabled' => Settings::googleEnabled(),
        ]);
    }

    public function dashboard(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();

        $since7d = now()->subDays(7);
        $now = now();

        $usersCount = User::count();
        $audits7d = Audit::where('createdAt', '>=', $since7d)->count();
        $auditsTotal = Audit::count();
        $revenue = (float) Payment::where('status', 'APPROVED')->sum('amount');

        $pendingPayments = Payment::where('status', 'PENDING')
            ->orderByDesc('createdAt')
            ->limit(6)
            ->with('user:id,email')
            ->get(['id', 'userId', 'planName', 'gateway', 'amount', 'createdAt']);

        $recentUsers = User::orderByDesc('createdAt')
            ->limit(5)
            ->get(['id', 'email', 'name', 'createdAt', 'credits']);

        $recentAudits = Audit::orderByDesc('createdAt')
            ->limit(5)
            ->with('user:id,email')
            ->get(['id', 'userId', 'domain', 'target', 'mode', 'status', 'probability']);

        $activeMonitors = WatchItem::where('active', true)->count();
        $dueMonitors = WatchItem::where('active', true)->where('nextRunAt', '<=', $now)->count();
        $pausedMonitors = WatchItem::where('active', false)->whereNotNull('pausedReason')->count();
        $watchFailures7d = Audit::whereNotNull('watchItemId')
            ->where('status', 'FAILED')
            ->where('createdAt', '>=', $since7d)
            ->count();
        $deepMonitors = WatchItem::where('deepScan', true)->count();

        $attentionItems = WatchItem::where(function ($q) use ($now) {
                $q->where(function ($due) use ($now) {
                    $due->where('active', true)->where('nextRunAt', '<=', $now);
                })->orWhere(function ($paused) {
                    $paused->where('active', false)->whereNotNull('pausedReason');
                });
            })
            ->orderByDesc('updatedAt')
            ->limit(5)
            ->with('user:id,email')
            ->get(['id', 'userId', 'domain', 'intervalDays', 'active', 'pausedReason']);

        return Inertia::render('Manage/Dashboard', [
            'adminName' => $this->adminName($user),
            'stats' => [
                'users' => $usersCount,
                'audits7d' => $audits7d,
                'auditsTotal' => $auditsTotal,
                'revenue' => round($revenue, 2),
            ],
            'pendingPayments' => $pendingPayments,
            'recentUsers' => $recentUsers,
            'recentAudits' => $recentAudits,
            'monitors' => [
                'active' => $activeMonitors,
                'due' => $dueMonitors,
                'paused' => $pausedMonitors,
                'failures7d' => $watchFailures7d,
                'deep' => $deepMonitors,
            ],
            'attentionItems' => $attentionItems,
        ]);
    }

    public function users(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();

        return Inertia::render('Manage/Users', ['adminName' => $this->adminName($user)]);
    }

    public function audits(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();

        return Inertia::render('Manage/Audits', ['adminName' => $this->adminName($user)]);
    }

    public function monitors(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();

        return Inertia::render('Manage/Monitors', ['adminName' => $this->adminName($user)]);
    }

    public function payments(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();

        return Inertia::render('Manage/Payments', ['adminName' => $this->adminName($user)]);
    }

    public function plans(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();

        return Inertia::render('Manage/Plans', ['adminName' => $this->adminName($user)]);
    }

    public function gateways(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();

        return Inertia::render('Manage/Gateways', ['adminName' => $this->adminName($user)]);
    }

    public function affiliate(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();

        return Inertia::render('Manage/Affiliate', ['adminName' => $this->adminName($user)]);
    }

    public function messages(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();

        return Inertia::render('Manage/Messages', ['adminName' => $this->adminName($user)]);
    }

    public function blog(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();

        return Inertia::render('Manage/Blog', ['adminName' => $this->adminName($user)]);
    }

    public function activity(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();

        return Inertia::render('Manage/Activity', ['adminName' => $this->adminName($user)]);
    }

    public function settings(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();

        return Inertia::render('Manage/Settings', ['adminName' => $this->adminName($user)]);
    }
}
