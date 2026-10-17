/**
 * Client-safe subset of the original src/lib/audit-runner.ts. The audit
 * pipeline itself runs on the Laravel backend; components only need the
 * report types and the network display names.
 */

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

export function networkName(code: string): string {
  return NETWORK_NAMES[code] || code;
}
