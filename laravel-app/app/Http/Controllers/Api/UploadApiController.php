<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Port of src/app/api/upload/route.ts.
 *
 * DEVIATION: the original wrote directly into public/uploads and returned
 * /uploads/<name>; the Laravel port stores through the public disk at
 * storage/app/public/generated/<jobId>/<name> and returns the same-shaped
 * public URL /storage/generated/<jobId>/<name>.
 * NOTE: requires `php artisan storage:link` once after deploy.
 */
class UploadApiController extends Controller
{
    private const ALLOWED = [
        'image/png' => 'png',
        'image/jpeg' => 'jpg',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
    ];

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $file = $request->file('file');
        if (! $file) {
            return response()->json(['error' => 'No file received.'], 400);
        }
        if ($file->getSize() > 3 * 1024 * 1024) {
            return response()->json(['error' => 'Images must be under 3 MB.'], 400);
        }
        $ext = self::ALLOWED[$file->getMimeType() ?? ''] ?? null;
        if ($ext === null) {
            return response()->json(['error' => 'Only PNG, JPG, WebP and GIF images are allowed.'], 400);
        }

        $jobId = (string) Str::ulid();
        $name = now()->getTimestampMs() . '-' . bin2hex(random_bytes(6)) . '.' . $ext;
        $file->storeAs("generated/{$jobId}", $name, 'public');

        return response()->json(['ok' => true, 'url' => "/storage/generated/{$jobId}/{$name}"]);
    }
}
