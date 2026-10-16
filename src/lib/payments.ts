import { db } from "@/lib/db";
import { addCredits } from "@/lib/credits";
import { siteSettings } from "@/lib/settings";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activity";

export interface ApprovalResult {
  ok: boolean;
  reason?: "NOT_FOUND" | "ALREADY_PROCESSED";
  status?: string;
  credits?: number;
}

/**
 * Marks a payment approved exactly once: grants credits, creates the subscription
 * record and the referrer's commission, and notifies the buyer.
 * Safe to call from the admin panel and from gateway callbacks alike.
 */
export async function approvePaymentById(paymentId: string, actorEmail: string, note?: string): Promise<ApprovalResult> {
  const payment = await db.payment.findUnique({ where: { id: paymentId }, include: { user: true, plan: true } });
  if (!payment) return { ok: false, reason: "NOT_FOUND" };
  if (payment.status !== "PENDING") return { ok: false, reason: "ALREADY_PROCESSED", status: payment.status };

  const credits = payment.plan?.credits ?? 0;
  await db.$transaction([
    db.payment.update({ where: { id: payment.id }, data: { status: "APPROVED", reviewedAt: new Date(), note: note || null } }),
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
    actorEmail,
    userId: payment.userId,
    detail: `${payment.planName} · $${payment.amount.toFixed(2)} · ${payment.gateway} · +${credits} credits`,
  });

  return { ok: true, credits };
}
