import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: (string | number | null)[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** Downloads the signed-in user's audit history as CSV. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true, email: true } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const audits = await db.audit.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 2000,
    select: {
      id: true, domain: true, target: true, mode: true, status: true, probability: true,
      verdict: true, creditsUsed: true, batchId: true, watchItemId: true, createdAt: true,
    },
  });

  const rows: (string | number | null)[][] = [
    ["Date", "Domain", "Network", "Mode", "Status", "Approval probability %", "Verdict", "Credits used", "Batch", "Scheduled check", "Report id"],
    ...audits.map((a) => [
      a.createdAt.toISOString(),
      a.domain,
      a.target,
      a.mode,
      a.status,
      a.status === "DONE" ? a.probability : null,
      a.verdict,
      a.creditsUsed,
      a.batchId ? "yes" : "no",
      a.watchItemId ? "yes" : "no",
      a.id,
    ]),
  ];

  logActivity({ action: "EXPORT_AUDITS", userId: user.id, actorEmail: user.email, detail: `${audits.length} rows` });

  return new NextResponse("\uFEFF" + toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="adaudit-history-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
