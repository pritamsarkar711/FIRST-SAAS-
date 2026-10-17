<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Port of src/app/api/security/route.ts - the security events a normal
 * user may see about their own account (settings page).
 */
class SecurityApiController extends Controller
{
    private const VISIBLE = [
        'AUTH_LOGIN', 'AUTH_LOGIN_FAILED', 'AUTH_2FA_CHALLENGE', 'AUTH_REGISTER',
        'AUTH_LOGOUT', 'AUTH_PASSWORD_CHANGE', 'AUTH_2FA_ENABLE', 'AUTH_2FA_DISABLE',
        'AUDIT_START', 'AUDIT_BATCH_START', 'CHECKOUT_SUBMIT', 'WITHDRAW_REQUEST',
    ];

    private const LABELS = [
        'AUTH_LOGIN' => 'Signed in',
        'AUTH_LOGIN_FAILED' => 'Sign-in attempt failed',
        'AUTH_2FA_CHALLENGE' => 'Two-factor code requested',
        'AUTH_REGISTER' => 'Account created',
        'AUTH_LOGOUT' => 'Signed out',
        'AUTH_PASSWORD_CHANGE' => 'Password changed',
        'AUTH_2FA_ENABLE' => 'Two-factor authentication turned on',
        'AUTH_2FA_DISABLE' => 'Two-factor authentication turned off',
        'AUDIT_START' => 'Started a site audit',
        'AUDIT_BATCH_START' => 'Started a batch audit',
        'CHECKOUT_SUBMIT' => 'Placed a credit order',
        'WITHDRAW_REQUEST' => 'Requested an affiliate withdrawal',
    ];

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $events = \App\Models\ActivityLog::where('actorEmail', $user->email)
            ->whereIn('action', self::VISIBLE)
            ->orderByDesc('createdAt')
            ->limit(12)
            ->get(['id', 'action', 'detail', 'ip', 'createdAt']);

        return response()->json([
            'twoFactorEnabled' => (bool) $user->twoFactorEnabled,
            'memberSince' => $user->createdAt,
            'events' => $events->map(fn ($e) => [
                'id' => $e->id,
                'action' => $e->action,
                'detail' => $e->detail,
                'ip' => $e->ip,
                'createdAt' => $e->createdAt,
                'label' => self::LABELS[$e->action] ?? $e->action,
            ]),
        ]);
    }
}
