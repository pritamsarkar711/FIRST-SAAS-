<?php

namespace App\Services;

use App\Models\AffiliateEarning;
use App\Models\Payment;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Port of src/lib/payments.ts - marks a payment approved exactly once:
 * grants credits, creates the subscription record and the referrer's
 * commission, and notifies the buyer. Safe to call from the admin panel and
 * from gateway callbacks alike.
 */
class Payments
{
    /**
     * @return array{ok: bool, reason?: string, status?: string, credits?: int}
     */
    public static function approvePaymentById(string $paymentId, string $actorEmail, ?string $note = null): array
    {
        /** @var Payment|null $payment */
        $payment = Payment::with('user', 'plan')->find($paymentId);
        if (! $payment) {
            return ['ok' => false, 'reason' => 'NOT_FOUND'];
        }
        if ($payment->status !== 'PENDING') {
            return ['ok' => false, 'reason' => 'ALREADY_PROCESSED', 'status' => $payment->status];
        }

        $credits = (int) ($payment->plan->credits ?? 0);

        DB::transaction(function () use ($payment, $credits, $note) {
            $payment->update([
                'status' => 'APPROVED',
                'reviewedAt' => now(),
                'note' => $note ?: null,
            ]);

            User::whereKey((string) $payment->userId)->increment('credits', $credits);

            Subscription::create([
                'userId' => (string) $payment->userId,
                'planId' => $payment->planId,
                'planName' => $payment->planName,
                'credits' => $credits,
                'status' => 'ACTIVE',
            ]);
        });

        // Referrer commission
        if ($payment->user && $payment->user->referredById) {
            $site = Settings::site();
            $rate = (float) ($site['affiliateRate'] ?? 20);
            $amount = round(((float) $payment->amount) * ($rate / 100) * 100) / 100;
            if ($amount > 0) {
                AffiliateEarning::create([
                    'userId' => (string) $payment->user->referredById,
                    'fromUserId' => (string) $payment->userId,
                    'paymentId' => (string) $payment->id,
                    'amount' => $amount,
                    'status' => 'PENDING',
                ]);
            }
        }

        Notify::send(
            (string) $payment->userId,
            'PAYMENT',
            'Payment approved',
            "Your {$payment->planName} plan payment was verified and {$credits} credits were added to your balance.",
            '/dashboard/billing'
        );

        Activity::log([
            'action' => 'PAYMENT_APPROVE',
            'actorEmail' => $actorEmail,
            'userId' => (string) $payment->userId,
            'detail' => sprintf(
                '%s · $%s · %s · +%d credits',
                $payment->planName,
                number_format((float) $payment->amount, 2, '.', ''),
                $payment->gateway,
                $credits
            ),
        ]);

        return ['ok' => true, 'credits' => $credits];
    }
}
