import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/credits";
import { getUsdBdt } from "@/lib/settings";
import { logActivity } from "@/lib/activity";

export async function GET() {
  const session = await auth();
  const gateways = await db.gatewayConfig.findMany({
    where: { enabled: true },
    orderBy: { sortOrder: "asc" },
    select: { code: true, name: true, logo: true, mode: true, instructions: true },
  });
  const rate = await getUsdBdt();
  return NextResponse.json({ gateways, rate, signedIn: Boolean(session?.user) });
}

const schema = z.object({
  planId: z.string().min(1),
  gateway: z.string().min(1).max(40),
  senderInfo: z.string().trim().max(80).optional().default(""),
  txId: z.string().trim().max(80).optional().default(""),
  agreeTerms: z.literal(true),
});

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
