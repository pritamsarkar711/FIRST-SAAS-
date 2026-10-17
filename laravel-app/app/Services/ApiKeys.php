<?php

namespace App\Services;

use App\Models\ApiKey;
use App\Models\ApiKeyUsage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Port of src/lib/api-keys.ts - developer API keys.
 *
 * A key is only ever stored as a sha256 hash; the raw value is returned to the
 * owner exactly once at creation time. The prefix (first 11 chars) is kept for
 * display so users can tell keys apart without exposing the secret.
 *
 * The original accepted `Authorization: Bearer ak_...`; the Laravel port also
 * accepts the `X-Api-Key` header and `?api_key=` query parameter (used by the
 * ApiKeyAuth middleware).
 */
class ApiKeys
{
    public const API_KEY_PREFIX = 'ak_';

    /** Shared CORS headers for the public /api/v1 surface. */
    public const V1_CORS_HEADERS = [
        'Access-Control-Allow-Origin' => '*',
        'Access-Control-Allow-Methods' => 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers' => 'Authorization, X-Api-Key, Content-Type',
        'Access-Control-Max-Age' => '86400',
    ];

    public static function createRawApiKey(): string
    {
        // ak_ + 32 url-safe chars (24 random bytes, base64url)
        return self::API_KEY_PREFIX . rtrim(strtr(base64_encode(random_bytes(24)), '+/', '-_'), '=');
    }

    public static function hashApiKey(string $raw): string
    {
        return hash('sha256', trim($raw));
    }

    public static function keyPrefixOf(string $raw): string
    {
        return substr($raw, 0, 11);
    }

    /** Raw key candidates from the request, in priority order. */
    public static function rawKeyFromRequest(Request $request): string
    {
        $header = (string) $request->header('authorization', '');
        if (str_starts_with($header, 'Bearer ')) {
            return trim(substr($header, 7));
        }
        $xKey = trim((string) $request->header('X-Api-Key', ''));
        if ($xKey !== '') {
            return $xKey;
        }

        return trim((string) $request->query('api_key', ''));
    }

    /**
     * Authenticate a request carrying an API key. Enforces revocation,
     * suspension and the per-day usage cap before the request proceeds.
     *
     * @return array{ok: bool, status: int, error?: string, userId?: string, keyId?: string, keyName?: string, actorEmail?: string, user?: \App\Models\User|null}
     */
    public static function authenticate(Request $request): array
    {
        $raw = self::rawKeyFromRequest($request);
        if (! str_starts_with($raw, self::API_KEY_PREFIX) || strlen($raw) < 20 || strlen($raw) > 80) {
            return ['ok' => false, 'status' => 401, 'error' => 'Missing or malformed API key. Send `Authorization: Bearer ak_...`.'];
        }

        /** @var ApiKey|null $key */
        $key = ApiKey::with('user')->where('keyHash', self::hashApiKey($raw))->first();
        if (! $key) {
            return ['ok' => false, 'status' => 401, 'error' => 'Invalid API key.'];
        }
        if ($key->revokedAt) {
            return ['ok' => false, 'status' => 401, 'error' => 'This API key has been revoked. Create a new one in Settings.'];
        }
        if ($key->user && $key->user->status === 'SUSPENDED') {
            return ['ok' => false, 'status' => 403, 'error' => 'The account that owns this key is suspended.'];
        }

        // Per-day usage rollup for the usage chart and spend caps. Read first
        // so the daily cap can be enforced before the request proceeds.
        $day = now()->utc()->toDateString();
        $todayCount = ApiKeyUsage::where('keyId', $key->id)->where('day', $day)->value('count');
        $todayCount = $todayCount === null ? 0 : (int) $todayCount;

        if ($key->dailyCap !== null && $todayCount >= (int) $key->dailyCap) {
            return [
                'ok' => false,
                'status' => 429,
                'error' => "Daily limit reached for this key ({$key->dailyCap} requests per day). The counter resets at midnight UTC. Raise the cap in Settings or wait for the reset.",
                'userId' => (string) $key->user->id,
                'keyId' => (string) $key->id,
                'keyName' => (string) $key->name,
            ];
        }

        // Usage bookkeeping rides after the response; it must never slow the
        // request down (the original did the same with void promises).
        defer(function () use ($key, $day) {
            try {
                ApiKey::whereKey($key->id)->update(['lastUsedAt' => now()]);
                ApiKey::whereKey($key->id)->increment('requestCount');
                $existing = ApiKeyUsage::where('keyId', $key->id)->where('day', $day)->exists();
                if ($existing) {
                    ApiKeyUsage::where('keyId', $key->id)->where('day', $day)->increment('count');
                } else {
                    ApiKeyUsage::create(['keyId' => (string) $key->id, 'day' => $day, 'count' => 1]);
                }
            } catch (\Throwable $e) {
                Log::warning('api key usage bookkeeping failed: ' . $e->getMessage());
            }
        });

        return [
            'ok' => true,
            'status' => 200,
            'userId' => (string) $key->user->id,
            'keyId' => (string) $key->id,
            'keyName' => (string) $key->name,
            'actorEmail' => (string) $key->user->email,
            'user' => $key->user,
        ];
    }

    /** Pretty-printed JSON with CORS headers, same contract as v1Json(). */
    public static function v1Json(mixed $data, int $status = 200): JsonResponse
    {
        return new JsonResponse(
            $data,
            $status,
            self::V1_CORS_HEADERS,
            JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
        );
    }

    /** @param array<string, mixed> $extra */
    public static function v1Error(string $error, int $status, array $extra = []): JsonResponse
    {
        return self::v1Json(array_merge(['ok' => false, 'error' => $error], $extra), $status);
    }

    /** New ApiKey row for a user (raw key is returned exactly once). */
    public static function issue(int|string $userId, string $name, ?int $dailyCap = null): array
    {
        $raw = self::createRawApiKey();

        $key = ApiKey::create([
            'userId' => (string) $userId,
            'name' => $name,
            'prefix' => self::keyPrefixOf($raw),
            'keyHash' => self::hashApiKey($raw),
            'requestCount' => 0,
            'dailyCap' => $dailyCap,
        ]);

        return ['raw' => $raw, 'key' => $key, 'id' => (string) $key->id];
    }

    /** ULID helper kept here so callers do not need Str directly. */
    public static function newId(): string
    {
        return (string) Str::ulid();
    }
}
