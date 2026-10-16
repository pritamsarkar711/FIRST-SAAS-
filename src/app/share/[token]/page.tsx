import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { Logo } from "@/components/logo";
import { ReportView } from "@/components/shared/report-view";
import { Button } from "@/components/ui/button";
import { siteSettings, SITE_DEFAULTS } from "@/lib/settings";
import type { AuditReport } from "@/lib/audit-runner";

export const dynamic = "force-dynamic";

async function getAudit(token: string) {
  if (!/^[a-f0-9]{8,40}$/.test(token)) return null;
  return db.audit.findUnique({ where: { shareToken: token } });
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const audit = await getAudit(token);
  if (!audit) return { title: "Report not found" };
  return {
    title: `Audit report — ${audit.domain}`,
    description: `Ad network readiness report for ${audit.domain}: ${audit.probability}% approval probability.`,
    robots: { index: false },
  };
}

export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const audit = await getAudit(token);
  if (!audit || audit.status !== "DONE" || !audit.report) notFound();

  const site = await siteSettings().catch(() => SITE_DEFAULTS);
  const report = JSON.parse(audit.report) as AuditReport;
  const signals = audit.signals ? JSON.parse(audit.signals) : null;

  return (
    <div className="flex min-h-screen flex-col bg-secondary/40">
      <header className="border-b border-border bg-card dark:bg-card print:hidden">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/"><Logo name={site.name} /></Link>
          <Button asChild size="sm" className="rounded-md font-semibold">
            <Link href="/register">Audit my site free</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 pb-safe sm:px-6">
        <div className="mb-5 rounded-lg border border-border bg-card px-4 py-3 text-sm leading-relaxed text-muted-foreground dark:bg-card">
          This is a read-only readiness report shared by the owner of <span className="font-semibold text-foreground">{audit.domain}</span>.
        </div>
        <ReportView
          domain={audit.domain}
          target={audit.target}
          mode={audit.mode}
          createdAt={audit.createdAt}
          report={report}
          signals={signals}
          footerNote={`Shared via ${site.name}. Independent assessment, not affiliated with or endorsed by the reviewed ad network.`}
        />
      </main>

      <footer className="border-t border-border bg-card py-6 text-center text-sm text-muted-foreground dark:bg-card print:hidden">
        Run your own audit at <Link href="/" className="font-semibold text-primary hover:underline">{site.name.toLowerCase()}</Link> — free credits on signup.
      </footer>
    </div>
  );
}
