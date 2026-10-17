<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AffiliateEarning;
use App\Models\GatewayConfig;
use App\Models\Notification;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\Activity;
use App\Services\Credits;
use App\Services\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Port of src/app/api/billing/route.ts (index + store) and the three gateway
 * verify endpoints (stripe/paypal/sslcommerz). The shared approval flow from
 * src/lib/payments.ts (approvePaymentById) and src/lib/notify.ts (notify) is
 * inlined here with identical logic: approve -> credits grant + subscription
 * record + referrer commission + buyer notification.
 */
class BillingApiController extends Controller
{
    // ------------------------------------------------------------------
    // GET /api/billing - available gateways + FX rate
    // ------------------------------------------------------------------
    public function index(Request $request): JsonResponse
    {
        $rows = GatewayConfig::where('enabled', true)->orderBy('sortOrder', 'asc')->get();
        $rate = Settings::usdBdt();

        // API gateways only appear once the admin has stored the keys they need.
        $gateways = $rows->filter(function ($g) {
            if ($g->mode === 'MANUAL') {
                return true;
            }
            try {
                $cfg = json_decode((string) ($g->config ?? '{}'), true);
                if (! is_array($cfg)) {
                    return false;
                }
                if ($g->code === 'stripe') {
                    return isset($cfg['secretKey']) && is_string($cfg['secretKey']) && str_starts_with($cfg['secretKey'], 'sk_');
                }
                if ($g->code === 'paypal') {
                    return isset($cfg['clientId'], $cfg['clientSecret'])
                        && is_string($cfg['clientId']) && strlen($cfg['clientId']) > 8
                        && is_string($cfg['clientSecret']) && strlen($cfg['clientSecret']) > 8;
                }
                if ($g->code === 'sslcommerz') {
                    return isset($cfg['store_id'], $cfg['store_password'])
                        && is_string($cfg['store_id']) && strlen($cfg['store_id']) > 3
                        && is_string($cfg['store_password']) && strlen($cfg['store_password']) > 3;
                }

                return count($cfg) > 0;
            } catch (\Throwable) {
                return false;
            }
        })->values()
            ->map(fn ($g) => [
                'code' => $g->code,
                'name' => $g->name,
                'logo' => $g->logo,
                'mode' => $g->mode,
                'instructions' => $g->instructions,
            ])
            ->all();

        return response()->json([
            'gateways' => $gateways,
            'rate' => $rate,
            'signedIn' => (bool) $request->user(),
        ]);
    }

    // ------------------------------------------------------------------
    // POST /api/billing - create the order (and provider session for API gateways)
    // ------------------------------------------------------------------
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Please sign in first.'], 401);
        }
        $ip = Credits::clientIp($request);
        if (! Credits::rateLimit('checkout:' . $ip, 8, 10 * 60000)['ok']) {
            return response()->json(['error' => 'Too many attempts. Wait a few minutes.'], 429);
        }

        // z.object({ planId: min1, gateway: 1..40, senderInfo: trim max80 default "",
        //             txId: trim max80 default "", agreeTerms: literal(true) })
        $validator = \Illuminate\Support\Facades\Validator::make($request->json()->all(), [
            'planId' => ['required', 'string', 'min:1'],
            'gateway' => ['required', 'string', 'min:1', 'max:40'],
            'senderInfo' => ['sometimes', 'string', 'max:80'],
            'txId' => ['sometimes', 'string', 'max:80'],
            'agreeTerms' => ['required', 'accepted'],
        ]);
        if ($validator->fails()) {
            return response()->json(['error' => 'Complete every required field and accept the terms.'], 400);
        }
        $data = $validator->validated();
        $data['senderInfo'] = isset($data['senderInfo']) ? trim($data['senderInfo']) : '';
        $data['txId'] = isset($data['txId']) ? trim($data['txId']) : '';

        $plan = Plan::find($data['planId']);
        if (! $plan || ! $plan->active) {
            return response()->json(['error' => 'That plan is not available.'], 400);
        }

        $gw = GatewayConfig::where('code', $data['gateway'])->first();
        if (! $gw || ! $gw->enabled) {
            return response()->json(['error' => 'That payment method is not available.'], 400);
        }

        if ($gw->mode === 'MANUAL' && (strlen($data['txId']) < 6)) {
            return response()->json(['error' => 'Enter a valid transaction ID (TrxID) from your payment receipt.'], 400);
        }

        $rate = Settings::usdBdt();
        $payment = Payment::create([
            'userId' => $user->id,
            'planId' => $plan->id,
            'planName' => $plan->name,
            'amount' => $plan->priceUsd,
            'currency' => 'USD',
            'amountBdt' => round($plan->priceUsd * $rate * 100) / 100,
            'gateway' => $gw->code,
            'senderInfo' => $data['senderInfo'] !== '' ? $data['senderInfo'] : null,
            'txId' => $data['txId'] !== '' ? $data['txId'] : null,
            'status' => 'PENDING',
            'meta' => json_encode(['gatewayName' => $gw->name, 'mode' => $gw->mode]),
        ]);

        // API gateway: hand the customer to the provider's own checkout.
        if ($gw->mode === 'API') {
            $config = $this->gatewayConfig($gw);
            $origin = $this->requestOrigin($request);

            if ($gw->code === 'stripe') {
                if (empty($config['secretKey']) || ! str_starts_with((string) $config['secretKey'], 'sk_')) {
                    return response()->json(['error' => 'Card payments are not configured yet. Please pick another method.'], 400);
                }
                $created = $this->createStripeCheckout([
                    'secretKey' => (string) $config['secretKey'],
                    'planName' => $plan->name,
                    'priceUsd' => (float) $plan->priceUsd,
                    'credits' => (int) $plan->credits,
                    'email' => $user->email,
                    'paymentId' => $payment->id,
                    'planId' => $plan->id,
                    'origin' => $origin,
                ]);
                if (! $created['ok']) {
                    $payment->forceFill(['status' => 'REJECTED', 'note' => 'Stripe session failed: ' . $created['error']])->save();

                    return response()->json(['error' => $created['error']], 502);
                }
                $payment->forceFill([
                    'meta' => json_encode(['gatewayName' => $gw->name, 'mode' => $gw->mode, 'stripeSessionId' => $created['sessionId']]),
                ])->save();
                Activity::log([
                    'action' => 'CHECKOUT_SUBMIT',
                    'actorEmail' => $user->email,
                    'userId' => $user->id,
                    'detail' => $plan->name . ' · $' . number_format($plan->priceUsd, 2) . ' via Stripe · session ' . substr($created['sessionId'], 0, 24) . '…',
                    'ip' => $ip,
                ]);

                return response()->json(['ok' => true, 'redirectUrl' => $created['url'], 'paymentId' => $payment->id]);
            }

            if ($gw->code === 'paypal') {
                if (empty($config['clientId']) || empty($config['clientSecret'])) {
                    return response()->json(['error' => 'PayPal is not configured yet. Please pick another method.'], 400);
                }
                $created = $this->createPayPalOrder([
                    'base' => $this->paypalBase($config['env'] ?? null),
                    'clientId' => (string) $config['clientId'],
                    'clientSecret' => (string) $config['clientSecret'],
                    'planName' => $plan->name,
                    'priceUsd' => (float) $plan->priceUsd,
                    'credits' => (int) $plan->credits,
                    'paymentId' => $payment->id,
                    'planId' => $plan->id,
                    'origin' => $origin,
                ]);
                if (! $created['ok']) {
                    $payment->forceFill(['status' => 'REJECTED', 'note' => 'PayPal order failed: ' . $created['error']])->save();

                    return response()->json(['error' => $created['error']], 502);
                }
                $payment->forceFill([
                    'meta' => json_encode(['gatewayName' => $gw->name, 'mode' => $gw->mode, 'paypalOrderId' => $created['orderId']]),
                ])->save();
                Activity::log([
                    'action' => 'CHECKOUT_SUBMIT',
                    'actorEmail' => $user->email,
                    'userId' => $user->id,
                    'detail' => $plan->name . ' · $' . number_format($plan->priceUsd, 2) . ' via PayPal · order ' . substr($created['orderId'], 0, 20) . '…',
                    'ip' => $ip,
                ]);

                return response()->json(['ok' => true, 'redirectUrl' => $created['url'], 'paymentId' => $payment->id]);
            }

            if ($gw->code === 'sslcommerz') {
                if (empty($config['store_id']) || empty($config['store_password'])) {
                    return response()->json(['error' => 'SSLCommerz is not configured yet. Please pick another method.'], 400);
                }
                $created = $this->createSslCommerzSession([
                    'base' => $this->sslCommerzBase($config['env'] ?? null),
                    'storeId' => (string) $config['store_id'],
                    'storePassword' => (string) $config['store_password'],
                    'planName' => $plan->name,
                    'priceUsd' => (float) $plan->priceUsd,
                    'credits' => (int) $plan->credits,
                    'email' => $user->email,
                    'name' => (string) ($user->name ?? ''),
                    'paymentId' => $payment->id,
                    'planId' => $plan->id,
                    'origin' => $origin,
                ]);
                if (! $created['ok']) {
                    $payment->forceFill(['status' => 'REJECTED', 'note' => 'SSLCommerz session failed: ' . $created['error']])->save();

                    return response()->json(['error' => $created['error']], 502);
                }
                $payment->forceFill([
                    'meta' => json_encode(['gatewayName' => $gw->name, 'mode' => $gw->mode, 'sslSessionKey' => $created['sessionKey']]),
                ])->save();
                Activity::log([
                    'action' => 'CHECKOUT_SUBMIT',
                    'actorEmail' => $user->email,
                    'userId' => $user->id,
                    'detail' => $plan->name . ' · $' . number_format($plan->priceUsd, 2) . ' via SSLCommerz · session ' . substr($created['sessionKey'], 0, 20) . '…',
                    'ip' => $ip,
                ]);

                return response()->json(['ok' => true, 'redirectUrl' => $created['url'], 'paymentId' => $payment->id]);
            }

            return response()->json(['error' => 'That gateway is not connected yet. Please pick another method.'], 400);
        }

        Activity::log([
            'action' => 'CHECKOUT_SUBMIT',
            'actorEmail' => $user->email,
            'userId' => $user->id,
            'detail' => $plan->name . ' · $' . number_format($plan->priceUsd, 2) . ' via ' . $gw->name . ($data['txId'] !== '' ? ' · TrxID ' . $data['txId'] : ''),
            'ip' => $ip,
        ]);

        return response()->json([
            'ok' => true,
            'paymentId' => $payment->id,
            'message' => $gw->mode === 'MANUAL'
                ? 'Order received. We verify manual payments quickly during business hours. Credits appear the moment it is approved.'
                : 'Order received. Complete the payment with the provider to finish.',
        ]);
    }

    // ------------------------------------------------------------------
    // GET /api/billing/stripe/verify?payment=&session_id=
    // ------------------------------------------------------------------
    public function verifyStripe(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Please sign in first.'], 401);
        }
        $ip = Credits::clientIp($request);
        if (! Credits::rateLimit('stripverify:' . $ip, 12, 5 * 60000)['ok']) {
            return response()->json(['error' => 'Too many verification attempts.'], 429);
        }

        $paymentId = $request->query('payment');
        $sessionId = $request->query('session_id');
        if (! $paymentId || ! $sessionId) {
            return response()->json(['error' => 'Missing payment reference.'], 400);
        }

        $payment = Payment::find($paymentId);
        if (! $payment || $payment->userId !== $user->id) {
            return response()->json(['error' => 'Payment not found.'], 404);
        }

        // Fast path: already approved earlier.
        if ($payment->status === 'APPROVED') {
            return response()->json(['ok' => true, 'status' => 'APPROVED']);
        }
        if ($payment->status === 'REJECTED') {
            return response()->json(['ok' => false, 'status' => 'REJECTED', 'error' => 'This order was already rejected. Contact support.'], 400);
        }

        $gw = GatewayConfig::where('code', $payment->gateway)->first();
        if (! $gw || $gw->code !== 'stripe') {
            return response()->json(['error' => 'This payment is not a Stripe order.'], 400);
        }

        $config = $this->gatewayConfig($gw);
        $secretKey = (string) ($config['secretKey'] ?? '');
        if ($secretKey === '') {
            return response()->json(['error' => 'Card payments are not configured right now.'], 400);
        }

        // Confirm against Stripe's own record of the session.
        $paid = false;
        $amountPaid = 0;
        $mismatch = null;
        try {
            $res = Http::timeout(20)
                ->withToken($secretKey)
                ->get('https://api.stripe.com/v1/checkout/sessions/' . rawurlencode($sessionId));
            $data = $res->json() ?: [];
            if (! $res->successful()) {
                $msg = is_array($data) && isset($data['error']['message'])
                    ? mb_substr((string) $data['error']['message'], 0, 200)
                    : 'Stripe could not find that checkout session.';

                return response()->json(['error' => $msg], 502);
            }
            $clientRef = is_array($data) ? ($data['client_reference_id'] ?? null) : null;
            if (is_string($clientRef) && $clientRef !== $paymentId) {
                $mismatch = 'The checkout session belongs to a different order.';
            }
            $paymentStatus = is_array($data) ? ($data['payment_status'] ?? null) : null;
            if ($paymentStatus === 'paid') {
                $paid = true;
                $amountPaid = ((int) ($data['amount_total'] ?? 0)) / 100;
            }
            if ($paid && $payment->status === 'PENDING') {
                // persist the Stripe payment intent id for the ledger
                $payment->forceFill([
                    'meta' => json_encode([
                        'gatewayName' => $gw->name,
                        'mode' => 'API',
                        'stripeSessionId' => $sessionId,
                        'stripePaymentIntent' => $data['payment_intent'] ?? null,
                        'stripeAmountPaid' => $amountPaid,
                    ]),
                ])->save();
            }
        } catch (\Throwable) {
            return response()->json(['error' => 'Could not reach Stripe to confirm the payment. Refresh to retry.'], 502);
        }

        if (! $paid) {
            return response()->json(['ok' => true, 'status' => $payment->status, 'paid' => false, 'message' => 'Payment is not completed yet.']);
        }
        if ($mismatch) {
            Activity::log(['action' => 'STRIPE_MISMATCH', 'actorEmail' => $user->email, 'userId' => $user->id, 'detail' => $mismatch]);

            return response()->json(['error' => $mismatch . ' Contact support.'], 400);
        }

        $result = $this->approvePaymentById($payment->id, 'stripe:' . substr($sessionId, 0, 28) . '…');
        if (! $result['ok'] && ($result['reason'] ?? null) !== 'ALREADY_PROCESSED') {
            return response()->json(['error' => 'Payment verified but could not be applied. Contact support with this reference.'], 500);
        }

        return response()->json(['ok' => true, 'status' => 'APPROVED', 'paid' => true]);
    }

    // ------------------------------------------------------------------
    // GET /api/billing/paypal/verify?payment=&token=
    // ------------------------------------------------------------------
    public function verifyPaypal(Request $request)
    {
        $user = $request->user();
        if (! $user) {
            return redirect()->to('/login');
        }
        $ip = Credits::clientIp($request);
        if (! Credits::rateLimit('paypalverify:' . $ip, 12, 5 * 60000)['ok']) {
            return redirect()->to('/dashboard/billing');
        }

        $paymentId = $request->query('payment');
        $orderId = $request->query('token');
        if (! $paymentId || ! $orderId) {
            return redirect()->to('/dashboard/billing');
        }

        $payment = Payment::find($paymentId);
        if (! $payment || $payment->userId !== $user->id) {
            return redirect()->to('/dashboard/billing');
        }

        $result = $this->captureAndFinalizePaypal($paymentId, $orderId);
        if (($result['ok'] ?? false) === true) {
            Activity::log([
                'action' => 'PAYPAL_VERIFY',
                'actorEmail' => $user->email,
                'userId' => $user->id,
                'detail' => 'order ' . substr($orderId, 0, 24) . '… captured and approved',
            ]);

            return redirect()->to('/dashboard/billing/checkout/success?payment=' . $paymentId . '&pp=1&approved=1');
        }
        $note = rawurlencode(mb_substr((string) ($result['error'] ?? 'Payment failed'), 0, 180));

        return redirect()->to('/dashboard/billing/checkout/success?payment=' . $paymentId . '&pp=1&failed=1&reason=' . $note);
    }

    // ------------------------------------------------------------------
    // GET /api/billing/sslcommerz/verify?payment=&result=&val_id=...
    // ------------------------------------------------------------------
    public function verifySslcommerz(Request $request)
    {
        $user = $request->user();
        if (! $user) {
            return redirect()->to('/login');
        }
        $ip = Credits::clientIp($request);
        if (! Credits::rateLimit('sslczverify:' . $ip, 12, 5 * 60000)['ok']) {
            return redirect()->to('/dashboard/billing');
        }

        $paymentId = $request->query('payment');
        $resultParam = $request->query('result');
        if (! $paymentId) {
            return redirect()->to('/dashboard/billing');
        }

        $payment = Payment::find($paymentId);
        if (! $payment || $payment->userId !== $user->id) {
            return redirect()->to('/dashboard/billing');
        }

        // Buyer hit the fail_url, or SSLCommerz appended a failing status.
        if ($resultParam === 'fail' && $payment->status === 'PENDING') {
            $payment->forceFill(['status' => 'REJECTED', 'note' => 'SSLCommerz reported the payment failed.'])->save();

            return redirect()->to('/dashboard/billing/checkout/success?payment=' . $paymentId . '&scz=1&failed=1&reason=' . rawurlencode('SSLCommerz reported the payment failed. No charge was made.'));
        }

        // SSLCommerz appends val_id to the return URL; store it for server-side validation.
        $valId = $request->query('val_id');
        if ($valId && $payment->status === 'PENDING') {
            $payment->forceFill(['txId' => $valId])->save();
        }

        $outcome = $this->validateAndFinalizeSslcommerz($paymentId);
        if (($outcome['ok'] ?? false) === true) {
            Activity::log([
                'action' => 'SSLCZ_VERIFY',
                'actorEmail' => $user->email,
                'userId' => $user->id,
                'detail' => 'val_id ' . substr((string) ($valId ?: ($payment->txId ?? '')), 0, 24) . '… validated and approved',
            ]);

            return redirect()->to('/dashboard/billing/checkout/success?payment=' . $paymentId . '&scz=1&approved=1');
        }
        $note = rawurlencode(mb_substr((string) ($outcome['error'] ?? 'Payment failed'), 0, 180));

        return redirect()->to('/dashboard/billing/checkout/success?payment=' . $paymentId . '&scz=1&failed=1&reason=' . $note);
    }

    // ==================================================================
    // Shared approval flow (port of src/lib/payments.ts approvePaymentById)
    // ==================================================================
    private function approvePaymentById(string $paymentId, string $actorEmail, ?string $note = null): array
    {
        $payment = Payment::with(['user', 'plan'])->find($paymentId);
        if (! $payment) {
            return ['ok' => false, 'reason' => 'NOT_FOUND'];
        }
        if ($payment->status !== 'PENDING') {
            return ['ok' => false, 'reason' => 'ALREADY_PROCESSED', 'status' => $payment->status];
        }

        $credits = (int) ($payment->plan?->credits ?? 0);
        DB::transaction(function () use ($payment, $credits, $note) {
            $payment->forceFill([
                'status' => 'APPROVED',
                'reviewedAt' => now(),
                'note' => $note,
            ])->save();
            User::whereKey($payment->userId)->increment('credits', $credits);
            Subscription::create([
                'userId' => $payment->userId,
                'planId' => $payment->planId,
                'planName' => $payment->planName,
                'credits' => $credits,
                'status' => 'ACTIVE',
            ]);
        });

        $fresh = $payment->fresh(['user']);
        if ($fresh && $fresh->user && $fresh->user->referredById) {
            $site = Settings::site();
            $affiliateRate = (float) ($site['affiliateRate'] ?? 20);
            $amount = round(((float) $fresh->amount) * ($affiliateRate / 100) * 100) / 100;
            if ($amount > 0) {
                AffiliateEarning::create([
                    'userId' => $fresh->user->referredById,
                    'fromUserId' => $fresh->userId,
                    'paymentId' => $fresh->id,
                    'amount' => $amount,
                    'status' => 'PENDING',
                ]);
            }
        }

        $this->notify(
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

    /** Port of src/lib/notify.ts - fire-and-forget in-app notification. */
    private function notify(string $userId, string $type, string $title, string $body, ?string $link = null): void
    {
        try {
            Notification::create([
                'userId' => $userId,
                'type' => $type,
                'title' => $title,
                'body' => $body,
                'link' => $link,
            ]);
        } catch (\Throwable $e) {
            Log::warning('notify failed: ' . $e->getMessage());
        }
    }

    // ==================================================================
    // Gateway session builders (port of the helpers in billing/route.ts)
    // ==================================================================

    private function paypalBase(?string $env): string
    {
        return $env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
    }

    private function sslCommerzBase(?string $env): string
    {
        return $env === 'live' ? 'https://securepay.sslcommerz.com' : 'https://sandbox.sslcommerz.com';
    }

    private function gatewayConfig(GatewayConfig $gw): array
    {
        try {
            $cfg = json_decode((string) ($gw->config ?? '{}'), true);

            return is_array($cfg) ? $cfg : [];
        } catch (\Throwable) {
            return [];
        }
    }

    private function requestOrigin(Request $request): string
    {
        $host = $request->headers->get('x-forwarded-host') ?: $request->headers->get('host');
        $scheme = $request->headers->get('x-forwarded-proto') ?: $request->getScheme();
        if (! $host) {
            return $request->getSchemeAndHttpHost();
        }

        return $scheme . '://' . $host;
    }

    /** Creates a Stripe Checkout Session with the REST API (no SDK, shared-hosting friendly). */
    private function createStripeCheckout(array $o): array
    {
        $params = [
            'mode' => 'payment',
            'success_url' => $o['origin'] . '/dashboard/billing/checkout/success?payment=' . $o['paymentId'] . '&session_id={CHECKOUT_SESSION_ID}',
            'cancel_url' => $o['origin'] . '/dashboard/billing/checkout?plan=' . $o['planId'] . '&canceled=1',
            'client_reference_id' => $o['paymentId'],
            'customer_email' => $o['email'],
            'line_items[0][quantity]' => '1',
            'line_items[0][price_data][currency]' => 'usd',
            'line_items[0][price_data][unit_amount]' => (string) (int) round($o['priceUsd'] * 100),
            'line_items[0][price_data][product_data][name]' => 'Audit Form ' . $o['planName'] . ' plan',
            'line_items[0][price_data][product_data][description]' => number_format($o['credits']) . ' audit credits, one-time purchase',
        ];

        try {
            $res = Http::timeout(20)
                ->asForm()
                ->withToken($o['secretKey'])
                ->post('https://api.stripe.com/v1/checkout/sessions', $params);
            $data = $res->json() ?: [];
            if (! $res->successful() || empty($data['url']) || empty($data['id'])) {
                $msg = $data['error']['message'] ?? null;

                return ['ok' => false, 'error' => $msg ? mb_substr((string) $msg, 0, 200) : 'Stripe rejected the checkout request.'];
            }

            return ['ok' => true, 'url' => (string) $data['url'], 'sessionId' => (string) $data['id']];
        } catch (\Throwable) {
            return ['ok' => false, 'error' => 'Could not reach Stripe. Try again in a moment.'];
        }
    }

    /** OAuth2 client-credentials token for the PayPal REST API. */
    private function paypalAccessToken(string $base, string $clientId, string $clientSecret): string
    {
        $res = Http::timeout(20)
            ->asForm()
            ->withBasicAuth($clientId, $clientSecret)
            ->post($base . '/v1/oauth2/token', ['grant_type' => 'client_credentials']);
        $data = $res->json() ?: [];
        if (! $res->successful() || empty($data['access_token'])) {
            $msg = $data['error_description'] ?? null;

            throw new \RuntimeException($msg ? mb_substr((string) $msg, 0, 200) : 'PayPal rejected the API credentials.');
        }

        return (string) $data['access_token'];
    }

    /** Creates a PayPal Order and returns the approval link the buyer must visit. */
    private function createPayPalOrder(array $o): array
    {
        try {
            $token = $this->paypalAccessToken($o['base'], $o['clientId'], $o['clientSecret']);
            $res = Http::timeout(20)
                ->withToken($token)
                ->acceptJson()
                ->post($o['base'] . '/v2/checkout/orders', [
                    'intent' => 'CAPTURE',
                    'purchase_units' => [[
                        'custom_id' => $o['paymentId'],
                        'description' => 'Audit Form ' . $o['planName'] . ' plan',
                        'amount' => [
                            'currency_code' => 'USD',
                            'value' => number_format($o['priceUsd'], 2, '.', ''),
                            'breakdown' => [
                                'item_total' => ['currency_code' => 'USD', 'value' => number_format($o['priceUsd'], 2, '.', '')],
                            ],
                        ],
                        'items' => [[
                            'name' => 'Audit Form ' . $o['planName'] . ' plan',
                            'description' => number_format($o['credits']) . ' audit credits',
                            'quantity' => '1',
                            'unit_amount' => ['currency_code' => 'USD', 'value' => number_format($o['priceUsd'], 2, '.', '')],
                            'category_code' => 'SOFTWARE',
                        ]],
                    ]],
                    'application_context' => [
                        'brand_name' => 'Audit Form',
                        'user_action' => 'PAY_NOW',
                        'shipping_preference' => 'NO_SHIPPING',
                        'return_url' => $o['origin'] . '/api/billing/paypal/verify?payment=' . $o['paymentId'],
                        'cancel_url' => $o['origin'] . '/dashboard/billing/checkout?plan=' . $o['planId'] . '&canceled=1',
                    ],
                ]);
            $data = $res->json() ?: [];
            if (! $res->successful() || empty($data['id'])) {
                $msg = $data['details'][0]['description'] ?? ($data['message'] ?? null) ?? 'PayPal rejected the checkout request.';

                return ['ok' => false, 'error' => mb_substr((string) $msg, 0, 200)];
            }
            $approve = null;
            foreach (($data['links'] ?? []) as $link) {
                if (($link['rel'] ?? '') === 'approve' || ($link['rel'] ?? '') === 'payer-action') {
                    $approve = $link['href'] ?? null;
                    break;
                }
            }
            if (! $approve) {
                return ['ok' => false, 'error' => 'PayPal did not return an approval link.'];
            }

            return ['ok' => true, 'url' => (string) $approve, 'orderId' => (string) $data['id']];
        } catch (\Throwable $e) {
            $msg = $e->getMessage();

            return ['ok' => false, 'error' => str_starts_with($msg, 'PayPal') ? $msg : 'Could not reach PayPal. Try again in a moment.'];
        }
    }

    /** Creates an SSLCommerz checkout session and returns the hosted payment page URL. */
    private function createSslCommerzSession(array $o): array
    {
        $params = [
            'store_id' => $o['storeId'],
            'store_passwd' => $o['storePassword'],
            'total_amount' => number_format($o['priceUsd'], 2, '.', ''),
            'currency' => 'USD',
            'tran_id' => $o['paymentId'],
            'success_url' => $o['origin'] . '/api/billing/sslcommerz/verify?payment=' . $o['paymentId'] . '&result=success',
            'fail_url' => $o['origin'] . '/api/billing/sslcommerz/verify?payment=' . $o['paymentId'] . '&result=fail',
            'cancel_url' => $o['origin'] . '/dashboard/billing/checkout?plan=' . $o['planId'] . '&canceled=1',
            'emi_option' => '0',
            'shipping_method' => 'NO',
            'product_name' => 'Audit Form ' . $o['planName'] . ' plan',
            'product_category' => 'Software',
            'product_profile' => 'software-generic',
            'cus_name' => $o['name'] !== '' ? $o['name'] : explode('@', $o['email'])[0],
            'cus_email' => $o['email'],
            'cus_add1' => 'N/A',
            'cus_city' => 'Dhaka',
            'cus_country' => 'Bangladesh',
            'cus_phone' => '01700000000',
        ];

        try {
            $res = Http::timeout(20)
                ->asForm()
                ->post($o['base'] . '/gwprocess/v4/api.php', $params);
            $data = $res->json() ?: [];
            if (! $res->successful() || ($data['status'] ?? null) !== 'SUCCESS' || empty($data['GatewayPageURL'])) {
                $msg = $data['failedreason'] ?? null;

                return ['ok' => false, 'error' => mb_substr((string) ($msg ?: 'SSLCommerz rejected the checkout request.'), 0, 200)];
            }

            return ['ok' => true, 'url' => (string) $data['GatewayPageURL'], 'sessionKey' => (string) ($data['sessionkey'] ?? '')];
        } catch (\Throwable) {
            return ['ok' => false, 'error' => 'Could not reach SSLCommerz. Try again in a moment.'];
        }
    }

    // ==================================================================
    // PayPal capture + finalize (port of paypal/verify/route.ts helper)
    // ==================================================================
    private function captureAndFinalizePaypal(string $paymentId, string $orderId): array
    {
        $payment = Payment::find($paymentId);
        if (! $payment || $payment->gateway !== 'paypal') {
            return ['ok' => false, 'error' => 'This payment is not a PayPal order.', 'status' => 404];
        }
        if ($payment->status === 'APPROVED') {
            return ['ok' => true];
        }
        if ($payment->status === 'REJECTED') {
            return ['ok' => false, 'error' => 'This order was already rejected. Contact support.', 'status' => 400];
        }

        $gw = GatewayConfig::where('code', 'paypal')->first();
        if (! $gw) {
            return ['ok' => false, 'error' => 'PayPal is not configured right now.', 'status' => 400];
        }

        $base = 'https://api-m.sandbox.paypal.com';
        $config = $this->gatewayConfig($gw);
        if (($config['env'] ?? null) === 'live') {
            $base = 'https://api-m.paypal.com';
        }
        $clientId = (string) ($config['clientId'] ?? '');
        $clientSecret = (string) ($config['clientSecret'] ?? '');
        if ($clientId === '' || $clientSecret === '') {
            return ['ok' => false, 'error' => 'PayPal is not configured right now.', 'status' => 400];
        }

        try {
            $token = $this->paypalAccessToken($base, $clientId, $clientSecret);
        } catch (\Throwable) {
            return ['ok' => false, 'error' => 'Could not reach PayPal. Refresh to retry.', 'status' => 502];
        }

        $captured = false;
        $amountPaid = '';
        $currencyPaid = '';
        $mismatch = null;
        try {
            $res = Http::timeout(20)
                ->withToken($token)
                ->acceptJson()
                ->post($base . '/v2/checkout/orders/' . rawurlencode($orderId) . '/capture');
            $data = $res->json() ?: [];
            if (! $res->successful()) {
                // ORDER_ALREADY_CAPTURED means a previous attempt succeeded; look it up instead.
                $alreadyCaptured = collect($data['details'] ?? [])->contains(fn ($d) => ($d['issue'] ?? null) === 'ORDER_ALREADY_CAPTURED');
                if ($alreadyCaptured) {
                    $lookup = Http::timeout(20)->withToken($token)->get($base . '/v2/checkout/orders/' . rawurlencode($orderId));
                    $found = $lookup->json() ?: [];
                    if (($found['status'] ?? null) === 'COMPLETED') {
                        $capture = $found['purchase_units'][0]['payments']['captures'][0] ?? null;
                        if (is_array($capture) && ! empty($capture['amount']['value'])) {
                            $amountPaid = (string) $capture['amount']['value'];
                            $currencyPaid = (string) ($capture['amount']['currency_code'] ?? 'USD');
                        }
                        $captured = true;
                    } else {
                        return ['ok' => false, 'error' => 'PayPal reports this order is not completed.', 'status' => 502];
                    }
                } else {
                    $msg = $data['details'][0]['description'] ?? ($data['message'] ?? null) ?? 'PayPal could not capture this order.';

                    return ['ok' => false, 'error' => mb_substr((string) $msg, 0, 200), 'status' => 502];
                }
            } elseif (($data['status'] ?? null) === 'COMPLETED') {
                $unit = $data['purchase_units'][0] ?? null;
                $capture = is_array($unit) ? ($unit['payments']['captures'][0] ?? null) : null;
                $captured = true;
                if (is_array($capture) && ! empty($capture['amount']['value'])) {
                    $amountPaid = (string) $capture['amount']['value'];
                    $currencyPaid = (string) ($capture['amount']['currency_code'] ?? 'USD');
                }
                if (is_array($unit) && isset($unit['custom_id']) && $unit['custom_id'] !== $paymentId) {
                    $mismatch = 'The PayPal order belongs to a different order reference.';
                }
            } else {
                return ['ok' => false, 'error' => 'PayPal order status: ' . ($data['status'] ?? 'unknown') . '. Payment not completed.', 'status' => 400];
            }
        } catch (\Throwable) {
            return ['ok' => false, 'error' => 'Could not reach PayPal to confirm the payment. Refresh to retry.', 'status' => 502];
        }

        if (! $captured) {
            return ['ok' => false, 'error' => 'Payment is not completed yet.', 'status' => 400];
        }
        if ($mismatch) {
            Activity::log(['action' => 'PAYPAL_MISMATCH', 'actorEmail' => 'paypal', 'userId' => $payment->userId, 'detail' => $mismatch]);

            return ['ok' => false, 'error' => $mismatch . ' Contact support.', 'status' => 400];
        }

        $expected = number_format((float) $payment->amount, 2, '.', '');
        if ($amountPaid !== '' && ((float) $amountPaid + 0.001 < (float) $expected)) {
            Activity::log([
                'action' => 'PAYPAL_MISMATCH',
                'actorEmail' => 'paypal',
                'userId' => $payment->userId,
                'detail' => 'Amount paid ' . $amountPaid . ' ' . $currencyPaid . ' below order ' . $expected . ' USD',
            ]);

            return ['ok' => false, 'error' => 'The captured amount does not match the order total. Contact support.', 'status' => 400];
        }

        try {
            $payment->forceFill([
                'txId' => $payment->txId ?: $orderId,
                'meta' => json_encode([
                    'gatewayName' => 'PayPal',
                    'mode' => 'API',
                    'paypalOrderId' => $orderId,
                    'paypalAmountPaid' => $amountPaid !== '' ? $amountPaid : null,
                ]),
            ])->save();
        } catch (\Throwable) {
        }

        $result = $this->approvePaymentById($payment->id, 'paypal:' . substr($orderId, 0, 28));
        if (! $result['ok'] && ($result['reason'] ?? null) !== 'ALREADY_PROCESSED') {
            return ['ok' => false, 'error' => 'Payment verified but could not be applied. Contact support with this reference.', 'status' => 500];
        }

        return ['ok' => true];
    }

    // ==================================================================
    // SSLCommerz validation + finalize (port of sslcommerz/verify helper)
    // ==================================================================
    private function validateAndFinalizeSslcommerz(string $paymentId): array
    {
        $payment = Payment::find($paymentId);
        if (! $payment || $payment->gateway !== 'sslcommerz') {
            return ['ok' => false, 'error' => 'This payment is not an SSLCommerz order.', 'status' => 404];
        }
        if ($payment->status === 'APPROVED') {
            return ['ok' => true];
        }
        if ($payment->status === 'REJECTED') {
            return ['ok' => false, 'error' => 'This order was already rejected. Contact support.', 'status' => 400];
        }

        $gw = GatewayConfig::where('code', 'sslcommerz')->first();
        if (! $gw) {
            return ['ok' => false, 'error' => 'SSLCommerz is not configured right now.', 'status' => 400];
        }

        $base = 'https://sandbox.sslcommerz.com';
        $config = $this->gatewayConfig($gw);
        if (($config['env'] ?? null) === 'live') {
            $base = 'https://securepay.sslcommerz.com';
        }
        $storeId = (string) ($config['store_id'] ?? '');
        $storePassword = (string) ($config['store_password'] ?? '');
        if ($storeId === '' || $storePassword === '') {
            return ['ok' => false, 'error' => 'SSLCommerz is not configured right now.', 'status' => 400];
        }

        $valId = (string) ($payment->txId ?? '');
        if ($valId === '') {
            return ['ok' => false, 'error' => 'No SSLCommerz validation reference was returned. Payment not completed.', 'status' => 400];
        }

        $valid = false;
        $amountPaid = '';
        $tranId = '';
        try {
            $res = Http::timeout(20)->get($base . '/validator/api/validationserverAPI.php', [
                'val_id' => $valId,
                'store_id' => $storeId,
                'store_passwd' => $storePassword,
                'format' => 'json',
            ]);
            $data = $res->json();
            $row = is_array($data) && array_is_list($data) ? ($data[0] ?? null) : (is_array($data) ? $data : null);
            if ($res->successful() && is_array($row) && in_array($row['status'] ?? null, ['VALID', 'VALIDATED'], true)) {
                $valid = true;
                $amountPaid = (string) ($row['amount'] ?? '');
                $tranId = (string) ($row['tran_id'] ?? '');
            }
        } catch (\Throwable) {
            return ['ok' => false, 'error' => 'Could not reach SSLCommerz to confirm the payment. Refresh to retry.', 'status' => 502];
        }

        if (! $valid) {
            return ['ok' => false, 'error' => 'SSLCommerz reports this transaction is not valid. Payment not completed.', 'status' => 400];
        }
        if ($tranId !== '' && $tranId !== $paymentId) {
            Activity::log([
                'action' => 'SSLCZ_MISMATCH',
                'actorEmail' => 'sslcommerz',
                'userId' => $payment->userId,
                'detail' => 'Validation tran_id ' . $tranId . ' does not match order ' . $paymentId,
            ]);

            return ['ok' => false, 'error' => 'The SSLCommerz transaction belongs to a different order reference. Contact support.', 'status' => 400];
        }
        $expected = number_format((float) $payment->amount, 2, '.', '');
        if ($amountPaid !== '' && ((float) $amountPaid + 0.001 < (float) $expected)) {
            Activity::log([
                'action' => 'SSLCZ_MISMATCH',
                'actorEmail' => 'sslcommerz',
                'userId' => $payment->userId,
                'detail' => 'Amount paid ' . $amountPaid . ' below order ' . $expected . ' USD',
            ]);

            return ['ok' => false, 'error' => 'The paid amount does not match the order total. Contact support.', 'status' => 400];
        }

        try {
            $payment->forceFill([
                'meta' => json_encode([
                    'gatewayName' => 'SSLCommerz',
                    'mode' => 'API',
                    'sslValId' => $valId,
                    'sslAmountPaid' => $amountPaid !== '' ? $amountPaid : null,
                ]),
            ])->save();
        } catch (\Throwable) {
        }

        $result = $this->approvePaymentById($payment->id, 'sslcommerz:' . substr($valId, 0, 28));
        if (! $result['ok'] && ($result['reason'] ?? null) !== 'ALREADY_PROCESSED') {
            return ['ok' => false, 'error' => 'Payment verified but could not be applied. Contact support with this reference.', 'status' => 500];
        }

        return ['ok' => true];
    }
}
