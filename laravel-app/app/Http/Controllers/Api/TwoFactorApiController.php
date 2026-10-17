<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Activity;
use App\Services\Credits;
use App\Services\Password;
use App\Services\Totp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Port of the three /api/auth/2fa/* route handlers (identical contracts). */
class TwoFactorApiController extends Controller
{
    public function setup(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }
        if ($user->twoFactorEnabled) {
            return response()->json(['error' => '2FA is already enabled'], 400);
        }

        $data = $request->json()->all();
        if (! Password::verify((string) ($data['password'] ?? ''), $user->passwordHash)) {
            return response()->json(['error' => 'Password is incorrect'], 403);
        }

        $secret = Totp::secret();
        $otpauth = Totp::keyuri($user->email, 'Audit Form', $secret);
        $qr = Totp::qrSvg($otpauth);

        // store temporarily (not enabled until verified)
        $user->twoFactorSecret = $secret;
        $user->save();

        return response()->json(['secret' => $secret, 'otpauth' => $otpauth, 'qr' => $qr]);
    }

    public function enable(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }
        if (! $user->twoFactorSecret) {
            return response()->json(['error' => 'Start the setup first'], 400);
        }

        $code = trim((string) ($request->json('code') ?? ''));
        if (! Totp::verify($code, $user->twoFactorSecret)) {
            return response()->json(['error' => 'The code is not valid. Check your authenticator app clock and try again.'], 400);
        }

        $user->twoFactorEnabled = true;
        $user->save();

        Activity::log([
            'action' => 'AUTH_2FA_ENABLE',
            'actorEmail' => $user->email,
            'userId' => $user->id,
            'ip' => Credits::clientIp($request),
        ]);

        return response()->json(['ok' => true]);
    }

    public function disable(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $data = $request->json()->all();
        if (! Password::verify((string) ($data['password'] ?? ''), $user->passwordHash)) {
            return response()->json(['error' => 'Password is incorrect'], 403);
        }
        if ($user->twoFactorEnabled && $user->twoFactorSecret) {
            $code = trim((string) ($data['code'] ?? ''));
            if (! Totp::verify($code, $user->twoFactorSecret)) {
                return response()->json(['error' => 'The authenticator code is not valid'], 400);
            }
        }

        $user->twoFactorEnabled = false;
        $user->twoFactorSecret = null;
        $user->save();

        Activity::log([
            'action' => 'AUTH_2FA_DISABLE',
            'actorEmail' => $user->email,
            'userId' => $user->id,
            'ip' => Credits::clientIp($request),
        ]);

        return response()->json(['ok' => true]);
    }
}
