<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Scheduled tasks (Hostinger cron: * * * * * php artisan schedule:run)
Schedule::command('watchlist:tick')->everyTenMinutes();
