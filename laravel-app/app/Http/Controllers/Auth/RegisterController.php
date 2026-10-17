<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Activity;
use App\Services\Credits;
use App\Services\Password;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class RegisterController extends Controller
{
    /** Port of src/app/api/auth/register/route.ts (1:1 response contract). */
    public function store(Request $request): JsonResponse
    {
        $ip = Credits::clientIp($request);

        if (! Credits::rateLimit('register:' . $ip, 5, 10 * 60000)['ok']) {
            return response()->json(['error' => 'Too many attempts. Try again in a few minutes.'], 429);
        }

        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'min:2', 'max:60'],
            'email' => ['required', 'email:rfc', 'max:190'],
            'password' => ['required', 'string', 'min:8', 'max:100'],
            'acceptTerms' => ['accepted'],
        ], [
            'acceptTerms.accepted' => 'You must accept the Terms of Service',
        ]);

        if ($validator->fails()) {
            $first = $validator->errors()->first();

            return response()->json(['error' => $first ?: 'Invalid input'], 400);
        }

        $data = $validator->validated();
        $data['email'] = strtolower(trim($data['email']));

        if (User::where('email', $data['email'])->exists()) {
            return response()->json(['error' => 'An account with this email already exists'], 409);
        }

        // Referral cookie is set by the /?ref= middleware on the marketing site
        $refCode = $request->cookie('ref');
        $referredById = null;
        if ($refCode) {
            $referredById = User::where('referralCode', $refCode)->value('id');
        }

        $costs = Credits::getCosts();
        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'passwordHash' => Password::hash($data['password']),
            'credits' => (int) ($costs['signupBonus'] ?? 10),
            'referralCode' => Password::referralCode(),
            'referredById' => $referredById,
        ]);

        Activity::log([
            'action' => 'AUTH_REGISTER',
            'actorEmail' => $user->email,
            'userId' => $user->id,
            'detail' => $referredById ? 'Signed up with a referral code' : 'Email sign-up',
            'ip' => $ip,
        ]);

        return response()->json(['ok' => true, 'email' => $user->email]);
    }
}
