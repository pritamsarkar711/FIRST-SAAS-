<?php

namespace App\Services;

use App\Models\ActivityLog;
use Illuminate\Support\Facades\Log;

/**
 * Port of src/lib/activity.ts - fire-and-forget audit trail writer.
 * A logging failure must never break the user-facing action.
 */
class Activity
{
    public static function log(array $entry): void
    {
        try {
            ActivityLog::create([
                'action' => (string) $entry['action'],
                'actorEmail' => mb_substr((string) ($entry['actorEmail'] ?? 'unknown'), 0, 320),
                'userId' => $entry['userId'] ?? null,
                'detail' => isset($entry['detail']) ? mb_substr((string) $entry['detail'], 0, 500) : null,
                'ip' => $entry['ip'] ?? null,
            ]);
        } catch (\Throwable $e) {
            Log::warning('activity log failed: ' . $e->getMessage());
        }
    }
}
