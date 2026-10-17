<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Activity;
use App\Services\Password;
use App\Services\Settings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\GoogleProvider;

/**
 * Google OAuth - mirrors the NextAuth Google provider behaviour in
 * src/lib/auth.ts: auto-provision on first sign-in, suspended accounts
 * bounced, admins land on /manage, users on /dashboard.
 */
class GoogleController extends Controller
{
    public function redirect()
    {
        if (! Settings::googleEnabled()) {
            return redirect('/login?error=google_not_configured');
        }
        $c = Settings::googleCredentials();
        $provider = Socialite::buildProvider(GoogleProvider::class, [
            'client_id' => $c['clientId'],
            'client_secret' => $c['clientSecret'],
            'redirect' => url('/auth/google/callback'),
        ]);

        return $provider->stateless()->redirect();
    }

    public function callback(Request $request)
    {
        if (! Settings::googleEnabled()) {
            return redirect('/login');
        }
        $c = Settings::googleCredentials();
        $provider = Socialite::buildProvider(GoogleProvider::class, [
            'client_id' => $c['clientId'],
            'client_secret' => $c['clientSecret'],
            'redirect' => url('/auth/google/callback'),
        ]);

        try {
            $gUser = $provider->stateless()->user();
        } catch (\Throwable) {
            return redirect('/login?error=google_failed');
        }

        $email = strtolower((string) ($gUser->email ?? ''));
        if ($email === '') {
            return redirect('/login?error=google_no_email');
        }

        $user = User::where('email', $email)->first();

        if (! $user) {
            $user = User::create([
                'email' => $email,
                'name' => $gUser->name ?? '',
                'image' => $gUser->avatar ?? null,
                'referralCode' => Password::referralCode(),
            ]);
            Activity::log([
                'action' => 'AUTH_REGISTER',
                'actorEmail' => $user->email,
                'userId' => $user->id,
                'detail' => 'Google sign-up',
            ]);
        }

        if ($user->status === 'SUSPENDED') {
            return redirect('/login?error=ACCOUNT_SUSPENDED');
        }

        Auth::login($user);
        $request->session()->regenerate();

        Activity::log([
            'action' => $user->role === 'ADMIN' ? 'ADMIN_LOGIN' : 'AUTH_LOGIN',
            'actorEmail' => $user->email,
            'userId' => $user->id,
            'detail' => 'Google',
        ]);

        return redirect($user->role === 'ADMIN' ? '/manage' : '/dashboard');
    }
}
