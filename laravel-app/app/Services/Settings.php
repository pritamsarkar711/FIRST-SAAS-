<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Port of src/lib/settings.ts - JSON settings stored in the settings table
 * with in-memory caching and typed defaults. AI/SMTP/gateway config lives
 * here (admin panel), NOT in env vars - same as the original app.
 */
class Settings
{
    /** In-memory per-request cache (15s TTL, same as the original). */
    private static array $mem = [];

    public static function get(string $key, mixed $fallback): mixed
    {
        $hit = self::$mem[$key] ?? null;
        if ($hit && (now()->getTimestampMs() - $hit['at']) < 15000) {
            return $hit['value'];
        }
        try {
            $row = Setting::find($key);
            if (! $row) {
                return $fallback;
            }
            $value = json_decode((string) $row->value, true);
            self::$mem[$key] = ['value' => $value, 'at' => now()->getTimestampMs()];

            return $value;
        } catch (\Throwable) {
            return $fallback;
        }
    }

    public static function set(string $key, mixed $value): void
    {
        Setting::updateOrCreate(['key' => $key], ['value' => json_encode($value)]);
        unset(self::$mem[$key]);
    }

    public static function invalidate(?string $key = null): void
    {
        if ($key) {
            unset(self::$mem[$key]);
        } else {
            self::$mem = [];
        }
    }

    // ---------- typed shapes (identical to settings.ts) ----------

    public static function siteDefaults(): array
    {
        return [
            'name' => 'Audit Form',
            'tagline' => 'Know your AdSense approval odds before you apply.',
            'supportEmail' => 'support@adaudit.app',
            'usdBdt' => 122,
            'usdBdtAuto' => true,
            'affiliateRate' => 20,
            'minWithdrawUsd' => 10,
        ];
    }

    public static function aiDefaults(): array
    {
        return [
            'openrouterKey' => '',
            'models' => [
                'normal' => 'google/gemini-2.5-flash',
                'standard' => 'openai/gpt-4.1',
                'premium' => 'anthropic/claude-sonnet-4',
            ],
            'writerModels' => [
                'standard' => 'openai/gpt-4.1',
                'premium' => 'anthropic/claude-sonnet-4',
            ],
        ];
    }

    public static function costsDefaults(): array
    {
        return [
            'audit' => ['normal' => 5, 'standard' => 12, 'premium' => 25],
            'deepScan' => 6,
            'writer' => ['standard' => 15, 'premium' => 35],
            'index' => 2,
            'signupBonus' => 10,
        ];
    }

    public static function googleDefaults(): array
    {
        return ['clientId' => '', 'clientSecret' => ''];
    }

    public static function smtpDefaults(): array
    {
        return ['host' => '', 'port' => 587, 'user' => '', 'pass' => '', 'from' => ''];
    }

    public static function site(): array
    {
        return self::get('site', self::siteDefaults());
    }

    public static function ai(): array
    {
        return self::get('ai', self::aiDefaults());
    }

    public static function costs(): array
    {
        return self::get('costs', self::costsDefaults());
    }

    public static function google(): array
    {
        return self::get('google', self::googleDefaults());
    }

    public static function smtp(): array
    {
        return self::get('smtp', self::smtpDefaults());
    }

    /** Google OAuth credentials: env wins over admin settings. */
    public static function googleCredentials(): array
    {
        $g = self::google();

        return [
            'clientId' => (string) (config('services.google.client_id') ?: ($g['clientId'] ?? '')),
            'clientSecret' => (string) (config('services.google.client_secret') ?: ($g['clientSecret'] ?? '')),
        ];
    }

    public static function googleEnabled(): bool
    {
        $c = self::googleCredentials();

        return $c['clientId'] !== '' && $c['clientSecret'] !== '';
    }

    // ---------- FX rate (cached 1h, same source as the original) ----------

    public static function usdBdt(?array $site = null): float
    {
        $s = $site ?? self::site();
        if (! ($s['usdBdtAuto'] ?? true)) {
            return (float) ($s['usdBdt'] ?? 122);
        }

        return (float) Cache::remember('usd_bdt_rate', 3600, function () use ($s) {
            try {
                $res = Http::timeout(6)->get('https://open.er-api.com/v6/latest/USD')->json();
                $rate = (float) ($res['rates']['BDT'] ?? 0);
                if ($rate > 50 && $rate < 300) {
                    return $rate;
                }
            } catch (\Throwable) {
                // offline - fall through
            }

            return (float) ($s['usdBdt'] ?? 122);
        });
    }
}
