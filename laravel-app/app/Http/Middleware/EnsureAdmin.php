<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Admin gate for /manage - the session user must have role ADMIN.
 * Mirrors the manage layout bounce in the Next.js app: non-admin
 * sessions are sent to /manage/login.
 */
class EnsureAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || $user->status === 'SUSPENDED') {
            if ($request->inertia()) {
                return redirect('/manage/login')->with('error', 'Admin access required');
            }

            return redirect()->guest('/manage/login');
        }

        if ($user->role !== 'ADMIN') {
            if ($request->inertia()) {
                return redirect('/dashboard')->with('error', 'This area is for administrators only');
            }

            return redirect('/dashboard')->with('error', 'This area is for administrators only');
        }

        return $next($request);
    }
}
