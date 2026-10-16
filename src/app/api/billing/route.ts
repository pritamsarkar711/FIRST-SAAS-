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
        if (g.code === "paypal") return typeof cfg.clientId === "string" && (cfg.clientId as string).length > 8 && typeof cfg.clientSecret === "string" && (cfg.clientSecret as string).length > 8;
        if (g.code === "sslcommerz") return typeof cfg.store_id === "string" && (cfg.store_id as string).length > 3 && typeof cfg.store_password === "string" && (cfg.store_password as string).length > 3;
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
  clientId?: string;
  clientSecret?: string;
  store_id?: string;
  store_password?: string;
  env?: string;
}

function paypalBase(env?: string): string {
  return env === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

function sslCommerzBase(env?: string): string {
  return env === "live" ? "https://securepay.sslcommerz.com" : "https://sandbox.sslcommerz.com";
}

/** Creates an SSLCommerz checkout session and returns the hosted payment page URL. */
async function createSslCommerzSession(opts: {
  base: string; storeId: string; storePassword: string;
  planName: string; priceUsd: number; credits: number; email: string; name: string;
  paymentId: string; planId: string; origin: string;
}): Promise<{ ok: true; url: string; sessionKey: string } | { ok: false; error: string }> {
  const params = new URLSearchParams();
  params.set("store_id", opts.storeId);
  params.set("store_passwd", opts.storePassword);
  params.set("total_amount", opts.priceUsd.toFixed(2));
  params.set("currency", "USD");
  params.set("tran_id", opts.paymentId);
  params.set("success_url", `${opts.origin}/api/billing/sslcommerz/verify?payment=${opts.paymentId}&result=success`);
  params.set("fail_url", `${opts.origin}/api/billing/sslcommerz/verify?payment=${opts.paymentId}&result=fail`);
  params.set("cancel_url", `${opts.origin}/dashboard/billing/checkout?plan=${opts.planId}&canceled=1`);
  params.set("emi_option", "0");
  params.set("shipping_method", "NO");
  params.set("product_name", `AdAudit ${opts.planName} plan`);
  params.set("product_category", "Software");
  params.set("product_profile", "software-generic");
  params.set("cus_name", opts.name || opts.email.split("@")[0]);
  params.set("cus_email", opts.email);
  params.set("cus_add1", "N/A");
  params.set("cus_city", "Dhaka");
  params.set("cus_country", "Bangladesh");
  params.set("cus_phone", "01700000000");

  try {
    const res = await fetch(`${opts.base}/gwprocess/v4/api.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => ({}))) as {
      status?: string; GatewayPageURL?: string; sessionkey?: string; failedreason?: string;
    };
    if (!res.ok || data.status !== "SUCCESS" || !data.GatewayPageURL) {
      const msg = (data.failedreason || "SSLCommerz rejected the checkout request.").slice(0, 200);
      return { ok: false, error: msg };
    }
    return { ok: true, url: data.GatewayPageURL, sessionKey: data.sessionkey || "" };
  } catch {
    return { ok: false, error: "Could not reach SSLCommerz. Try again in a moment." };
  }
}

/** OAuth2 client-credentials token for the PayPal REST API. */
async function paypalAccessToken(base: string, clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description?.slice(0, 200) || "PayPal rejected the API credentials.");
  }
  return data.access_token;
}

/** Creates a PayPal Order and returns the approval link the buyer must visit. */
async function createPayPalOrder(opts: {
  base: string; clientId: string; clientSecret: string;
  planName: string; priceUsd: number; credits: number; paymentId: string; planId: string; origin: string;
}): Promise<{ ok: true; url: string; orderId: string } | { ok: false; error: string }> {
  try {
    const token = await paypalAccessToken(opts.base, opts.clientId, opts.clientSecret);
    const res = await fetch(`${opts.base}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          custom_id: opts.paymentId,
          description: `AdAudit ${opts.planName} plan`,
          amount: { currency_code: "USD", value: opts.priceUsd.toFixed(2), breakdown: {
            item_total: { currency_code: "USD", value: opts.priceUsd.toFixed(2) },
          } },
          items: [{
            name: `AdAudit ${opts.planName} plan`,
            description: `${opts.credits.toLocaleString()} audit credits`,
            quantity: "1",
            unit_amount: { currency_code: "USD", value: opts.priceUsd.toFixed(2) },
            category_code: "SOFTWARE",
          }],
        }],
        application_context: {
          brand_name: "AdAudit",
          user_action: "PAY_NOW",
          shipping_preference: "NO_SHIPPING",
          return_url: `${opts.origin}/api/billing/paypal/verify?payment=${opts.paymentId}`,
          cancel_url: `${opts.origin}/dashboard/billing/checkout?plan=${opts.planId}&canceled=1`,
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      links?: { rel: string; href: string }[];
      message?: string;
      details?: { description?: string }[];
    };
    if (!res.ok || !data.id) {
      const msg = data.details?.[0]?.description || data.message || "PayPal rejected the checkout request.";
      return { ok: false, error: msg.slice(0, 200) };
    }
    const approve = data.links?.find((l) => l.rel === "approve" || l.rel === "payer-action");
    if (!approve) return { ok: false, error: "PayPal did not return an approval link." };
    return { ok: true, url: approve.href, orderId: data.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    return { ok: false, error: msg.startsWith("PayPal") ? msg : "Could not reach PayPal. Try again in a moment." };
  }
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

    if (gw.code === "paypal") {
      if (!config.clientId || !config.clientSecret) {
        return NextResponse.json({ error: "PayPal is not configured yet. Please pick another method." }, { status: 400 });
      }
      const origin = req.nextUrl.origin;
      const created = await createPayPalOrder({
        base: paypalBase(config.env),
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        planName: plan.name,
        priceUsd: plan.priceUsd,
        credits: plan.credits,
        paymentId: payment.id,
        planId: plan.id,
        origin,
      });
      if (!created.ok) {
        await db.payment.update({ where: { id: payment.id }, data: { status: "REJECTED", note: "PayPal order failed: " + created.error } });
        return NextResponse.json({ error: created.error }, { status: 502 });
      }
      await db.payment.update({
        where: { id: payment.id },
        data: { meta: JSON.stringify({ gatewayName: gw.name, mode: gw.mode, paypalOrderId: created.orderId }) },
      });
      logActivity({
        action: "CHECKOUT_SUBMIT",
        actorEmail: user.email,
        userId: user.id,
        detail: `${plan.name} · $${plan.priceUsd.toFixed(2)} via PayPal · order ${created.orderId.slice(0, 20)}…`,
        ip: clientIp(req),
      });
      return NextResponse.json({ ok: true, redirectUrl: created.url, paymentId: payment.id });
    }

    if (gw.code === "sslcommerz") {
      if (!config.store_id || !config.store_password) {
        return NextResponse.json({ error: "SSLCommerz is not configured yet. Please pick another method." }, { status: 400 });
      }
      const origin = req.nextUrl.origin;
      const created = await createSslCommerzSession({
        base: sslCommerzBase(config.env),
        storeId: config.store_id,
        storePassword: config.store_password,
        planName: plan.name,
        priceUsd: plan.priceUsd,
        credits: plan.credits,
        email: user.email,
        name: user.name || "",
        paymentId: payment.id,
        planId: plan.id,
        origin,
      });
      if (!created.ok) {
        await db.payment.update({ where: { id: payment.id }, data: { status: "REJECTED", note: "SSLCommerz session failed: " + created.error } });
        return NextResponse.json({ error: created.error }, { status: 502 });
      }
      await db.payment.update({
        where: { id: payment.id },
        data: { meta: JSON.stringify({ gatewayName: gw.name, mode: gw.mode, sslSessionKey: created.sessionKey }) },
      });
      logActivity({
        action: "CHECKOUT_SUBMIT",
        actorEmail: user.email,
        userId: user.id,
        detail: `${plan.name} · $${plan.priceUsd.toFixed(2)} via SSLCommerz · session ${created.sessionKey.slice(0, 20)}…`,
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
