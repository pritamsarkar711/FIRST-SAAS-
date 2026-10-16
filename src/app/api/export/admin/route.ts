import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { logActivity } from "@/lib/activity";

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: (string | number | null)[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** Admin CSV exports: /api/export/admin?type=users|payments|audits */
export async function GET(req: NextRequest) {
  const { user: admin, error } = await requireAdmin();
  if (error) return error;

  const type = req.nextUrl.searchParams.get("type") || "users";
  let rows: (string | number | null)[][] = [];
  let name = type;

  if (type === "users") {
    const users = await db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5000,
      select: {
        id: true, email: true, name: true, role: true, status: true, credits: true,
        referralCode: true, twoFactorEnabled: true, createdAt: true,
      },
    });
    rows = [
      ["Joined", "Email", "Name", "Role", "Status", "Credits", "Referral code", "2FA enabled"],
      ...users.map((u) => [
        u.createdAt.toISOString(), u.email, u.name, u.role, u.status, u.credits, u.referralCode,
        u.twoFactorEnabled ? "yes" : "no",
      ]),
    ];
  } else if (type === "payments") {
    const payments = await db.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: 5000,
      include: { user: { select: { email: true } } },
    });
    rows = [
      ["Created", "User", "Plan", "Amount USD", "Amount BDT", "Gateway", "TrxID", "Sender", "Status", "Note"],
      ...payments.map((p) => [
        p.createdAt.toISOString(), p.user.email, p.planName, p.amount.toFixed(2),
        p.amountBdt?.toFixed(2) ?? null, p.gateway, p.txId, p.senderInfo, p.status, p.note,
      ]),
    ];
  } else if (type === "audits") {
    const audits = await db.audit.findMany({
      orderBy: { createdAt: "desc" },
      take: 5000,
      include: { user: { select: { email: true } } },
    });
    rows = [
      ["Created", "User", "Domain", "Network", "Mode", "Status", "Probability %", "Verdict", "Credits used", "Scheduled"],
      ...audits.map((a) => [
        a.createdAt.toISOString(), a.user.email, a.domain, a.target, a.mode, a.status,
        a.status === "DONE" ? a.probability : null, a.verdict, a.creditsUsed, a.watchItemId ? "yes" : "no",
      ]),
    ];
  } else if (type === "watchlist") {
    const items = await db.watchItem.findMany({
      orderBy: { createdAt: "desc" },
      take: 5000,
      include: { user: { select: { email: true } } },
    });
    name = "monitors";
    rows = [
      ["Added", "User", "Domain", "Network", "Mode", "Interval days", "Active", "Checks run", "Last score", "Next run"],
      ...items.map((w) => [
        w.createdAt.toISOString(), w.user.email, w.domain, w.target, w.mode, w.intervalDays,
        w.active ? "yes" : "no", w.runs, w.lastScore, w.nextRunAt?.toISOString() ?? null,
      ]),
    ];
  } else {
    return NextResponse.json({ error: "Unknown export type." }, { status: 400 });
  }

  logActivity({ action: "ADMIN_EXPORT", actorEmail: admin.email, detail: name });

  return new NextResponse("\uFEFF" + toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="adaudit-${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
