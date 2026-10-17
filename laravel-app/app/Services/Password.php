<?php

namespace App\Services;

use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Port of src/lib/password.ts (storage format modernised to Laravel's
 * bcrypt via Hash - fresh production database, no legacy hashes to keep).
 */
class Password
{
    public static function hash(string $password): string
    {
        return Hash::make($password);
    }

    public static function verify(string $password, ?string $stored): bool
    {
        if (! $stored) {
            return false;
        }

        return Hash::check($password, $stored);
    }

    /** Unambiguous uppercase code, same alphabet as the original. */
    public static function randomCode(int $len = 8): string
    {
        $alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        $out = '';
        for ($i = 0; $i < $len; $i++) {
            $out .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }

        return $out;
    }

    public static function referralCode(): string
    {
        return 'AD' . self::randomCode(6);
    }

    public static function randomToken(int $bytes = 24): string
    {
        return Str::random($bytes);
    }
}
