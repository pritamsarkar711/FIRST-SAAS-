<?php

namespace App\Http\Controllers\Site;

use App\Http\Controllers\Controller;
use App\Models\BlogPost;
use App\Models\Plan;
use App\Services\Settings;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function __invoke(): Response
    {
        $plans = Plan::where('active', true)
            ->orderBy('sortOrder')
            ->get(['id', 'name', 'slug', 'description', 'priceUsd', 'credits', 'monitorLimit', 'features', 'badge', 'sortOrder']);

        $posts = BlogPost::where('status', 'PUBLISHED')
            ->orderByDesc('publishedAt')
            ->limit(3)
            ->get(['id', 'title', 'slug', 'excerpt', 'coverImage', 'publishedAt']);

        $site = Settings::site();

        return Inertia::render('Home', [
            'plans' => $plans,
            'posts' => $posts,
            'usdBdt' => Settings::usdBdt($site),
        ]);
    }
}
