<?php

return [

    'default' => env('MAIL_MAILER', 'smtp'),

    'mailers' => [
        'smtp' => [
            'transport' => 'smtp',
            'scheme' => env('MAIL_SCHEME'),
            'url' => env('MAIL_URL'),
            'host' => env('MAIL_HOST', '127.0.0.1'),
            'port' => env('MAIL_PORT', 2525),
            'username' => env('MAIL_USERNAME'),
            'password' => env('MAIL_PASSWORD'),
            'timeout' => null,
            'local_domain' => env('MAIL_EHLO_DOMAIN', parse_url((string) env('APP_URL', 'http://localhost'), PHP_URL_HOST) ?: 'localhost'),
            'encryption' => env('MAIL_ENCRYPTION', 'tls'),
        ],

        // Admin-configured SMTP from /manage/settings is merged in at runtime
        // by App\Services\MailConfigService.
        'admin' => [
            'transport' => 'smtp',
            'host' => 'localhost',
            'port' => 587,
            'encryption' => 'tls',
            'username' => null,
            'password' => null,
            'timeout' => null,
        ],

        'ses' => [
            'transport' => 'ses',
        ],

        'log' => [
            'transport' => 'log',
            'channel' => env('MAIL_LOG_CHANNEL'),
        ],

        'failover' => [
            'transport' => 'failover',
            'mailers' => [
                'smtp',
                'log',
            ],
        ],
    ],

    'from' => [
        'address' => env('MAIL_FROM_ADDRESS', 'support@adaudit.app'),
        'name' => env('MAIL_FROM_NAME', 'Audit Form'),
    ],

];
