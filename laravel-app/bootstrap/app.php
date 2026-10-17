<?php

use App\Http\Middleware\EnsureAdmin;
use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->trustProxies(at: '*');

        $middleware->web(append: [
            HandleInertiaRequests::class,
        ]);

        $middleware->alias([
            'admin' => EnsureAdmin::class,
            'api.key' => \App\Http\Middleware\ApiKeyAuth::class,
        ]);

        // The public site allows search engines and third-party crawlers to
        // hit pages without a CSRF token; only state-changing web requests
        // carry the session token (Laravel default behaviour is kept).
        //
        // The /api/* JSON endpoints match the original Next.js app posture:
        // same-origin JSON APIs without CSRF tokens (session cookie is
        // SameSite=Lax and the JSON content-type requirement blocks form
        // based cross-site posts). The React managers use plain fetch.
        $middleware->validateCsrfTokens(except: [
            'api/*',
            'watchlist/tick', // called by the external cron scheduler
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
