<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Port of src/lib/credits.ts - atomic credit accounting plus a simple
 * cache-backed rate limiter.
 */
class Credits
{
    public static function getCosts(): array
    {
        return Settings::costs();
    }

    /** Atomically deduct credits. Returns false when the balance is insufficient. */
    public static function deduct(int|string $userId, int $amount): bool
    {
        if ($amount <= 0) {
            return true;
        }
        $res = User::whereKey($userId)
            ->where('credits', '>=', $amount)
            ->decrement('credits', $amount);

        return $res > 0;
    }

    public static function add(int|string $userId, int $amount): void
    {
        if ($amount === 0) {
            return;
        }
        User::whereKey($userId)->increment('credits', $amount);
    }

    public static function balance(int|string $userId): int
    {
        return (int) (User::find($userId)->credits ?? 0);
    }

    // ---------- simple rate limiter (file-cache backed) ----------

    public static function rateLimit(string $key, int $limit, int $windowMs): array
    {
        $bucket = 'rl:' . sha1($key);
        $now = now()->getTimestampMs();
        $entry = Cache::get($bucket);

        if (! is_array($entry) || $now > ($entry['resetAt'] ?? 0)) {
            Cache::put($bucket, ['count' => 1, 'resetAt' => $now + $windowMs],
                now()->addMilliseconds($windowMs)->addSeconds(2));

            return ['ok' => true];
        }
        if ($entry['count'] >= $limit) {
            return ['ok' => false, 'retryAfter' => (int) ceil(($entry['resetAt'] - $now) / 1000)];
        }
        $entry['count']++;
        Cache::put($bucket, $entry, now()->addMilliseconds($windowMs)->addSeconds(2));

        return ['ok' => true];
    }

    public static function clientIp(Request $request): string
    {
        $fwd = $request->headers->get('x-forwarded-for');
        if ($fwd) {
            return trim(explode(',', $fwd)[0]);
        }

        return $request->headers->get('x-real-ip') ?? $request->ip() ?? 'unknown';
    }
}
