import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { logActivity } from "@/lib/activity";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() || "";
  const users = await db.user.findMany({
    where: q ? { OR: [{ email: { contains: q } }, { name: { contains: q } }] } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, email: true, name: true, role: true, status: true, credits: true,
      referralCode: true, createdAt: true, twoFactorEnabled: true,
      _count: { select: { audits: true, payments: true } },
    },
  });
  return NextResponse.json({ users });
}

const actionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["suspend", "activate", "addCredits", "setCredits", "makeAdmin", "removeAdmin", "reset2fa", "delete"]),
  amount: z.number().int().optional(),
});

export async function POST(req: NextRequest) {
  const { user: admin, error } = await requireAdmin();
  if (error) return error;
  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  const { id, action, amount } = parsed.data;

  const target = await db.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const log = (action: Parameters<typeof logActivity>[0]["action"], detail: string) =>
    logActivity({ action, actorEmail: admin.email, userId: target.id, detail });

  switch (action) {
    case "suspend":
      await db.user.update({ where: { id }, data: { status: "SUSPENDED" } });
      log("USER_SUSPEND", target.email);
      break;
    case "activate":
      await db.user.update({ where: { id }, data: { status: "ACTIVE" } });
      log("USER_UNSUSPEND", target.email);
      break;
    case "addCredits":
      if (!amount) return NextResponse.json({ error: "Amount required." }, { status: 400 });
      await db.user.update({ where: { id }, data: { credits: { increment: amount } } });
      log("USER_CREDITS_ADJUST", `${target.email} +${amount} credits`);
      break;
    case "setCredits":
      if (amount === undefined || amount < 0) return NextResponse.json({ error: "Amount required." }, { status: 400 });
      await db.user.update({ where: { id }, data: { credits: amount } });
      log("USER_CREDITS_ADJUST", `${target.email} set to ${amount} credits (was ${target.credits})`);
      break;
    case "makeAdmin":
      await db.user.update({ where: { id }, data: { role: "ADMIN" } });
      log("USER_ROLE_CHANGE", `${target.email} promoted to admin`);
      break;
    case "removeAdmin":
      if (target.id === admin.id) return NextResponse.json({ error: "You cannot remove your own admin role." }, { status: 400 });
      await db.user.update({ where: { id }, data: { role: "USER" } });
      log("USER_ROLE_CHANGE", `${target.email} demoted to user`);
      break;
    case "reset2fa":
      await db.user.update({ where: { id }, data: { twoFactorEnabled: false, twoFactorSecret: null } });
      log("AUTH_2FA_DISABLE", `Admin reset 2FA for ${target.email}`);
      break;
    case "delete":
      if (target.id === admin.id) return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
      await db.user.delete({ where: { id } });
      log("USER_DELETE", target.email);
      break;
  }
  return NextResponse.json({ ok: true });
}
