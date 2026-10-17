<?php

namespace App\Http\Middleware;

use App\Services\Settings;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function share(Request $request): array
    {
        $user = $request->user();

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $user ? [
                    'id' => $user->id,
                    'email' => $user->email,
                    'name' => $user->name,
                    'image' => $user->image,
                    'role' => $user->role,
                    'status' => $user->status,
                    'credits' => (int) $user->credits,
                    'referralCode' => $user->referralCode,
                    'twoFactorEnabled' => (bool) $user->twoFactorEnabled,
                ] : null,
            ],
            'site' => [
                'name' => (string) (Settings::site()['name'] ?? 'Audit Form'),
                'tagline' => (string) (Settings::site()['tagline'] ?? ''),
                'googleEnabled' => Settings::googleEnabled(),
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
        ];
    }
}
