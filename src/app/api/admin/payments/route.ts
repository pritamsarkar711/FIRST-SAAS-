import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { approvePaymentById } from "@/lib/payments";
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

  const payment = await db.payment.findUnique({ where: { id: parsed.data.id }, select: { id: true, status: true, planName: true, amount: true, gateway: true, userId: true } });
  if (!payment) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  if (payment.status !== "PENDING") return NextResponse.json({ error: `This payment is already ${payment.status.toLowerCase()}.` }, { status: 400 });

  if (parsed.data.action === "approve") {
    const result = await approvePaymentById(payment.id, admin.email, parsed.data.note);
    if (!result.ok) return NextResponse.json({ error: "Payment could not be approved." }, { status: 400 });
    return NextResponse.json({ ok: true, message: `Approved. ${result.credits} credits added.` });
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
