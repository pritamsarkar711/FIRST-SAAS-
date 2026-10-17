<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Services\Credits;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Port of src/app/dashboard/watchlist/page.tsx (props for WatchlistManager). */
class WatchlistPageController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $costs = Credits::getCosts();

        return Inertia::render('Dashboard/Watchlist', [
            'credits' => (int) $user->credits,
            'costs' => $costs['audit'],
            'deepCost' => $costs['deepScan'] ?? 6,
        ]);
    }
}
