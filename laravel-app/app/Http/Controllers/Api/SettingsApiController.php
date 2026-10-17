<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Activity;
use App\Services\Credits;
use App\Services\Password;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * Port of src/app/api/settings/route.ts. The original exposed a single POST
 * handler; the Laravel route contract maps it to PATCH /api/settings
 * (update()) plus a GET /api/settings profile snapshot (show()). Validation
 * and responses match the original zod schema 1:1.
 */
class SettingsApiController extends Controller
{
    /** Profile snapshot (no equivalent in the Next route.ts - the client uses page props). */
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Please sign in first.'], 401);
        }

        return response()->json([
            'ok' => true,
            'user' => [
                'name' => $user->name ?? '',
                'email' => $user->email,
                'twoFactorEnabled' => (bool) $user->twoFactorEnabled,
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Please sign in first.'], 401);
        }
        $ip = Credits::clientIp($request);
        if (! Credits::rateLimit('settings:' . $ip, 10, 5 * 60000)['ok']) {
            return response()->json(['error' => 'Too many attempts. Try again in a few minutes.'], 429);
        }

        $body = $request->json()->all();
        if (! is_array($body)) {
            return response()->json(['error' => 'Invalid request.'], 400);
        }

        // z.object({ action: enum(["profile","password"]), name: trim min2 max60 optional,
        //             current: max100 optional, next: min8 max100 optional })
        $validator = Validator::make($body, [
            'action' => ['required', 'in:profile,password'],
            'name' => ['sometimes', 'string', 'min:2', 'max:60'],
            'current' => ['sometimes', 'string', 'max:100'],
            'next' => ['sometimes', 'string', 'min:8', 'max:100'],
        ]);
        if ($validator->fails()) {
            return response()->json(['error' => 'Invalid request.'], 400);
        }
        $data = $validator->validated();
        $data['name'] = isset($data['name']) ? trim($data['name']) : null;

        if ($data['action'] === 'profile') {
            $name = $data['name'] ?? null;
            if (! $name) {
                return response()->json(['error' => 'Enter your name.'], 400);
            }
            $user->forceFill(['name' => $name])->save();

            return response()->json(['ok' => true, 'message' => 'Profile updated.']);
        }

        // Password change
        $current = $data['current'] ?? null;
        $next = $data['next'] ?? null;
        if (! $current || ! $next) {
            return response()->json(['error' => 'Fill in both password fields.'], 400);
        }
        if (! $user->passwordHash) {
            return response()->json(['error' => 'This account signs in with Google and has no password set.'], 400);
        }
        if (! Password::verify($current, $user->passwordHash)) {
            Activity::log([
                'action' => 'AUTH_PASSWORD_CHANGE',
                'actorEmail' => $user->email,
                'userId' => $user->id,
                'detail' => 'Failed: current password was wrong',
                'ip' => $ip,
            ]);

            return response()->json(['error' => 'Your current password is not correct.'], 400);
        }
        $user->forceFill(['passwordHash' => Password::hash($next)])->save();
        Activity::log([
            'action' => 'AUTH_PASSWORD_CHANGE',
            'actorEmail' => $user->email,
            'userId' => $user->id,
            'detail' => 'Password changed',
            'ip' => $ip,
        ]);

        return response()->json(['ok' => true, 'message' => 'Password changed.']);
    }
}
