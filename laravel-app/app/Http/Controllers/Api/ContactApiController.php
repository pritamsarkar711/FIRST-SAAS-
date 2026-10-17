<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use App\Services\Credits;
use App\Services\MailConfig;
use App\Services\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/** Port of src/app/api/contact/route.ts. */
class ContactApiController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $ip = Credits::clientIp($request);
        if (! Credits::rateLimit('contact:' . $ip, 5, 10 * 60000)['ok']) {
            return response()->json(['error' => 'Too many messages. Try again in a few minutes.'], 429);
        }

        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'email' => ['required', 'email', 'max:190'],
            'reason' => ['required', 'string', 'max:80'],
            'message' => ['required', 'string', 'min:10', 'max:4000'],
        ]);
        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()->first() ?: 'Invalid input'], 400);
        }

        $user = $request->user();
        $msg = ContactMessage::create([
            'userId' => $user?->id,
            'name' => $validator->validated()['name'],
            'email' => strtolower($validator->validated()['email']),
            'reason' => $validator->validated()['reason'],
            'message' => $validator->validated()['message'],
        ]);

        // Best-effort notification email to support
        $support = (string) (Settings::site()['supportEmail'] ?? '');
        if ($support !== '' && MailConfig::configured()) {
            MailConfig::send(
                $support,
                'New contact message: ' . $msg->reason,
                "From: {$msg->name} <{$msg->email}>\nReason: {$msg->reason}\n\n{$msg->message}"
            );
        }

        return response()->json(['ok' => true]);
    }
}
