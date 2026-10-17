<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Activity;
use App\Services\MailConfig;
use App\Services\Prompts;
use App\Services\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * Port of src/app/api/admin/settings/route.ts (+ settings/test-email).
 *
 * GET   /api/admin/settings             -> show
 * PATCH /api/admin/settings             -> update (key/value save; the
 *                                         original client POSTed the same body)
 * POST  /api/admin/settings/test-email  -> testEmail
 *
 * Note: the original also exposed PUT /api/admin/settings to test the
 * OpenRouter key; routes/web.php declares no PUT route, so that probe is not
 * wired here (flagged in the worklog).
 */
class SettingsController extends Controller
{
    public function show(): JsonResponse
    {
        $site = Settings::get('site', Settings::siteDefaults());
        $ai = Settings::get('ai', Settings::aiDefaults());
        $costs = Settings::get('costs', Settings::costsDefaults());
        $google = Settings::get('google', Settings::googleDefaults());
        $smtp = Settings::get('smtp', Settings::smtpDefaults());
        $prompts = Settings::get('prompts', Prompts::defaults());
        $indexnow = Settings::get('indexnow', ['key' => '']);
        $monitorLimitFree = Settings::get('monitorLimitFree', 1);
        $digest = Settings::get('monitorDigest', ['enabled' => false, 'lastSentAt' => '']);

        return response()->json([
            'site' => $site,
            'ai' => $ai,
            'costs' => $costs,
            'google' => $google,
            'smtp' => $smtp,
            'prompts' => $prompts,
            'indexnow' => $indexnow,
            'monitor' => [
                'monitorLimitFree' => $monitorLimitFree,
                'digestEnabled' => (bool) ($digest['enabled'] ?? false),
                'lastSentAt' => (string) ($digest['lastSentAt'] ?? ''),
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();

        $data = $request->json()->all();
        if (! is_array($data)) {
            return response()->json(['error' => 'Invalid settings payload.'], 400);
        }

        $validator = Validator::make($data, [
            'key' => ['required', 'in:site,ai,costs,google,smtp,prompts,indexnow,monitor'],
            'value' => ['required', 'array'],
        ]);
        if ($validator->fails()) {
            return response()->json(['error' => 'Invalid settings payload.'], 400);
        }

        /** @var string $key */
        $key = $validator->validated()['key'];
        /** @var array $value */
        $value = $validator->validated()['value'];

        if ($key === 'monitor') {
            // The monitoring tab spans two stored settings; never clobber the digest cadence timestamp.
            $rawLimit = $value['monitorLimitFree'] ?? null;
            $limit = is_numeric($rawLimit) ? (float) $rawLimit : NAN;
            if (! is_finite($limit) || $limit < 0 || $limit > 50) {
                return response()->json(['error' => 'Free-plan monitor limit must be between 0 and 50.'], 400);
            }
            $limit = (int) round($limit);
            $digest = Settings::get('monitorDigest', ['enabled' => false, 'lastSentAt' => '']);
            Settings::set('monitorLimitFree', $limit);
            $digest['enabled'] = (bool) ($value['digestEnabled'] ?? false);
            Settings::set('monitorDigest', $digest);

            Activity::log([
                'action' => 'SETTINGS_SAVE',
                'actorEmail' => $admin->email,
                'detail' => 'Updated monitoring settings (free limit ' . $limit . ', digest ' . (! empty($value['digestEnabled']) ? 'on' : 'off') . ')',
            ]);

            return response()->json(['ok' => true]);
        }

        Settings::set($key, $value);
        Activity::log([
            'action' => 'SETTINGS_SAVE',
            'actorEmail' => $admin->email,
            'detail' => "Updated {$key} settings",
        ]);

        return response()->json(['ok' => true]);
    }

    /** Admin "send a test email" button: verifies the SMTP credentials above actually deliver. */
    public function testEmail(Request $request): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();

        $to = trim((string) ($request->json('to') ?? ''));
        if ($to === '') {
            // Default to the admin's own mailbox when no recipient is typed.
            $to = (string) $admin->email;
        }
        if (! filter_var($to, FILTER_VALIDATE_EMAIL)) {
            return response()->json(['error' => 'Enter a valid email address.'], 400);
        }

        $smtp = Settings::get('smtp', ['host' => '', 'port' => 587, 'user' => '', 'pass' => '', 'from' => '']);
        if (($smtp['host'] ?? '') === '' || ($smtp['user'] ?? '') === '' || ($smtp['pass'] ?? '') === '') {
            return response()->json([
                'ok' => false,
                'message' => 'SMTP is not configured yet. Fill in the host, user and password above and save first.',
            ]);
        }

        $sentAt = now()->toIso8601String();
        $sent = MailConfig::send(
            $to,
            'Audit Form test email',
            "This is a test email from your Audit Form SMTP settings. If you are reading this, outgoing email works.\n\nSent " . $sentAt
        );

        if (! $sent) {
            $message = 'The mail server rejected the connection.';
            Activity::log([
                'action' => 'SMTP_TEST',
                'actorEmail' => $admin->email,
                'detail' => 'FAILED to ' . $to . ': ' . mb_substr($message, 0, 200),
            ]);

            return response()->json(['ok' => false, 'message' => 'Send failed: ' . $message]);
        }

        Activity::log([
            'action' => 'SMTP_TEST',
            'actorEmail' => $admin->email,
            'detail' => 'Test email delivered to ' . $to,
        ]);

        return response()->json([
            'ok' => true,
            'message' => 'Test email delivered to ' . $to . '. Ask them to check spam if it does not appear.',
        ]);
    }
}
