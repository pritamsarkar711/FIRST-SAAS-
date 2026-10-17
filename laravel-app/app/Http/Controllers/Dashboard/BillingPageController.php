<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Plan;
use App\Services\Credits;
use App\Services\Settings;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Ports of src/app/dashboard/billing/page.tsx (index),
 * src/app/dashboard/billing/checkout/page.tsx (checkout) and
 * src/app/dashboard/billing/checkout/success/page.tsx (checkoutSuccess).
 */
class BillingPageController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        $plans = Plan::where('active', true)
            ->orderBy('sortOrder', 'asc')
            ->get()
            ->map(fn (Plan $p) => [
                'id' => $p->id,
                'name' => $p->name,
                'slug' => $p->slug,
                'description' => $p->description,
                'priceUsd' => (float) $p->priceUsd,
                'credits' => (int) $p->credits,
                'monitorLimit' => (int) $p->monitorLimit,
                'features' => json_decode((string) ($p->features ?? '[]')) ?: [],
                'badge' => $p->badge,
                'active' => (bool) $p->active,
                'sortOrder' => (int) $p->sortOrder,
            ])
            ->values()
            ->all();

        return Inertia::render('Dashboard/Billing/Index', [
            'user' => ['credits' => (int) $user->credits],
            'plans' => $plans,
            'rate' => Settings::usdBdt(),
            'payments' => Payment::where('userId', $user->id)
                ->orderBy('createdAt', 'desc')
                ->limit(15)
                ->get(['id', 'planName', 'amount', 'amountBdt', 'gateway', 'status', 'createdAt']),
            'costs' => Credits::getCosts(),
        ]);
    }

    public function checkout(Request $request): Response
    {
        $slug = $request->query('plan');
        if (! is_string($slug) || $slug === '') {
            abort(404);
        }
        $plan = Plan::where('slug', $slug)->first();
        if (! $plan || ! $plan->active) {
            abort(404);
        }

        return Inertia::render('Dashboard/Billing/Checkout', [
            'plan' => [
                'id' => $plan->id,
                'name' => $plan->name,
                'slug' => $plan->slug,
                'description' => $plan->description,
                'priceUsd' => (float) $plan->priceUsd,
                'credits' => (int) $plan->credits,
            ],
        ]);
    }

    public function checkoutSuccess(Request $request): Response
    {
        // payment, session_id, canceled, pp, scz, approved, failed, reason
        return Inertia::render('Dashboard/Billing/CheckoutSuccess', [
            'params' => $request->query(),
        ]);
    }
}
