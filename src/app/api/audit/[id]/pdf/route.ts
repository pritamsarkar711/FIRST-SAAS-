import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildAuditPdf } from "@/lib/pdf";
import { siteSettings, SITE_DEFAULTS } from "@/lib/settings";
import type { AuditReport } from "@/lib/audit-runner";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const audit = await db.audit.findUnique({ where: { id } });
  if (!audit || (audit.userId !== user.id && user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (audit.status !== "DONE" || !audit.report) {
    return NextResponse.json({ error: "This audit has no report yet." }, { status: 400 });
  }

  const site = await siteSettings().catch(() => SITE_DEFAULTS);
  const report = JSON.parse(audit.report) as AuditReport;

  const pdf = await buildAuditPdf({
    domain: audit.domain,
    target: audit.target,
    mode: audit.mode,
    report,
    signals: audit.signals ? JSON.parse(audit.signals) : null,
    siteName: site.name,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="audit-${audit.domain}-${new Date(audit.createdAt).toISOString().slice(0, 10)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
