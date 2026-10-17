<?php

namespace App\Http\Controllers\Site;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AuthPageController extends Controller
{
    public function login(Request $request): Response
    {
        if ($request->user()) {
            return Inertia::location($request->user()->role === 'ADMIN' ? '/manage' : '/dashboard');
        }

        return Inertia::render('Auth/Login', [
            'params' => $request->query(),
            'googleEnabled' => \App\Services\Settings::googleEnabled(),
        ]);
    }

    public function register(Request $request): Response
    {
        if ($request->user()) {
            return Inertia::location('/dashboard');
        }

        return Inertia::render('Auth/Register', [
            'params' => $request->query(),
            'googleEnabled' => \App\Services\Settings::googleEnabled(),
        ]);
    }
}
