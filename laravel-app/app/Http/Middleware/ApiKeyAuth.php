<?php

namespace App\Http\Middleware;

use App\Services\ApiKeys;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * API-key auth for the public /api/v1 surface (alias: `api.key`).
 *
 * Reads the raw key from `Authorization: Bearer ak_...`, `X-Api-Key` or
 * `?api_key=`, verifies it through the ApiKeys service (revocation, account
 * suspension, per-day cap) and attaches the owner to the request:
 * `$request->user()` plus the apiKey* attributes used by the controllers.
 * Failures return the exact v1 error JSON (401/403/429) with CORS headers.
 */
class ApiKeyAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $auth = ApiKeys::authenticate($request);

        if (! ($auth['ok'] ?? false)) {
            return ApiKeys::v1Error($auth['error'] ?? 'Unauthorized', (int) ($auth['status'] ?? 401));
        }

        $request->attributes->set('apiKeyUserId', $auth['userId']);
        $request->attributes->set('apiKeyId', $auth['keyId']);
        $request->attributes->set('apiKeyName', $auth['keyName']);
        $request->attributes->set('apiKeyActorEmail', $auth['actorEmail']);
        $request->attributes->set('apiKeyUser', $auth['user'] ?? null);
        // Make $request->user() resolve to the key owner.
        $request->setUserResolver(fn () => $auth['user'] ?? null);

        return $next($request);
    }
}
