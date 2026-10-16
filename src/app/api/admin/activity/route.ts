import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";

const GROUPS: Record<string, string[]> = {
  auth: ["AUTH_LOGIN", "AUTH_LOGIN_FAILED", "AUTH_2FA_CHALLENGE", "AUTH_REGISTER", "AUTH_LOGOUT", "AUTH_PASSWORD_CHANGE", "AUTH_2FA_ENABLE", "AUTH_2FA_DISABLE", "ADMIN_LOGIN"],
  audits: ["AUDIT_START", "AUDIT_BATCH_START", "AUDIT_DELETE", "AUDIT_SHARE"],
  monitoring: ["WATCH_ADD", "WATCH_UPDATE", "WATCH_REMOVE", "WATCH_RUN", "DIGEST_SENT", "DIGEST_SKIP"],
  tools: ["WRITER_START", "INDEXER_SUBMIT", "TOOL_SITECHECK"],
  billing: ["CHECKOUT_SUBMIT", "STRIPE_VERIFY", "STRIPE_MISMATCH", "PAYPAL_VERIFY", "PAYPAL_MISMATCH", "SSLCZ_VERIFY", "SSLCZ_MISMATCH", "PAYMENT_APPROVE", "PAYMENT_REJECT"],
  affiliate: ["WITHDRAW_REQUEST", "WITHDRAW_APPROVE", "WITHDRAW_REJECT", "WITHDRAW_COMPLETE"],
  users: ["USER_CREDITS_ADJUST", "USER_SUSPEND", "USER_UNSUSPEND", "USER_DELETE", "USER_ROLE_CHANGE"],
  admin: ["PLAN_SAVE", "GATEWAY_SAVE", "SETTINGS_SAVE", "BLOG_PUBLISH", "ADMIN_EXPORT", "SMTP_TEST"],
};

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const group = req.nextUrl.searchParams.get("group") || "all";
  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() || "";
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") || "1", 10) || 1);
  const perPage = 50;

  const actions = GROUPS[group];
  const where: Record<string, unknown> = {};
  if (actions) where.action = { in: actions };
  if (q) {
    where.OR = [
      { actorEmail: { contains: q } },
      { detail: { contains: q } },
      { ip: { contains: q } },
    ];
  }

  const [rows, total] = await Promise.all([
    db.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.activityLog.count({ where }),
  ]);

  return NextResponse.json({
    rows,
    total,
    page,
    perPage,
    pages: Math.max(1, Math.ceil(total / perPage)),
  });
}
