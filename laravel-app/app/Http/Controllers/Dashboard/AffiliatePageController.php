<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Port of src/app/dashboard/affiliate/page.tsx. The origin is derived from the
 * forwarded host header exactly like the original Next.js headers() usage.
 */
class AffiliatePageController extends Controller
{
    public function index(Request $request): Response
    {
        $host = $request->headers->get('x-forwarded-host')
            ?: $request->headers->get('host')
            ?: 'localhost:3000';
        $proto = $request->headers->get('x-forwarded-proto')
            ?: (str_contains($host, 'localhost') ? 'http' : 'https');

        return Inertia::render('Dashboard/Affiliate', [
            'origin' => $proto . '://' . $host,
        ]);
    }
}
