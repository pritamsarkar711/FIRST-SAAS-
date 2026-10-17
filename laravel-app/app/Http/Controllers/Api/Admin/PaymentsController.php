<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AffiliateEarning;
use App\Models\Notification;
use App\Models\Payment;
use App\Models\Subscription;
use App\Models\User;
use App\Services\Activity;
use App\Services\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Port of src/app/api/admin/payments/route.ts.
 *
 * GET   /api/admin/payments -> index
 * PATCH /api/admin/payments -> update (approve | reject action payload, same
 * JSON body the original POST handler received).
 *
 * The approval flow mirrors src/lib/payments.ts approvePaymentById(): grants
 * credits, creates the subscription record and the referrer's commission,
 * and notifies the buyer. If agent 18-a lands an App\Services\Payments class
 * later, this can delegate to it; the inline logic below is the 1:1 port.
 */
class PaymentsController extends Controller
{
    public function index(): JsonResponse
    {
        $payments = Payment::orderByDesc('createdAt')
            ->limit(100)
            ->with('user:id,email,name')
            ->get();

        return response()->json([
            'payments' => $payments->map(function (Payment $p) {
                return [
                    'id' => $p->id,
                    'userId' => $p->userId,
                    'planId' => $p->planId,
                    'planName' => $p->planName,
                    'amount' => (float) $p->amount,
                    'currency' => $p->currency,
                    'amountBdt' => $p->amountBdt === null ? null : (float) $p->amountBdt,
                    'gateway' => $p->gateway,
                    'senderInfo' => $p->senderInfo,
                    'txId' => $p->txId,
                    'status' => $p->status,
                    'note' => $p->note,
                    'meta' => $p->meta,
                    'reviewedAt' => $p->reviewedAt,
                    'createdAt' => $p->createdAt,
                    'user' => [
                        'email' => $p->user->email ?? '',
                        'name' => $p->user->name ?? null,
                    ],
                ];
            }),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();

        $data = $request->json()->all();
        $id = (string) ($data['id'] ?? '');
        $action = (string) ($data['action'] ?? '');
        $note = $data['note'] ?? null;
        if ($id === '' || ! in_array($action, ['approve', 'reject'], true)
            || ($note !== null && ! is_string($note)) || ($note !== null && mb_strlen($note) > 300)) {
            return response()->json(['error' => 'Invalid action.'], 400);
        }

        $payment = Payment::find($id);
        if (! $payment) {
            return response()->json(['error' => 'Payment not found.'], 404);
        }
        if ($payment->status !== 'PENDING') {
            return response()->json(['error' => 'This payment is already ' . mb_strtolower($payment->status) . '.'], 400);
        }

        if ($action === 'approve') {
            $result = $this->approvePaymentById($payment->id, $admin->email, $note ?: null);
            if (! $result['ok']) {
                return response()->json(['error' => 'Payment could not be approved.'], 400);
            }

            return response()->json(['ok' => true, 'message' => "Approved. {$result['credits']} credits added."]);
        }

        $payment->forceFill([
            'status' => 'REJECTED',
            'reviewedAt' => now(),
            'note' => $note ?: null,
        ])->save();

        $this->notify(
            $payment->userId,
            'PAYMENT',
            'Payment could not be verified',
            'Your ' . $payment->planName . ' order was rejected. ' . ($note ? 'Reason: ' . $note : 'Contact support if you believe this is a mistake.'),
            '/dashboard/billing'
        );

        Activity::log([
            'action' => 'PAYMENT_REJECT',
            'actorEmail' => $admin->email,
            'userId' => $payment->userId,
            'detail' => $payment->planName . ' · $' . number_format((float) $payment->amount, 2) . ' · ' . $payment->gateway . ($note ? ' · ' . $note : ''),
        ]);

        return response()->json(['ok' => true, 'message' => 'Payment rejected.']);
    }

    /**
     * 1:1 port of approvePaymentById from src/lib/payments.ts.
     * Marks a payment approved exactly once.
     *
     * @return array{ok: bool, credits?: int, reason?: string, status?: string}
     */
    public static function approvePaymentById(string $paymentId, string $actorEmail, ?string $note = null): array
    {
        $payment = Payment::with(['user', 'plan'])->find($paymentId);
        if (! $payment) {
            return ['ok' => false, 'reason' => 'NOT_FOUND'];
        }
        if ($payment->status !== 'PENDING') {
            return ['ok' => false, 'reason' => 'ALREADY_PROCESSED', 'status' => $payment->status];
        }

        $credits = (int) ($payment->plan->credits ?? 0);

        DB::transaction(function () use ($payment, $note, $credits) {
            $payment->forceFill([
                'status' => 'APPROVED',
                'reviewedAt' => now(),
                'note' => $note ?: null,
            ])->save();

            $buyer = User::find($payment->userId);
            if ($buyer) {
                $buyer->increment('credits', $credits);
            }

            Subscription::create([
                'userId' => $payment->userId,
                'planId' => $payment->planId,
                'planName' => $payment->planName,
                'credits' => $credits,
                'status' => 'ACTIVE',
                'startedAt' => now(),
            ]);
        });

        if ($payment->user?->referredById) {
            $site = Settings::site();
            $rate = (float) ($site['affiliateRate'] ?? 20);
            $amount = round((float) $payment->amount * ($rate / 100) * 100) / 100;
            if ($amount > 0) {
                AffiliateEarning::create([
                    'userId' => $payment->user->referredById,
                    'fromUserId' => $payment->userId,
                    'paymentId' => $payment->id,
                    'amount' => $amount,
                    'status' => 'PENDING',
                ]);
            }
        }

        (new self())->notify(
            $payment->userId,
            'PAYMENT',
            'Payment approved',
            'Your ' . $payment->planName . ' plan payment was verified and ' . $credits . ' credits were added to your balance.',
            '/dashboard/billing'
        );

        Activity::log([
            'action' => 'PAYMENT_APPROVE',
            'actorEmail' => $actorEmail,
            'userId' => $payment->userId,
            'detail' => $payment->planName . ' · $' . number_format((float) $payment->amount, 2) . ' · ' . $payment->gateway . ' · +' . $credits . ' credits',
        ]);

        return ['ok' => true, 'credits' => $credits];
    }

    /**
     * Fire-and-forget in-app notification (port of src/lib/notify.ts).
     * Never throws into caller flows.
     */
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
