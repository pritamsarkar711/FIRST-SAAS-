<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Port of src/app/dashboard/settings/page.tsx (props for SettingsWorkspace). */
class SettingsPageController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Dashboard/Settings', [
            'user' => [
                'name' => $user->name ?? '',
                'email' => $user->email,
                'twoFactorEnabled' => (bool) $user->twoFactorEnabled,
            ],
        ]);
    }
}
