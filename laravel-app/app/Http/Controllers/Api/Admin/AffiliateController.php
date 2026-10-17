<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AffiliateEarning;
use App\Models\Notification;
use App\Models\Withdrawal;
use App\Services\Activity;
use App\Services\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * Port of src/app/api/admin/affiliate/route.ts.
 * GET   -> index (rate + latest earnings/withdrawals)
 * PATCH -> update (setRate | withdrawal decision), same JSON body the
 * original POST handler received.
 */
class AffiliateController extends Controller
{
    public function index(): JsonResponse
    {
        $site = Settings::site();

        $earnings = AffiliateEarning::orderByDesc('createdAt')
            ->limit(60)
            ->with(['user:id,email', 'fromUser:id,email'])
            ->get(['id', 'userId', 'fromUserId', 'paymentId', 'amount', 'status', 'createdAt']);

        $withdrawals = Withdrawal::orderByDesc('createdAt')
            ->limit(60)
            ->with('user:id,email')
            ->get(['id', 'userId', 'amount', 'method', 'account', 'status', 'note', 'reviewedAt', 'createdAt']);

        return response()->json([
            'rate' => (float) ($site['affiliateRate'] ?? 20),
            'earnings' => $earnings->map(function (AffiliateEarning $e) {
                return [
                    'id' => $e->id,
                    'amount' => (float) $e->amount,
                    'status' => $e->status,
                    'createdAt' => $e->createdAt,
                    'user' => $e->user ? ['email' => $e->user->email] : null,
                    'fromUser' => $e->fromUser ? ['email' => $e->fromUser->email] : null,
                ];
            }),
            'withdrawals' => $withdrawals->map(function (Withdrawal $w) {
                return [
                    'id' => $w->id,
                    'amount' => (float) $w->amount,
                    'method' => $w->method,
                    'account' => $w->account,
                    'status' => $w->status,
                    'createdAt' => $w->createdAt,
                    'user' => $w->user ? ['email' => $w->user->email] : null,
                ];
            }),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        /** @var \App\Models\User $admin */
        $admin = $request->user();

        $data = $request->json()->all();
        if (! is_array($data)) {
            return response()->json(['error' => 'Invalid action.'], 400);
        }

        $validator = Validator::make($data, [
            'action' => ['required', 'in:setRate,withdrawal'],
            'rate' => ['nullable', 'numeric', 'min:0', 'max:90'],
            'id' => ['nullable', 'string'],
            'decision' => ['nullable', 'in:approve,reject,complete'],
        ]);
        if ($validator->fails()) {
            return response()->json(['error' => 'Invalid action.'], 400);
        }
        $d = $validator->validated();

        if ($d['action'] === 'setRate' && isset($d['rate'])) {
            $site = Settings::site();
            $oldRate = $site['affiliateRate'] ?? 20;
            $site['affiliateRate'] = (float) $d['rate'];
            Settings::set('site', $site);

            Activity::log([
                'action' => 'SETTINGS_SAVE',
                'actorEmail' => $admin->email,
                'detail' => "Affiliate commission rate set to {$d['rate']}% (was {$oldRate}%)",
            ]);

            return response()->json(['ok' => true]);
        }

        if ($d['action'] === 'withdrawal' && ! empty($d['id']) && ! empty($d['decision'])) {
            $w = Withdrawal::find($d['id']);
            if (! $w) {
                return response()->json(['error' => 'Withdrawal not found.'], 404);
            }
            $decision = $d['decision'];
            $amount = number_format((float) $w->amount, 2);
            $log = function (string $action, string $title) use ($admin, $w, $amount) {
                Activity::log([
                    'action' => $action,
                    'actorEmail' => $admin->email,
                    'userId' => $w->userId,
                    'detail' => '$' . $amount . ' via ' . $w->method . ' to ' . $w->account . ' · ' . $title,
                ]);
            };

            if ($decision === 'reject') {
                // Return the money to cleared balance
                AffiliateEarning::create([
                    'userId' => $w->userId,
                    'fromUserId' => $w->userId,
                    'amount' => $w->amount,
                    'status' => 'CLEARED',
                ]);
                $w->forceFill(['status' => 'REJECTED', 'reviewedAt' => now()])->save();
                $this->notify(
                    $w->userId,
                    'WITHDRAWAL',
                    'Withdrawal rejected',
                    'Your $' . $amount . ' withdrawal was rejected and the amount was returned to your cleared balance.',
                    '/dashboard/affiliate'
                );
                $log('WITHDRAW_REJECT', 'rejected');
            } elseif ($decision === 'approve') {
                $w->forceFill(['status' => 'PROCESSING', 'reviewedAt' => now()])->save();
                $this->notify(
                    $w->userId,
                    'WITHDRAWAL',
                    'Withdrawal processing',
                    'Your $' . $amount . ' withdrawal via ' . $w->method . ' is being processed. Payouts arrive within 3 business days.',
                    '/dashboard/affiliate'
                );
                $log('WITHDRAW_APPROVE', 'approved');
            } else {
                $w->forceFill(['status' => 'COMPLETED', 'reviewedAt' => now()])->save();
                $this->notify(
                    $w->userId,
                    'WITHDRAWAL',
                    'Withdrawal paid',
                    'Your $' . $amount . ' withdrawal via ' . $w->method . ' has been sent to ' . $w->account . '.',
                    '/dashboard/affiliate'
                );
                $log('WITHDRAW_COMPLETE', 'completed');
            }

            return response()->json(['ok' => true]);
        }

        return response()->json(['error' => 'Invalid action.'], 400);
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
