<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Small session/info endpoints used by the React app and smoke tests. */
class AuthApiController extends Controller
{
    /** GET /api/me - the shared session user (mirrors Inertia auth.user). */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['user' => null], 200);
        }

        return response()->json([
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'name' => $user->name,
                'image' => $user->image,
                'role' => $user->role,
                'status' => $user->status,
                'credits' => (int) $user->credits,
                'referralCode' => $user->referralCode,
                'twoFactorEnabled' => (bool) $user->twoFactorEnabled,
            ],
        ]);
    }

    /** GET /api/site - public site information. */
    public function site(): JsonResponse
    {
        $site = \App\Services\Settings::site();

        return response()->json([
            'name' => (string) ($site['name'] ?? 'Audit Form'),
            'tagline' => (string) ($site['tagline'] ?? ''),
            'supportEmail' => (string) ($site['supportEmail'] ?? ''),
            'googleEnabled' => \App\Services\Settings::googleEnabled(),
        ]);
    }
}
