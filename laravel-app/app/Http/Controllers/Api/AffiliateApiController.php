<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AffiliateEarning;
use App\Models\User;
use App\Models\Withdrawal;
use App\Services\Activity;
use App\Services\Credits;
use App\Services\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/** Port of src/app/api/affiliate/route.ts. */
class AffiliateApiController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $referred = User::where('referredById', $user->id)->count();
        $earnings = AffiliateEarning::where('userId', $user->id)->orderBy('createdAt', 'desc')->limit(30)->get();
        $withdrawals = Withdrawal::where('userId', $user->id)->orderBy('createdAt', 'desc')->limit(15)->get();

        $sum = function (string $status) use ($earnings): float {
            return (float) $earnings->where('status', $status)->sum('amount');
        };
        $site = Settings::site();

        return response()->json([
            'referralCode' => $user->referralCode,
            'rate' => $site['affiliateRate'] ?? 20,
            'minWithdraw' => $site['minWithdrawUsd'] ?? 10,
            'referred' => $referred,
            'totals' => [
                'pending' => $sum('PENDING'),
                'cleared' => $sum('CLEARED'),
                'paid' => $sum('PAID'),
            ],
            'earnings' => $earnings,
            'withdrawals' => $withdrawals,
        ]);
    }

    public function withdraw(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }
        $ip = Credits::clientIp($request);
        if (! Credits::rateLimit('withdraw:' . $ip, 5, 30 * 60000)['ok']) {
            return response()->json(['error' => 'Too many requests. Try later.'], 429);
        }

        $body = $request->json()->all();
        if (is_array($body) && isset($body['account']) && is_string($body['account'])) {
            $body['account'] = trim($body['account']);
        }

        // z.object({ amount: number min1, method: enum, account: trim min6 max120 })
        $validator = Validator::make($body, [
            'amount' => ['required', 'numeric', 'min:1'],
            'method' => ['required', 'in:bkash,nagad,rocket,payoneer'],
            'account' => ['required', 'string', 'min:6', 'max:120'],
        ]);
        if ($validator->fails()) {
            return response()->json(['error' => 'Fill the withdrawal form correctly.'], 400);
        }
        $data = $validator->validated();
        $amount = (float) $data['amount'];

        $site = Settings::site();
        $minWithdraw = (float) ($site['minWithdrawUsd'] ?? 10);
        if ($amount < $minWithdraw) {
            return response()->json(['error' => sprintf('Minimum withdrawal is $%s.', rtrim(rtrim(number_format($minWithdraw, 2, '.', ''), '0'), '.'))], 400);
        }

        $available = (float) (AffiliateEarning::where('userId', $user->id)->where('status', 'CLEARED')->sum('amount') ?: 0);
        if ($amount > $available) {
            return response()->json(['error' => sprintf('Available cleared balance is $%.2f.', $available)], 400);
        }

        $remaining = $amount;
        $rows = AffiliateEarning::where('userId', $user->id)->where('status', 'CLEARED')->orderBy('createdAt', 'asc')->get();
        foreach ($rows as $row) {
            if ($remaining <= 0) {
                break;
            }
            $row->forceFill(['status' => 'PAID'])->save();
            $remaining -= (float) $row->amount;
        }

        Withdrawal::create([
            'userId' => $user->id,
            'amount' => $amount,
            'method' => $data['method'],
            'account' => $data['account'],
            'status' => 'PENDING',
        ]);

        Activity::log([
            'action' => 'WITHDRAW_REQUEST',
            'actorEmail' => $user->email,
            'userId' => $user->id,
            'detail' => '$' . number_format($amount, 2) . ' via ' . $data['method'],
            'ip' => $ip,
        ]);

        return response()->json(['ok' => true, 'message' => 'Withdrawal requested. Payouts are processed within 3 business days.']);
    }
}
