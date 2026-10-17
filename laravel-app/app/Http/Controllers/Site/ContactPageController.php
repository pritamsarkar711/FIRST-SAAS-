<?php

namespace App\Http\Controllers\Site;

use App\Http\Controllers\Controller;
use Inertia\Inertia;
use Inertia\Response;

class ContactPageController extends Controller
{
    public function __invoke(): Response
    {
        return Inertia::render('Site/Contact', [
            'supportEmail' => (string) (\App\Services\Settings::site()['supportEmail'] ?? 'support@adaudit.app'),
        ]);
    }
}
