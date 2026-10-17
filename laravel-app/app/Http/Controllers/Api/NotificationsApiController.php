<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Port of src/app/api/notifications/route.ts. */
class NotificationsApiController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $unreadOnly = $request->query('unread') === '1';
        $query = Notification::where('userId', $user->id);
        if ($unreadOnly) {
            $query->where('read', false);
        }
        $notifications = $query->orderBy('createdAt', 'desc')->limit(15)->get();
        $unread = Notification::where('userId', $user->id)->where('read', false)->count();

        return response()->json([
            'notifications' => $notifications,
            'unread' => $unread,
        ]);
    }

    public function markRead(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $body = $request->json()->all() ?: [];
        $id = is_array($body) ? ($body['id'] ?? null) : null;
        if ($id) {
            Notification::where('id', $id)->where('userId', $user->id)->update(['read' => true]);
        } else {
            Notification::where('userId', $user->id)->where('read', false)->update(['read' => true]);
        }

        return response()->json(['ok' => true]);
    }
}
