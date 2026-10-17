<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use App\Models\Notification;
use App\Services\MailConfig;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * Port of src/app/api/admin/messages/route.ts.
 * GET   -> index
 * PATCH -> update (reply | close), same JSON body the original POST handler
 * received. Replying stores the reply, notifies the user in-app and emails
 * it through the configured SMTP (App\Services\MailConfig replaces the
 * original's inline Nodemailer transport; SMTP errors stay non-fatal).
 */
class MessagesController extends Controller
{
    public function index(): JsonResponse
    {
        $messages = ContactMessage::orderByDesc('createdAt')
            ->limit(100)
            ->get(['id', 'userId', 'name', 'email', 'reason', 'message', 'status', 'reply', 'repliedAt', 'createdAt']);

        return response()->json(['messages' => $messages]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->json()->all();
        if (! is_array($data)) {
            return response()->json(['error' => 'Invalid action.'], 400);
        }

        $validator = Validator::make($data, [
            'id' => ['required', 'string', 'min:1'],
            'action' => ['required', 'in:reply,close'],
            'reply' => ['nullable', 'string', 'max:4000'],
        ]);
        if ($validator->fails()) {
            return response()->json(['error' => 'Invalid action.'], 400);
        }
        $d = $validator->validated();

        $msg = ContactMessage::find($d['id']);
        if (! $msg) {
            return response()->json(['error' => 'Message not found.'], 404);
        }

        if ($d['action'] === 'reply') {
            $reply = (string) ($d['reply'] ?? '');
            $msg->forceFill([
                'reply' => $reply,
                'status' => 'REPLIED',
                'repliedAt' => now(),
            ])->save();

            if ($msg->userId) {
                $this->notify(
                    $msg->userId,
                    'MESSAGE',
                    'Support replied',
                    'We replied to your "' . $msg->reason . '" message. Check the answer from support.',
                    '/contact'
                );
            }

            // Email the reply if SMTP is configured (gracefully skipped otherwise)
            try {
                if ($reply !== '' && MailConfig::configured()) {
                    MailConfig::send(
                        $msg->email,
                        'Re: ' . $msg->reason . ' — Audit Form support',
                        $reply
                    );
                }
            } catch (\Throwable) {
                // SMTP errors are non-fatal; reply is stored in the panel
            }

            return response()->json(['ok' => true]);
        }

        $msg->forceFill(['status' => 'CLOSED'])->save();

        return response()->json(['ok' => true]);
    }

    /** Fire-and-forget in-app notification (port of src/lib/notify.ts). */
    private function notify(?string $userId, string $type, string $title, string $body, ?string $link = null): void
    {
        try {
            if ($userId) {
                Notification::create([
                    'userId' => $userId,
                    'type' => $type,
                    'title' => $title,
                    'body' => $body,
                    'link' => $link,
                ]);
            }
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
