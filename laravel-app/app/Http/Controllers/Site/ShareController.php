<?php

namespace App\Http\Controllers\Site;

use App\Http\Controllers\Controller;
use App\Models\Audit;
use Inertia\Inertia;
use Inertia\Response;

/** Public shareable report page (/share/{token}). */
class ShareController extends Controller
{
    public function __invoke(string $token): Response
    {
        $audit = Audit::where('shareToken', $token)
            ->where('status', 'DONE')
            ->first();

        if (! $audit) {
            abort(404);
        }

        return Inertia::render('Share/Report', [
            'audit' => [
                'id' => $audit->id,
                'domain' => $audit->domain,
                'target' => $audit->target,
                'mode' => $audit->mode,
                'probability' => $audit->probability,
                'verdict' => $audit->verdict,
                'report' => $audit->report,
                'createdAt' => $audit->createdAt?->toISOString(),
            ],
        ]);
    }
}
