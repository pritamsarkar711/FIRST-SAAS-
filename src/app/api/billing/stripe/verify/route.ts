import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { approvePaymentById } from "@/lib/payments";
import { rateLimit, clientIp } from "@/lib/credits";
import { logActivity } from "@/lib/activity";

/**
 * Verifies a Stripe Checkout Session after the customer returns from Stripe.
 * GET /api/billing/stripe/verify?payment=<paymentId>&session_id=<cs_...>
 * When Stripe reports the session as paid, the shared approval flow grants
 * credits exactly once (the function is a no-op for already-processed payments).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  if (!rateLimit(`stripverify:${clientIp(req)}`, 12, 5 * 60_000).ok) {
    return NextResponse.json({ error: "Too many verification attempts." }, { status: 429 });
  }
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  const paymentId = req.nextUrl.searchParams.get("payment");
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!paymentId || !sessionId) return NextResponse.json({ error: "Missing payment reference." }, { status: 400 });

  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.userId !== user.id) return NextResponse.json({ error: "Payment not found." }, { status: 404 });

  // Fast path: already approved earlier.
  if (payment.status === "APPROVED") {
    return NextResponse.json({ ok: true, status: "APPROVED" });
  }
  if (payment.status === "REJECTED") {
    return NextResponse.json({ ok: false, status: "REJECTED", error: "This order was already rejected. Contact support." }, { status: 400 });
  }

  const gw = await db.gatewayConfig.findUnique({ where: { code: payment.gateway } });
  if (!gw || gw.code !== "stripe") return NextResponse.json({ error: "This payment is not a Stripe order." }, { status: 400 });

  let secretKey = "";
  try {
    const cfg = JSON.parse(gw.config || "{}") as { secretKey?: string };
    secretKey = cfg.secretKey || "";
  } catch { /* empty config */ }
  if (!secretKey) return NextResponse.json({ error: "Card payments are not configured right now." }, { status: 400 });

  // Confirm against Stripe's own record of the session.
  let paid = false;
  let amountPaid = 0;
  let mismatch: string | null = null;
  try {
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      payment_status?: string;
      payment_intent?: string;
      client_reference_id?: string;
      amount_total?: number;
      error?: { message?: string };
    };
    if (!res.ok) {
      return NextResponse.json({ error: data.error?.message?.slice(0, 200) || "Stripe could not find that checkout session." }, { status: 502 });
    }
    if (data.client_reference_id && data.client_reference_id !== paymentId) {
      mismatch = "The checkout session belongs to a different order.";
    }
    if (data.payment_status === "paid") {
      paid = true;
      amountPaid = (data.amount_total || 0) / 100;
    }
    if (paid && payment.status === "PENDING") {
      // persist the Stripe payment intent id for the ledger
      await db.payment.update({
        where: { id: payment.id },
        data: {
          meta: JSON.stringify({
            gatewayName: gw.name,
            mode: "API",
            stripeSessionId: sessionId,
            stripePaymentIntent: data.payment_intent || null,
            stripeAmountPaid: amountPaid,
          }),
        },
      });
    }
  } catch {
    return NextResponse.json({ error: "Could not reach Stripe to confirm the payment. Refresh to retry." }, { status: 502 });
  }

  if (!paid) {
    return NextResponse.json({ ok: true, status: payment.status, paid: false, message: "Payment is not completed yet." });
  }
  if (mismatch) {
    logActivity({ action: "STRIPE_MISMATCH", actorEmail: user.email, userId: user.id, detail: mismatch }).catch(() => {});
    return NextResponse.json({ error: mismatch + " Contact support." }, { status: 400 });
  }

  const result = await approvePaymentById(payment.id, `stripe:${sessionId.slice(0, 28)}…`);
  if (!result.ok && result.reason !== "ALREADY_PROCESSED") {
    return NextResponse.json({ error: "Payment verified but could not be applied. Contact support with this reference." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status: "APPROVED", paid: true });
}
