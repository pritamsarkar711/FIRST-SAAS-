import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ArrowLeft, FileDown, PenLine } from "lucide-react";
import { db } from "@/lib/db";
import { ReportView } from "@/components/shared/report-view";
import { ShareButton } from "@/components/dashboard/share-button";
import { PrintButton } from "@/components/dashboard/print-button";
import { ComparisonPanel } from "@/components/dashboard/comparison-panel";
import { Button } from "@/components/ui/button";
import type { AuditReport } from "@/lib/audit-runner";

export const metadata = { title: "Audit report" };
export const dynamic = "force-dynamic";

export default async function AuditReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) redirect("/login");

  const audit = await db.audit.findUnique({ where: { id } });
  if (!audit || audit.userId !== user.id) notFound();

  if (audit.status !== "DONE" || !audit.report) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-lg font-bold text-foreground">{audit.status === "FAILED" ? "This audit failed" : "This audit is still running"}</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {audit.error || "The report will appear here as soon as the analysis completes."}
        </p>
        <Button asChild variant="outline" className="mt-4 rounded-md font-semibold">
          <Link href="/dashboard/audit">Back to audits</Link>
        </Button>
      </div>
    );
  }

  const report = JSON.parse(audit.report) as AuditReport;
  const signals = audit.signals ? JSON.parse(audit.signals) : null;

  // Previous completed audit of the same domain + network, for progress comparison
  const previous = await db.audit.findFirst({
    where: {
      userId: user.id,
      domain: audit.domain,
      target: audit.target,
      status: "DONE",
      createdAt: { lt: audit.createdAt },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, probability: true, verdict: true, report: true, createdAt: true },
  });

  return (
    <div className="space-y-6">
      <div className="hidden print:block">
        <p className="text-lg font-bold">AdAudit — Approval Readiness Report</p>
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
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button asChild className="rounded-md font-semibold">
            <a href={`/api/audit/${audit.id}/pdf`}><FileDown className="mr-2 h-4.5 w-4.5" /> PDF</a>
          </Button>
          <ShareButton auditId={audit.id} initialToken={audit.shareToken} />
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
            createdAt: audit.createdAt.toISOString(),
          }}
          previous={{
            probability: previous.probability,
            verdict: previous.verdict || "",
            sections: (JSON.parse(previous.report) as AuditReport).sections,
            createdAt: previous.createdAt.toISOString(),
          }}
        />
      )}
    </div>
  );
}
