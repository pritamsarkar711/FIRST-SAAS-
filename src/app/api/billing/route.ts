import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/credits";
import { getUsdBdt } from "@/lib/settings";
import { logActivity } from "@/lib/activity";

export async function GET() {
  const session = await auth();
  const rows = await db.gatewayConfig.findMany({
    where: { enabled: true },
    orderBy: { sortOrder: "asc" },
  });
  const rate = await getUsdBdt();

  // API gateways only appear once the admin has stored the keys they need.
  const gateways = rows
    .filter((g) => {
      if (g.mode === "MANUAL") return true;
      try {
        const cfg = JSON.parse(g.config || "{}") as Record<string, unknown>;
        if (g.code === "stripe") return typeof cfg.secretKey === "string" && cfg.secretKey.startsWith("sk_");
        return Object.keys(cfg).length > 0;
      } catch {
        return false;
      }
    })
    .map((g) => ({ code: g.code, name: g.name, logo: g.logo, mode: g.mode, instructions: g.instructions }));

  return NextResponse.json({ gateways, rate, signedIn: Boolean(session?.user) });
}

const schema = z.object({
  planId: z.string().min(1),
  gateway: z.string().min(1).max(40),
  senderInfo: z.string().trim().max(80).optional().default(""),
  txId: z.string().trim().max(80).optional().default(""),
  agreeTerms: z.literal(true),
});

interface GatewayConfigJson {
  secretKey?: string;
}

/** Creates a Stripe Checkout Session with the REST API (no SDK, shared-hosting friendly). */
async function createStripeCheckout(opts: {
  secretKey: string;
  planName: string;
  priceUsd: number;
  credits: number;
  email: string;
  paymentId: string;
  planId: string;
  origin: string;
}): Promise<{ ok: true; url: string; sessionId: string } | { ok: false; error: string }> {
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${opts.origin}/dashboard/billing/checkout/success?payment=${opts.paymentId}&session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${opts.origin}/dashboard/billing/checkout?plan=${opts.planId}&canceled=1`);
  params.set("client_reference_id", opts.paymentId);
  params.set("customer_email", opts.email);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "usd");
  params.set("line_items[0][price_data][unit_amount]", String(Math.round(opts.priceUsd * 100)));
  params.set("line_items[0][price_data][product_data][name]", `AdAudit ${opts.planName} plan`);
  params.set("line_items[0][price_data][product_data][description]", `${opts.credits.toLocaleString()} audit credits, one-time purchase`);

  try {
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => ({}))) as { url?: string; id?: string; error?: { message?: string } };
    if (!res.ok || !data.url || !data.id) {
      return { ok: false, error: data.error?.message?.slice(0, 200) || "Stripe rejected the checkout request." };
    }
    return { ok: true, url: data.url, sessionId: data.id };
  } catch {
    return { ok: false, error: "Could not reach Stripe. Try again in a moment." };
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  if (!rateLimit(`checkout:${clientIp(req)}`, 8, 10 * 60_000).ok) {
    return NextResponse.json({ error: "Too many attempts. Wait a few minutes." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Complete every required field and accept the terms." }, { status: 400 });
  }
  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  const plan = await db.plan.findUnique({ where: { id: parsed.data.planId } });
  if (!plan || !plan.active) return NextResponse.json({ error: "That plan is not available." }, { status: 400 });

  const gw = await db.gatewayConfig.findUnique({ where: { code: parsed.data.gateway } });
  if (!gw || !gw.enabled) return NextResponse.json({ error: "That payment method is not available." }, { status: 400 });

  if (gw.mode === "MANUAL" && (!parsed.data.txId || parsed.data.txId.length < 6)) {
    return NextResponse.json({ error: "Enter a valid transaction ID (TrxID) from your payment receipt." }, { status: 400 });
  }

  const rate = await getUsdBdt();
  const payment = await db.payment.create({
    data: {
      userId: user.id,
      planId: plan.id,
      planName: plan.name,
      amount: plan.priceUsd,
      currency: "USD",
      amountBdt: Math.round(plan.priceUsd * rate * 100) / 100,
      gateway: gw.code,
      senderInfo: parsed.data.senderInfo || null,
      txId: parsed.data.txId || null,
      status: "PENDING",
      meta: JSON.stringify({ gatewayName: gw.name, mode: gw.mode }),
    },
  });

  // API gateway: hand the customer to the provider's own checkout.
  if (gw.mode === "API") {
    let config: GatewayConfigJson = {};
    try { config = JSON.parse(gw.config || "{}"); } catch { /* empty config */ }

    if (gw.code === "stripe") {
      if (!config.secretKey || !config.secretKey.startsWith("sk_")) {
        return NextResponse.json({ error: "Card payments are not configured yet. Please pick another method." }, { status: 400 });
      }
      const origin = req.nextUrl.origin;
      const created = await createStripeCheckout({
        secretKey: config.secretKey,
        planName: plan.name,
        priceUsd: plan.priceUsd,
        credits: plan.credits,
        email: user.email,
        paymentId: payment.id,
        planId: plan.id,
        origin,
      });
      if (!created.ok) {
        await db.payment.update({ where: { id: payment.id }, data: { status: "REJECTED", note: "Stripe session failed: " + created.error } });
        return NextResponse.json({ error: created.error }, { status: 502 });
      }
      await db.payment.update({
        where: { id: payment.id },
        data: { meta: JSON.stringify({ gatewayName: gw.name, mode: gw.mode, stripeSessionId: created.sessionId }) },
      });
      logActivity({
        action: "CHECKOUT_SUBMIT",
        actorEmail: user.email,
        userId: user.id,
        detail: `${plan.name} · $${plan.priceUsd.toFixed(2)} via Stripe · session ${created.sessionId.slice(0, 24)}…`,
        ip: clientIp(req),
      });
      return NextResponse.json({ ok: true, redirectUrl: created.url, paymentId: payment.id });
    }

    return NextResponse.json({ error: "That gateway is not connected yet. Please pick another method." }, { status: 400 });
  }

  logActivity({
    action: "CHECKOUT_SUBMIT",
    actorEmail: user.email,
    userId: user.id,
    detail: `${plan.name} · $${plan.priceUsd.toFixed(2)} via ${gw.name}${parsed.data.txId ? " · TrxID " + parsed.data.txId : ""}`,
    ip: clientIp(req),
  });

  return NextResponse.json({
    ok: true,
    paymentId: payment.id,
    message: gw.mode === "MANUAL"
      ? "Order received. We verify manual payments quickly during business hours. Credits appear the moment it is approved."
      : "Order received. Complete the payment with the provider to finish.",
  });
}
