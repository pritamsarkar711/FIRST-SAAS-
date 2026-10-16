import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { approvePaymentById } from "@/lib/payments";
import { rateLimit, clientIp } from "@/lib/credits";
import { logActivity } from "@/lib/activity";

/**
 * PayPal return endpoint. The buyer lands here from PayPal with
 * ?payment=<paymentId>&token=<orderId>. We capture the order server-side,
 * confirm the amount and our own custom_id, then run the shared approval flow
 * and redirect the buyer to the result page.
 */
async function captureAndFinalize(paymentId: string, orderId: string): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.gateway !== "paypal") {
    return { ok: false, error: "This payment is not a PayPal order.", status: 404 };
  }
  if (payment.status === "APPROVED") return { ok: true };
  if (payment.status === "REJECTED") {
    return { ok: false, error: "This order was already rejected. Contact support.", status: 400 };
  }

  const gw = await db.gatewayConfig.findUnique({ where: { code: "paypal" } });
  if (!gw) return { ok: false, error: "PayPal is not configured right now.", status: 400 };

  let base = "https://api-m.sandbox.paypal.com";
  let clientId = "";
  let clientSecret = "";
  try {
    const cfg = JSON.parse(gw.config || "{}") as { clientId?: string; clientSecret?: string; env?: string };
    if (cfg.env === "live") base = "https://api-m.paypal.com";
    clientId = cfg.clientId || "";
    clientSecret = cfg.clientSecret || "";
  } catch { /* empty config */ }
  if (!clientId || !clientSecret) {
    return { ok: false, error: "PayPal is not configured right now.", status: 400 };
  }

  let token: string;
  try {
    const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(20_000),
    });
    const tokenData = (await tokenRes.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
    if (!tokenRes.ok || !tokenData.access_token) {
      return { ok: false, error: tokenData.error_description?.slice(0, 200) || "Could not authenticate with PayPal.", status: 502 };
    }
    token = tokenData.access_token;
  } catch {
    return { ok: false, error: "Could not reach PayPal. Refresh to retry.", status: 502 };
  }

  let captured = false;
  let amountPaid = "";
  let currencyPaid = "";
  let mismatch: string | null = null;
  try {
    const res = await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      status?: string;
      details?: { issue?: string; description?: string }[];
      message?: string;
      purchase_units?: {
        custom_id?: string;
        payments?: {
          captures?: { id?: string; status?: string; amount?: { value?: string; currency_code?: string } }[];
        };
      }[];
    };
    if (!res.ok) {
      // ORDER_ALREADY_CAPTURED means a previous attempt succeeded; look it up instead.
      if (data.details?.some((d) => d.issue === "ORDER_ALREADY_CAPTURED")) {
        const lookup = await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(20_000),
        });
        const found = (await lookup.json().catch(() => ({}))) as typeof data;
        if (found.status === "COMPLETED") {
          const capture = found.purchase_units?.[0]?.payments?.captures?.[0];
          if (capture?.amount?.value) { amountPaid = capture.amount.value; currencyPaid = capture.amount.currency_code || "USD"; }
          captured = true;
        } else {
          return { ok: false, error: "PayPal reports this order is not completed.", status: 502 };
        }
      } else {
        const msg = data.details?.[0]?.description || data.message || "PayPal could not capture this order.";
        return { ok: false, error: msg.slice(0, 200), status: 502 };
      }
    } else if (data.status === "COMPLETED") {
      const unit = data.purchase_units?.[0];
      const capture = unit?.payments?.captures?.[0];
      captured = true;
      if (capture?.amount?.value) { amountPaid = capture.amount.value; currencyPaid = capture.amount.currency_code || "USD"; }
      if (unit?.custom_id && unit.custom_id !== paymentId) {
        mismatch = "The PayPal order belongs to a different order reference.";
      }
    } else {
      return { ok: false, error: `PayPal order status: ${data.status || "unknown"}. Payment not completed.`, status: 400 };
    }
  } catch {
    return { ok: false, error: "Could not reach PayPal to confirm the payment. Refresh to retry.", status: 502 };
  }

  if (!captured) {
    return { ok: false, error: "Payment is not completed yet.", status: 400 };
  }
  if (mismatch) {
    logActivity({ action: "PAYPAL_MISMATCH", actorEmail: "paypal", userId: payment.userId, detail: mismatch });
    return { ok: false, error: mismatch + " Contact support.", status: 400 };
  }

  const expected = payment.amount.toFixed(2);
  if (amountPaid && Number(amountPaid) + 0.001 < Number(expected)) {
    logActivity({ action: "PAYPAL_MISMATCH", actorEmail: "paypal", userId: payment.userId, detail: `Amount paid ${amountPaid} ${currencyPaid} below order ${expected} USD` });
    return { ok: false, error: "The captured amount does not match the order total. Contact support.", status: 400 };
  }

  await db.payment.update({
    where: { id: payment.id },
    data: {
      txId: payment.txId || orderId,
      meta: JSON.stringify({ gatewayName: "PayPal", mode: "API", paypalOrderId: orderId, paypalAmountPaid: amountPaid || null }),
    },
  }).catch(() => {});

  const result = await approvePaymentById(payment.id, `paypal:${orderId.slice(0, 28)}`);
  if (!result.ok && result.reason !== "ALREADY_PROCESSED") {
    return { ok: false, error: "Payment verified but could not be applied. Contact support with this reference.", status: 500 };
  }
  return { ok: true };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }
  if (!rateLimit(`paypalverify:${clientIp(req)}`, 12, 5 * 60_000).ok) {
    return NextResponse.redirect(new URL("/dashboard/billing", req.nextUrl.origin));
  }
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) return NextResponse.redirect(new URL("/login", req.nextUrl.origin));

  const paymentId = req.nextUrl.searchParams.get("payment");
  const orderId = req.nextUrl.searchParams.get("token");
  if (!paymentId || !orderId) {
    return NextResponse.redirect(new URL("/dashboard/billing", req.nextUrl.origin));
  }

  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.userId !== user.id) {
    return NextResponse.redirect(new URL("/dashboard/billing", req.nextUrl.origin));
  }

  const result = await captureAndFinalize(paymentId, orderId);
  if (result.ok) {
    logActivity({ action: "PAYPAL_VERIFY", actorEmail: user.email, userId: user.id, detail: `order ${orderId.slice(0, 24)}… captured and approved` });
    return NextResponse.redirect(new URL(`/dashboard/billing/checkout/success?payment=${paymentId}&pp=1&approved=1`, req.nextUrl.origin));
  }
  const note = encodeURIComponent(result.error.slice(0, 180));
  return NextResponse.redirect(new URL(`/dashboard/billing/checkout/success?payment=${paymentId}&pp=1&failed=1&reason=${note}`, req.nextUrl.origin));
}
