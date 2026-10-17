<?php

namespace App\Http\Controllers\Site;

use App\Http\Controllers\Controller;
use App\Services\Settings;
use Inertia\Inertia;
use Inertia\Response;

/** Static marketing pages (same components as the Next.js (site) group). */
class PageController extends Controller
{
    public function pricing(): Response
    {
        $plans = \App\Models\Plan::where('active', true)->orderBy('sortOrder')->get();

        return Inertia::render('Site/Pricing', ['plans' => $plans, 'usdBdt' => Settings::usdBdt()]);
    }

    public function features(): Response
    {
        return Inertia::render('Site/Features');
    }

    public function howItWorks(): Response
    {
        return Inertia::render('Site/HowItWorks');
    }

    public function tools(): Response
    {
        return Inertia::render('Site/Tools');
    }

    public function sampleReport(): Response
    {
        return Inertia::render('Site/SampleReport');
    }

    public function about(): Response
    {
        return Inertia::render('Site/About');
    }

    public function terms(): Response
    {
        return Inertia::render('Site/Terms');
    }

    public function privacy(): Response
    {
        return Inertia::render('Site/Privacy');
    }

    public function refund(): Response
    {
        return Inertia::render('Site/Refund');
    }

    public function docsApi(): Response
    {
        return Inertia::render('Site/DocsApi');
    }
}
