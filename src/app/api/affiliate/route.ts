import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/credits";
import { siteSettings } from "@/lib/settings";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true, referralCode: true } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [referred, earnings, withdrawals] = await Promise.all([
    db.user.count({ where: { referredById: user.id } }),
    db.affiliateEarning.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.withdrawal.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);

  const sum = (s: string) => earnings.filter((e) => e.status === s).reduce((a, b) => a + b.amount, 0);
  const site = await siteSettings();

  return NextResponse.json({
    referralCode: user.referralCode,
    rate: site.affiliateRate,
    minWithdraw: site.minWithdrawUsd,
    referred,
    totals: { pending: sum("PENDING"), cleared: sum("CLEARED"), paid: sum("PAID") },
    earnings,
    withdrawals,
  });
}

const withdrawSchema = z.object({
  amount: z.number().min(1),
  method: z.enum(["bkash", "nagad", "rocket", "payoneer"]),
  account: z.string().trim().min(6).max(120),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(`withdraw:${clientIp(req)}`, 5, 30 * 60_000).ok) {
    return NextResponse.json({ error: "Too many requests. Try later." }, { status: 429 });
  }
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = withdrawSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Fill the withdrawal form correctly." }, { status: 400 });

  const site = await siteSettings();
  if (parsed.data.amount < site.minWithdrawUsd) {
    return NextResponse.json({ error: `Minimum withdrawal is $${site.minWithdrawUsd}.` }, { status: 400 });
  }

  const cleared = await db.affiliateEarning.aggregate({
    where: { userId: user.id, status: "CLEARED" },
    _sum: { amount: true },
  });
  const available = cleared._sum.amount || 0;
  if (parsed.data.amount > available) {
    return NextResponse.json({ error: `Available cleared balance is $${available.toFixed(2)}.` }, { status: 400 });
  }

  let remaining = parsed.data.amount;
  const rows = await db.affiliateEarning.findMany({ where: { userId: user.id, status: "CLEARED" }, orderBy: { createdAt: "asc" } });
  for (const row of rows) {
    if (remaining <= 0) break;
    await db.affiliateEarning.update({ where: { id: row.id }, data: { status: "PAID" } });
    remaining -= row.amount;
  }

  await db.withdrawal.create({
    data: { userId: user.id, amount: parsed.data.amount, method: parsed.data.method, account: parsed.data.account, status: "PENDING" },
  });

  return NextResponse.json({ ok: true, message: "Withdrawal requested. Payouts are processed within 3 business days." });
}
