<?php

namespace Database\Seeders;

use App\Models\Plan;
use App\Models\Setting;
use App\Models\User;
use App\Services\Password;
use App\Services\Prompts;
use Illuminate\Database\Seeder;

/**
 * Port of src/lib/seed.ts - plans, gateways, default settings and the
 * first admin account (ADMIN_EMAIL / ADMIN_PASSWORD env, sandbox fallbacks).
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // ---- Admin account (change the password from /manage/settings) ----
        $email = strtolower((string) (env('ADMIN_EMAIL') ?: 'admin@adaudit.app'));
        $password = (string) (env('ADMIN_PASSWORD') ?: 'Admin@2024!');
        User::updateOrCreate(
            ['email' => $email],
            [
                'name' => 'Administrator',
                'passwordHash' => Password::hash($password),
                'role' => 'ADMIN',
                'credits' => 9999,
                'referralCode' => 'ADMIN001',
                'status' => 'ACTIVE',
            ]
        );

        // ---- Test publisher (useful demo account) ----
        if (app()->environment('local', 'testing', 'development')) {
            User::updateOrCreate(
                ['email' => 'test.publisher@example.com'],
                [
                    'name' => 'Test Publisher',
                    'passwordHash' => Password::hash('TestPass123!'),
                    'credits' => 58,
                    'referralCode' => 'ADTEST01',
                ]
            );
        }

        // ---- Plans ----
        $plans = [
            ['name' => 'Starter', 'slug' => 'starter', 'priceUsd' => 6.9, 'credits' => 60, 'sortOrder' => 1, 'monitorLimit' => 1,
                'description' => 'For a first site. Run a full audit, fix issues, re-check.',
                'features' => json_encode(['60 credits', '6 premium audits or 12 normal audits', '1 monitored domain on a schedule', 'PDF readiness reports', 'All audit modes', 'Content writer access'])],
            ['name' => 'Standard', 'slug' => 'standard', 'priceUsd' => 14.9, 'credits' => 150, 'sortOrder' => 2, 'monitorLimit' => 3, 'badge' => 'Best value',
                'description' => 'Our recommended plan. Best balance of depth and cost.',
                'features' => json_encode(['150 credits', '12 premium audits', '3 monitored domains on a schedule', '10 articles with the content writer', 'Quick index tool', 'Priority AI queue'])],
            ['name' => 'Pro', 'slug' => 'pro', 'priceUsd' => 29.9, 'credits' => 350, 'sortOrder' => 3, 'monitorLimit' => 10,
                'description' => 'For bloggers running 2 or more sites seriously.',
                'features' => json_encode(['350 credits', 'Unlimited standard audits', '10 monitored domains on a schedule', '23 premium audits', 'Premium content writer mode', 'Affiliate program access'])],
            ['name' => 'Agency', 'slug' => 'agency', 'priceUsd' => 79.0, 'credits' => 1000, 'sortOrder' => 4, 'monitorLimit' => 25,
                'description' => 'Audit client sites and scale your publishing.',
                'features' => json_encode(['1000 credits', '40 premium audits', '25 monitored domains on a schedule', 'Bulk auditing workflow', 'White-labeled PDF reports', 'Priority support'])],
        ];
        foreach ($plans as $p) {
            Plan::updateOrCreate(['slug' => $p['slug']], $p);
        }

        // ---- Gateways ----
        $png = ['bkash', 'nagad', 'rocket', 'upay', 'sslcommerz', 'shurjopay', 'aamarpay', 'mediavine', 'raptive', 'ezoic', 'paddle'];
        $gateways = [
            ['bkash', 'bKash', 'MANUAL', 1, 'Send the exact amount to our bKash merchant/personal number shown at checkout, then submit the Transaction ID (TrxID). Approval is usually within 30 minutes during business hours.'],
            ['nagad', 'Nagad', 'MANUAL', 2, 'Send Money to the Nagad number shown at checkout, then submit the Transaction ID. Approval is usually within 30 minutes.'],
            ['rocket', 'Rocket (DBBL)', 'MANUAL', 3, 'Send Money to the Rocket number shown at checkout, then submit the Transaction ID with your name.'],
            ['upay', 'Upay', 'MANUAL', 4, 'Send Money to the Upay number shown at checkout, then submit the Transaction ID.'],
            ['sslcommerz', 'SSLCommerz', 'API', 5, 'Pay with cards, mobile wallets or internet banking via SSLCommerz secure checkout.'],
            ['shurjopay', 'ShurjoPay', 'API', 6, 'Pay via ShurjoPay with cards or mobile banking.'],
            ['aamarpay', 'AamarPay', 'API', 7, 'Pay via AamarPay with cards or mobile banking.'],
            ['stripe', 'Stripe (Cards)', 'API', 8, 'Pay with Visa, Mastercard or AMEX via Stripe.'],
            ['paypal', 'PayPal', 'API', 9, 'Pay with your PayPal balance or linked card.'],
            ['paddle', 'Paddle', 'API', 10, 'Checkout with cards or PayPal via Paddle merchant of record.'],
        ];
        foreach ($gateways as [$code, $name, $mode, $order, $instructions]) {
            \App\Models\GatewayConfig::updateOrCreate(['code' => $code], [
                'name' => $name,
                'mode' => $mode,
                'instructions' => $instructions,
                'sortOrder' => $order,
                'logo' => '/logos/' . $code . '.' . (in_array($code, $png, true) ? 'png' : 'svg'),
            ]);
        }
        \App\Models\GatewayConfig::whereIn('code', ['bkash', 'nagad', 'rocket'])->update(['enabled' => true]);

        // ---- Default settings (same keys as the original settings table) ----
        $defaults = [
            'site' => \App\Services\Settings::siteDefaults(),
            'ai' => \App\Services\Settings::aiDefaults(),
            'costs' => \App\Services\Settings::costsDefaults(),
            'google' => \App\Services\Settings::googleDefaults(),
            'smtp' => \App\Services\Settings::smtpDefaults(),
            'prompts' => Prompts::defaults(),
            'indexnow' => ['key' => ''],
            'seeded' => ['at' => now()->toISOString()],
        ];
        foreach ($defaults as $key => $value) {
            Setting::updateOrCreate(['key' => $key], ['value' => json_encode($value)]);
        }
    }
}
