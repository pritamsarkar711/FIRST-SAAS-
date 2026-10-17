<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Services\Credits;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Port of src/app/dashboard/indexer/page.tsx. The IndexNow key uses the same
 * derivation as the original: sha256(userId:secret).slice(0, 32) where the
 * secret is NEXTAUTH_SECRET or the literal fallback "adaudit".
 */
class IndexerPageController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $costs = Credits::getCosts();
        $key = substr(hash('sha256', $user->id . ':' . (env('NEXTAUTH_SECRET') ?: 'adaudit')), 0, 32);

        return Inertia::render('Dashboard/Indexer', [
            'costs' => $costs,
            'credits' => (int) $user->credits,
            'initialKey' => $key,
        ]);
    }
}
