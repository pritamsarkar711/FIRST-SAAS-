import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeDomain } from "@/lib/guard";
import { logActivity } from "@/lib/activity";

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: (string | number | null)[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** CSV of every audit for one domain, oldest first: a per-domain score trend sheet. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true, email: true } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = req.nextUrl.searchParams.get("domain") || "";
  const domain = normalizeDomain(raw);
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }

  const audits = await db.audit.findMany({
    where: { userId: user.id, domain: { in: [domain, `www.${domain}`] } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, domain: true, target: true, mode: true, status: true, probability: true,
      verdict: true, creditsUsed: true, watchItemId: true, batchId: true, createdAt: true,
    },
  });
  if (!audits.length) return NextResponse.json({ error: "No audits for this domain" }, { status: 404 });

  // Delta vs the previous completed check, so the sheet reads as a trend
  let prev: number | null = null;
  const rows: (string | number | null)[][] = [
    ["Date", "Domain", "Network", "Mode", "Status", "Approval probability %", "Change vs previous", "Verdict", "Credits used", "Batch", "Scheduled check", "Report id"],
    ...audits.map((a) => {
      let change: string | number | null = null;
      if (a.status === "DONE") {
        change = prev === null ? "first check" : `${a.probability - prev >= 0 ? "+" : ""}${a.probability - prev}`;
        prev = a.probability;
      }
      return [
        a.createdAt.toISOString(),
        a.domain,
        a.target,
        a.mode,
        a.status,
        a.status === "DONE" ? a.probability : null,
        change,
        a.verdict,
        a.creditsUsed,
        a.batchId ? "yes" : "no",
        a.watchItemId ? "yes" : "no",
        a.id,
      ];
    }),
  ];

  logActivity({ action: "EXPORT_AUDITS", userId: user.id, actorEmail: user.email, detail: `${domain} trend, ${audits.length} rows` });

  return new NextResponse("\uFEFF" + toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="adaudit-trend-${domain}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
