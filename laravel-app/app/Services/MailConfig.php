<?php

namespace App\Services;

use Illuminate\Support\Facades\Mail;

/**
 * Sends email through the SMTP credentials configured by the admin in
 * /manage/settings (the original app used Nodemailer with the same values).
 */
class MailConfig
{
    public static function configured(): bool
    {
        $s = Settings::smtp();

        return ($s['host'] ?? '') !== '' && ($s['user'] ?? '') !== '';
    }

    public static function send(string $to, string $subject, string $body): bool
    {
        try {
            $s = Settings::smtp();
            $port = (int) ($s['port'] ?? 587);

            config([
                'mail.mailers.admin.host' => $s['host'],
                'mail.mailers.admin.port' => $port ?: 587,
                'mail.mailers.admin.username' => $s['user'],
                'mail.mailers.admin.password' => $s['pass'],
                'mail.mailers.admin.encryption' => $port === 465 ? 'ssl' : 'tls',
                'mail.from.address' => ($s['from'] ?? '') ?: config('mail.from.address'),
                'mail.from.name' => Settings::site()['name'] ?? 'Audit Form',
            ]);

            Mail::mailer('admin')->raw($body, function ($message) use ($to, $subject) {
                $message->to($to)->subject($subject);
            });

            return true;
        } catch (\Throwable) {
            return false;
        }
    }
}
