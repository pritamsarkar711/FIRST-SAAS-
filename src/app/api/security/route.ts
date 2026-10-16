import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Events a normal user may see about their own account.
const VISIBLE = new Set([
  "AUTH_LOGIN", "AUTH_LOGIN_FAILED", "AUTH_2FA_CHALLENGE", "AUTH_REGISTER",
  "AUTH_LOGOUT", "AUTH_PASSWORD_CHANGE", "AUTH_2FA_ENABLE", "AUTH_2FA_DISABLE",
  "AUDIT_START", "AUDIT_BATCH_START", "CHECKOUT_SUBMIT", "WITHDRAW_REQUEST",
]);

const LABELS: Record<string, string> = {
  AUTH_LOGIN: "Signed in",
  AUTH_LOGIN_FAILED: "Sign-in attempt failed",
  AUTH_2FA_CHALLENGE: "Two-factor code requested",
  AUTH_REGISTER: "Account created",
  AUTH_LOGOUT: "Signed out",
  AUTH_PASSWORD_CHANGE: "Password changed",
  AUTH_2FA_ENABLE: "Two-factor authentication turned on",
  AUTH_2FA_DISABLE: "Two-factor authentication turned off",
  AUDIT_START: "Started a site audit",
  AUDIT_BATCH_START: "Started a batch audit",
  CHECKOUT_SUBMIT: "Placed a credit order",
  WITHDRAW_REQUEST: "Requested an affiliate withdrawal",
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true, twoFactorEnabled: true, createdAt: true } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const events = await db.activityLog.findMany({
    where: { actorEmail: session.user.email, action: { in: Array.from(VISIBLE) } },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { id: true, action: true, detail: true, ip: true, createdAt: true },
  });

  return NextResponse.json({
    twoFactorEnabled: user.twoFactorEnabled,
    memberSince: user.createdAt,
    events: events.map((e) => ({ ...e, label: LABELS[e.action] || e.action })),
  });
}
