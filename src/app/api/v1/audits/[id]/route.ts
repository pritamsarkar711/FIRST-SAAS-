import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey, v1Json, v1Error, v1CorsHeaders } from "@/lib/api-keys";

export const dynamic = "force-dynamic";

type ReportSection = { key?: string; title?: string; score?: number; items?: { label?: string; tone?: string }[] };
type ParsedReport = {
  probability?: number;
  verdict?: string;
  summary?: string;
  sections?: ReportSection[];
  strengths?: string[];
  risks?: string[];
  fixes?: { title?: string; detail?: string; priority?: string }[];
  roadmap?: { step?: string; title?: string; detail?: string }[];
};

/** GET /api/v1/audits/[id] — poll status; the full report JSON is included once DONE. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await authenticateApiKey(req);
  if (!authResult.ok) return v1Error(authResult.error || "Unauthorized", authResult.status);

  const { id } = await params;
  if (!id || id.length > 64) return v1Error("Invalid audit id.", 400);

  const audit = await db.audit.findFirst({
    where: { id, userId: authResult.userId },
  });
  if (!audit) return v1Error("Audit not found (or it belongs to another key owner).", 404);

  const base = {
    ok: true,
    audit: {
      id: audit.id,
      domain: audit.domain,
      network: audit.target,
      mode: audit.mode.toLowerCase(),
      deep_scan: audit.deepScan,
      status: audit.status.toLowerCase(),
      probability: audit.status === "DONE" ? audit.probability : null,
      verdict: audit.verdict,
      error: audit.error,
      credits_used: audit.creditsUsed,
      created_at: audit.createdAt.toISOString(),
      updated_at: audit.updatedAt.toISOString(),
    },
  };

  if (audit.status !== "DONE" || !audit.report) return v1Json(base);

  let report: ParsedReport = {};
  let signals: unknown = null;
  try { report = JSON.parse(audit.report) as ParsedReport; } catch { /* keep empty */ }
  if (audit.signals) { try { signals = JSON.parse(audit.signals); } catch { /* ignore */ } }

  return v1Json({
    ...base,
    report,
    crawl_signals: signals,
    pdf_url: `/api/audit/${audit.id}/pdf`, // session-authenticated; open in a browser that is signed in
    share_hint: "Share links can be created from the dashboard report page.",
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: v1CorsHeaders });
}
