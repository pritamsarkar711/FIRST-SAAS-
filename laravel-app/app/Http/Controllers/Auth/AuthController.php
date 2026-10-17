<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Activity;
use App\Services\Password;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    /**
     * Port of the NextAuth credentials authorize() in src/lib/auth.ts:
     * - wrong email/password  -> generic error
     * - suspended account     -> ACCOUNT_SUSPENDED
     * - 2FA enabled, no code  -> 2FA_REQUIRED (client shows the code field)
     * - 2FA enabled, bad code -> INVALID_2FA
     * On success the session is created (role decides the redirect target).
     */
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'code' => ['nullable', 'string'],
        ]);

        $ip = \App\Services\Credits::clientIp($request);
        $email = strtolower(trim($data['email']));

        $user = User::where('email', $email)->first();

        if (! $user || ! $user->passwordHash || ! Password::verify($data['password'], $user->passwordHash)) {
            Activity::log([
                'action' => 'AUTH_LOGIN_FAILED',
                'actorEmail' => $email ?: 'unknown',
                'userId' => $user->id ?? null,
                'detail' => $user ? 'Wrong password' : 'No matching account',
                'ip' => $ip,
            ]);

            return response()->json(['error' => 'Wrong email or password. Try again.'], 401);
        }

        if ($user->status === 'SUSPENDED') {
            Activity::log([
                'action' => 'AUTH_LOGIN_FAILED',
                'actorEmail' => $email,
                'userId' => $user->id,
                'detail' => 'Account suspended',
                'ip' => $ip,
            ]);

            return response()->json(['error' => 'ACCOUNT_SUSPENDED', 'message' => 'This account is suspended. Contact support.'], 403);
        }

        if ($user->twoFactorEnabled && $user->twoFactorSecret) {
            $code = trim((string) ($data['code'] ?? ''));
            if ($code === '') {
                Activity::log([
                    'action' => 'AUTH_2FA_CHALLENGE',
                    'actorEmail' => $email,
                    'userId' => $user->id,
                    'ip' => $ip,
                ]);

                return response()->json(['error' => '2FA_REQUIRED'], 401);
            }
            if (! \App\Services\Totp::verify($code, $user->twoFactorSecret)) {
                Activity::log([
                    'action' => 'AUTH_LOGIN_FAILED',
                    'actorEmail' => $email,
                    'userId' => $user->id,
                    'detail' => 'Invalid 2FA code',
                    'ip' => $ip,
                ]);

                return response()->json(['error' => 'INVALID_2FA', 'message' => 'That code is not valid. Check your authenticator app.'], 401);
            }
        }

        Auth::login($user, $request->boolean('remember'));
        $request->session()->regenerate();

        Activity::log([
            'action' => $user->role === 'ADMIN' ? 'ADMIN_LOGIN' : 'AUTH_LOGIN',
            'actorEmail' => $email,
            'userId' => $user->id,
            'ip' => $ip,
        ]);

        return response()->json([
            'ok' => true,
            'role' => $user->role,
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'name' => $user->name,
                'image' => $user->image,
                'role' => $user->role,
                'status' => $user->status,
                'credits' => (int) $user->credits,
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user) {
            Activity::log(['action' => 'AUTH_LOGOUT', 'actorEmail' => $user->email, 'userId' => $user->id]);
        }
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['ok' => true]);
    }

    /** GET /logout fallback (browser navigation). */
    public function logoutWeb(Request $request)
    {
        $user = $request->user();
        if ($user) {
            Activity::log(['action' => 'AUTH_LOGOUT', 'actorEmail' => $user->email, 'userId' => $user->id]);
        }
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
