import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  const [rate, earnings, withdrawals] = await Promise.all([
    import("@/lib/settings").then((m) => m.siteSettings()),
    db.affiliateEarning.findMany({
      orderBy: { createdAt: "desc" }, take: 60,
      include: { user: { select: { email: true } }, from: { select: { email: true } } },
    }),
    db.withdrawal.findMany({
      orderBy: { createdAt: "desc" }, take: 60,
      include: { user: { select: { email: true } } },
    }),
  ]);
  return NextResponse.json({ rate: rate.affiliateRate, earnings, withdrawals });
}

const schema = z.object({
  action: z.enum(["setRate", "withdrawal"]),
  rate: z.number().min(0).max(90).optional(),
  id: z.string().optional(),
  decision: z.enum(["approve", "reject", "complete"]).optional(),
});

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action." }, { status: 400 });

  if (parsed.data.action === "setRate" && parsed.data.rate !== undefined) {
    const { siteSettings } = await import("@/lib/settings");
    const site = await siteSettings();
    await import("@/lib/settings").then((m) => m.setSetting("site", { ...site, affiliateRate: parsed.data.rate }));
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "withdrawal" && parsed.data.id && parsed.data.decision) {
    const w = await db.withdrawal.findUnique({ where: { id: parsed.data.id } });
    if (!w) return NextResponse.json({ error: "Withdrawal not found." }, { status: 404 });
    if (parsed.data.decision === "reject") {
      // Return the money to cleared balance
      await db.affiliateEarning.create({
        data: { userId: w.userId, fromUserId: w.userId, amount: w.amount, status: "CLEARED" },
      });
      await db.withdrawal.update({ where: { id: w.id }, data: { status: "REJECTED", reviewedAt: new Date() } });
    } else if (parsed.data.decision === "approve") {
      await db.withdrawal.update({ where: { id: w.id }, data: { status: "PROCESSING", reviewedAt: new Date() } });
    } else {
      await db.withdrawal.update({ where: { id: w.id }, data: { status: "COMPLETED", reviewedAt: new Date() } });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
