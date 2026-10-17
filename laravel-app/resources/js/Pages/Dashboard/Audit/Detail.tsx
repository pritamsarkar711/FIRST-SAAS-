import { Head, Link, usePage } from "@inertiajs/react";
import { ArrowLeft, FileDown, PenLine } from "lucide-react";
import { ReportView } from "@/components/shared/report-view";
import { ShareButton } from "@/components/dashboard/share-button";
import { PrintButton } from "@/components/dashboard/print-button";
import { CopySummaryButton } from "@/components/dashboard/copy-summary-button";
import { ComparisonPanel } from "@/components/dashboard/comparison-panel";
import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { downloadAuditPdf } from "@/lib/pdf-client";
import { networkName } from "@/lib/audit-runner";

/**
 * Port of src/app/dashboard/audit/[id]/page.tsx. The controller passes the
 * audit row (with the report/signals JSON decoded) plus the previous audit of
 * the same domain + network; the page merges and renders exactly like before.
 * The PDF download now renders client-side via lib/pdf-client (the old
 * /api/audit/{id}/pdf endpoint no longer exists).
 */
export default function AuditDetail({ audit, previous }: {
  audit: {
    id: string; domain: string; target: string; mode: string; deepScan: boolean;
    status: string; probability: number; verdict: string | null; error: string | null;
    shareToken: string | null; createdAt: string; report: any | null; signals: any | null;
  };
  previous: {
    id: string; probability: number; verdict: string | null; report: any | null; createdAt: string;
  } | null;
}) {
  const { auth, site } = usePage<any>().props;

  const report = audit.report ?? null;
  const signals = audit.signals ?? null;

  // Plain-text summary for the copy-to-clipboard button
  const verdictWord = report?.verdict === "APPLY_NOW" ? "Apply now" : report?.verdict === "WAIT_AND_IMPROVE" ? "Wait and improve" : report?.verdict === "HIGH_RISK" ? "High risk" : report?.verdict;
  const summaryText = report ? [
    `Audit Form report for ${audit.domain} (${networkName(audit.target)})`,
    `Approval probability: ${report.probability}% (${verdictWord})`,
    ``,
    report.summary,
    ``,
    ...report.sections.flatMap((s: any) => [
      `${s.title}: ${s.score}/100`,
      ...s.items.map((i: any) => `  [${i.status === "ok" ? "OK" : i.status === "warn" ? "Needs work" : "Critical"}] ${i.label}: ${i.detail}`),
      ``,
    ]),
    report.criticalFixes.length ? `Critical fixes:\n${report.criticalFixes.map((f: string, i: number) => `  ${i + 1}. ${f}`).join("\n")}` : "",
  ].join("\n").trim() + "\n" : "";

  function handlePdfDownload() {
    if (!report) return;
    void downloadAuditPdf(report, {
      domain: audit.domain,
      mode: audit.mode,
      target: audit.target,
      createdAt: audit.createdAt,
      siteName: site?.name || "Audit Form",
      signals,
    });
  }

  return (
    <DashboardShell credits={auth.user.credits} userName={auth.user.name || auth.user.email} isAdmin={auth.user.role === "ADMIN"}>
      <Head title="Audit report" />
      <div className="space-y-6">
        {audit.status !== "DONE" || !report ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-lg font-bold text-foreground">{audit.status === "FAILED" ? "This audit failed" : "This audit is still running"}</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              {audit.error || "The report will appear here as soon as the analysis completes."}
            </p>
            <Button asChild variant="outline" className="mt-4 rounded-md font-semibold">
              <Link href="/dashboard/audit">Back to audits</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="hidden print:block">
              <p className="text-lg font-bold">Audit Form — Approval Readiness Report</p>
            </div>
            <Link href="/dashboard/audit" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline print:hidden">
              <ArrowLeft className="h-3.5 w-3.5" /> All audits
            </Link>
            <ReportView
              domain={audit.domain}
              target={audit.target}
              mode={audit.mode}
              createdAt={audit.createdAt}
              report={report}
              signals={signals}
            >
              <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end print:hidden">
                <Button className="rounded-md font-semibold" onClick={handlePdfDownload}>
                  <FileDown className="mr-2 h-4.5 w-4.5" /> PDF
                </Button>
                <ShareButton auditId={audit.id} initialToken={audit.shareToken} />
                <CopySummaryButton text={summaryText} />
                <Button asChild variant="outline" className="rounded-md font-semibold">
                  <Link href="/dashboard/writer"><PenLine className="mr-2 h-4.5 w-4.5" /> Fix with writer</Link>
                </Button>
                <PrintButton />
              </div>
            </ReportView>

            {previous && previous.report && (
              <ComparisonPanel
                current={{
                  probability: report.probability,
                  verdict: report.verdict,
                  sections: report.sections,
                  createdAt: audit.createdAt,
                }}
                previous={{
                  probability: previous.probability,
                  verdict: previous.verdict || "",
                  sections: previous.report.sections,
                  createdAt: previous.createdAt,
                }}
              />
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
