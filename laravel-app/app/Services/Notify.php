<?php

namespace App\Services;

use App\Models\Notification;
use Illuminate\Support\Facades\Log;

/**
 * Port of src/lib/notify.ts - fire-and-forget in-app notification.
 * A notification failure must never break the caller's flow.
 */
class Notify
{
    public const TYPES = ['AUDIT', 'PAYMENT', 'WITHDRAWAL', 'MESSAGE', 'SYSTEM'];

    public static function send(int|string $userId, string $type, string $title, string $body, ?string $link = null): void
    {
        try {
            Notification::create([
                'userId' => $userId,
                'type' => $type,
                'title' => $title,
                'body' => $body,
                'link' => $link ?: null,
                'read' => false,
            ]);
        } catch (\Throwable $e) {
            Log::error('notify failed: ' . $e->getMessage());
        }
    }
}
