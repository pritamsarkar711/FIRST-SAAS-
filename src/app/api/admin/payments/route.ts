import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { addCredits } from "@/lib/credits";
import { siteSettings } from "@/lib/settings";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activity";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  const payments = await db.payment.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { email: true, name: true } } },
  });
  return NextResponse.json({ payments });
}

const actionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["approve", "reject"]),
  note: z.string().max(300).optional(),
});

export async function POST(req: NextRequest) {
  const { user: admin, error } = await requireAdmin();
  if (error) return error;
  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action." }, { status: 400 });

  const payment = await db.payment.findUnique({ where: { id: parsed.data.id }, include: { user: true, plan: true } });
  if (!payment) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  if (payment.status !== "PENDING") return NextResponse.json({ error: `This payment is already ${payment.status.toLowerCase()}.` }, { status: 400 });

  if (parsed.data.action === "approve") {
    const credits = payment.plan?.credits ?? 0;
    await db.$transaction([
      db.payment.update({ where: { id: payment.id }, data: { status: "APPROVED", reviewedAt: new Date(), note: parsed.data.note } }),
      db.user.update({ where: { id: payment.userId }, data: { credits: { increment: credits } } }),
      db.subscription.create({
        data: {
          userId: payment.userId,
          planId: payment.planId,
          planName: payment.planName,
          credits,
          status: "ACTIVE",
        },
      }),
    ]);

    if (payment.user.referredById) {
      const site = await siteSettings();
      const rate = site.affiliateRate ?? 20;
      const amount = Math.round(payment.amount * (rate / 100) * 100) / 100;
      if (amount > 0) {
        await db.affiliateEarning.create({
          data: { userId: payment.user.referredById, fromUserId: payment.userId, paymentId: payment.id, amount, status: "PENDING" },
        });
      }
    }
    await notify(
      payment.userId,
      "PAYMENT",
      "Payment approved",
      `Your ${payment.planName} plan payment was verified and ${credits} credits were added to your balance.`,
      "/dashboard/billing"
    );
    logActivity({
      action: "PAYMENT_APPROVE",
      actorEmail: admin.email,
      userId: payment.userId,
      detail: `${payment.planName} · $${payment.amount.toFixed(2)} · ${payment.gateway} · +${credits} credits`,
    });
    return NextResponse.json({ ok: true, message: `Approved. ${credits} credits added.` });
  }

  await db.payment.update({ where: { id: payment.id }, data: { status: "REJECTED", reviewedAt: new Date(), note: parsed.data.note } });
  await notify(
    payment.userId,
    "PAYMENT",
    "Payment could not be verified",
    `Your ${payment.planName} order was rejected. ${parsed.data.note ? "Reason: " + parsed.data.note : "Contact support if you believe this is a mistake."}`,
    "/dashboard/billing"
  );
  logActivity({
    action: "PAYMENT_REJECT",
    actorEmail: admin.email,
    userId: payment.userId,
    detail: `${payment.planName} · $${payment.amount.toFixed(2)} · ${payment.gateway}${parsed.data.note ? " · " + parsed.data.note : ""}`,
  });
  return NextResponse.json({ ok: true, message: "Payment rejected." });
}
