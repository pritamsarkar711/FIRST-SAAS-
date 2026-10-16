import { db } from "@/lib/db";

interface AuditReportItem {
  label: string;
  status: "ok" | "warn" | "risk";
  detail: string;
}
export interface AuditReportSection {
  key: string;
  title: string;
  score: number;
  status: "ok" | "warn" | "risk";
  items: AuditReportItem[];
}
export interface AuditReport {
  probability: number;
  verdict: string;
  summary: string;
  sections: AuditReportSection[];
  strengths: string[];
  risks: string[];
  criticalFixes: string[];
  roadmap: { step: number; title: string; detail: string }[];
}

const NETWORK_NAMES: Record<string, string> = {
  ADSENSE: "Google AdSense",
  EZOIC: "Ezoic",
  MEDIAVINE: "Mediavine",
  RAPTIVE: "Raptive",
};

const MODE_HINTS: Record<string, string> = {
  NORMAL: "Mode: NORMAL. Be efficient: 3 items per section, keep details to 1-2 sentences each.",
  STANDARD: "Mode: STANDARD. Use 4-5 items per section with specific, evidence-based details.",
  PREMIUM: "Mode: PREMIUM. Maximum thoroughness: 5-6 items per section, scrutinize every signal in the crawl data, cross-reference sections, and surface subtle risks most reviewers would miss.",
};

export function networkName(code: string): string {
  return NETWORK_NAMES[code] || code;
}

/** Runs the full audit pipeline for an Audit row. Designed to run in the background. */
export async function runAudit(auditId: string): Promise<void> {
  const audit = await db.audit.findUnique({ where: { id: auditId } });
  if (!audit || audit.status !== "PENDING") return;

  const { getSetting } = await import("@/lib/settings");
  const { AUDIT_PROMPT_DEFAULT } = await import("@/lib/prompts");
  const { llmJson } = await import("@/lib/ai");
  const { crawlSite } = await import("@/lib/crawler");

  try {
    await db.audit.update({ where: { id: auditId }, data: { status: "RUNNING" } });

    const signals = await crawlSite(audit.domain);
    await db.audit.update({ where: { id: auditId }, data: { signals: JSON.stringify(signals) } });

    const prompts = await getSetting<{ audit: string }>("prompts", { audit: AUDIT_PROMPT_DEFAULT });
    const master = prompts.audit || AUDIT_PROMPT_DEFAULT;
    const system = `${master}\n\n${MODE_HINTS[audit.mode] || MODE_HINTS.STANDARD}\n\nTarget ad network: ${networkName(audit.target)}.`;

    const user = `Website URL: ${audit.domain}
Crawl results (real data, JSON):
${JSON.stringify(signals, null, 1)}

Produce the JSON verdict for ${networkName(audit.target)} approval readiness of this site.`;

    const { data } = await llmJson<AuditReport>({
      system,
      user,
      mode: audit.mode === "PREMIUM" ? "premium" : audit.mode === "NORMAL" ? "normal" : "standard",
      maxTokens: audit.mode === "PREMIUM" ? 12000 : 8000,
      temperature: 0.3,
    });

    // Normalize + validate minimally
    const report: AuditReport = {
      probability: clampInt(data.probability, 0, 100),
      verdict: ["APPLY_NOW", "WAIT_AND_IMPROVE", "HIGH_RISK_OF_REJECTION"].includes(data.verdict) ? data.verdict : "WAIT_AND_IMPROVE",
      summary: String(data.summary || "").slice(0, 1200),
      sections: Array.isArray(data.sections)
        ? data.sections.slice(0, 8).map((s, i) => ({
            key: String(s.key || `section${i}`),
            title: String(s.title || `Section ${i + 1}`),
            score: clampInt(s.score, 0, 100),
            status: (["ok", "warn", "risk"] as const).includes(s.status) ? s.status : s.score >= 70 ? "ok" : s.score >= 45 ? "warn" : "risk",
            items: Array.isArray(s.items) ? s.items.slice(0, 8).map((it) => ({
              label: String(it.label || "").slice(0, 200),
              status: (["ok", "warn", "risk"] as const).includes(it.status) ? it.status : "warn",
              detail: String(it.detail || "").slice(0, 900),
            })) : [],
          }))
        : [],
      strengths: arr(data.strengths),
      risks: arr(data.risks),
      criticalFixes: arr(data.criticalFixes),
      roadmap: Array.isArray(data.roadmap) ? data.roadmap.slice(0, 12).map((r, i) => ({
        step: r.step || i + 1,
        title: String(r.title || "").slice(0, 200),
        detail: String(r.detail || "").slice(0, 900),
      })) : [],
    };

    await db.audit.update({
      where: { id: auditId },
      data: { status: "DONE", report: JSON.stringify(report), probability: report.probability, verdict: report.verdict },
    });

    const { notify } = await import("@/lib/notify");
    await notify(
      audit.userId,
      "AUDIT",
      `Audit ready: ${audit.domain}`,
      `${networkName(audit.target)} verdict: ${report.verdict === "APPLY_NOW" ? "Apply now" : report.verdict === "WAIT_AND_IMPROVE" ? "Wait and improve" : "High risk of rejection"} — ${report.probability}% approval probability.`,
      `/dashboard/audit/${auditId}`
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "The audit engine hit an unexpected error. Credits were refunded.";
    // refund credits on failure
    const { addCredits } = await import("@/lib/credits");
    await addCredits(audit.userId, audit.creditsUsed).catch(() => {});
    const { notify } = await import("@/lib/notify");
    await notify(
      audit.userId,
      "AUDIT",
      `Audit failed: ${audit.domain}`,
      `${message.slice(0, 200)} Credits were refunded to your balance.`,
      "/dashboard/audit"
    ).catch(() => {});
    await db.audit.update({ where: { id: auditId }, data: { status: "FAILED", error: message.slice(0, 500) } }).catch(() => {});
  }
}

function clampInt(v: unknown, min: number, max: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x).slice(0, 500)).slice(0, 10) : [];
}
