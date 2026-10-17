<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Audit;
use App\Services\Activity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Port of src/app/api/admin/audits/route.ts (GET 1:1).
 * DELETE /api/admin/audits?id=... is declared by the routes/web.php contract
 * (the original route.ts had no DELETE handler) - it removes a single audit,
 * mirroring the plan/post DELETE style.
 */
class AuditsController extends Controller
{
    public function index(): JsonResponse
    {
        $audits = Audit::orderByDesc('createdAt')
            ->limit(100)
            ->with('user:id,email')
            ->get(['id', 'userId', 'domain', 'target', 'mode', 'status', 'probability', 'verdict', 'createdAt']);

        return response()->json([
            'audits' => $audits->map(function (Audit $a) {
                return [
                    'id' => $a->id,
                    'domain' => $a->domain,
                    'target' => $a->target,
                    'mode' => $a->mode,
                    'status' => $a->status,
                    'probability' => (int) $a->probability,
                    'verdict' => $a->verdict,
                    'createdAt' => $a->createdAt,
                    'user' => ['email' => $a->user->email ?? ''],
                ];
            }),
        ]);
    }

    public function destroy(Request $request): JsonResponse
    {
        /** @var \App\Models\User $admin */
        $admin = $request->user();

        $id = (string) $request->query('id', '');
        if ($id === '') {
            return response()->json(['error' => 'Audit id required.'], 400);
        }

        $audit = Audit::find($id);
        if (! $audit) {
            return response()->json(['error' => 'Audit not found.'], 404);
        }

        $domain = $audit->domain;
        $audit->delete();

        Activity::log([
            'action' => 'AUDIT_DELETE',
            'actorEmail' => $admin->email,
            'userId' => $audit->userId,
            'detail' => $domain,
        ]);

        return response()->json(['ok' => true]);
    }
}
