<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\ContentJob;
use App\Services\Credits;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Port of src/app/dashboard/writer/page.tsx. */
class WriterPageController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $tab = $request->query('tab');
        $costs = Credits::getCosts();

        $jobs = ContentJob::where('userId', $user->id)
            ->orderBy('createdAt', 'desc')
            ->limit(12)
            ->get(['id', 'type', 'keyword', 'status', 'createdAt']);

        return Inertia::render('Dashboard/Writer', [
            'costs' => $costs['writer'],
            'credits' => (int) $user->credits,
            'jobs' => $jobs,
            'initialTab' => $tab === 'affiliate' ? 'AFFILIATE' : 'ADSENSE',
        ]);
    }
}
