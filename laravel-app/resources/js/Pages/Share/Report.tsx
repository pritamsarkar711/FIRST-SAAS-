import { Head, Link, usePage } from "@inertiajs/react";
import { Logo } from "@/components/logo";
import { ReportView } from "@/components/shared/report-view";
import { Button } from "@/components/ui/button";

interface AuditProps {
  id: string;
  domain: string;
  target: string;
  mode: string;
  probability: number;
  verdict: string;
  report: string | Record<string, unknown>;
  createdAt: string | null;
}

/** Port of `src/app/share/[token]/page.tsx` — public read-only report view. */
export default function SharedReport({ audit }: { audit: AuditProps }) {
  const { props } = usePage() as unknown as { props: { site?: { name?: string } } };
  const siteName = props?.site?.name ?? "Audit Form";

  const report = typeof audit.report === "string" ? JSON.parse(audit.report) : audit.report;
  const signals = null;

  return (
    <div className="flex min-h-screen flex-col bg-secondary/40">
      <Head title={`Audit report — ${audit.domain}`}>
        <meta name="robots" content="noindex" />
      </Head>
      <header className="border-b border-border bg-card dark:bg-card print:hidden">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/"><Logo name={siteName} /></Link>
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
          footerNote={`Shared via ${siteName}. Independent assessment, not affiliated with or endorsed by the reviewed ad network.`}
        />
      </main>

      <footer className="border-t border-border bg-card py-6 text-center text-sm text-muted-foreground dark:bg-card print:hidden">
        Run your own audit at <Link href="/" className="font-semibold text-primary hover:underline">{siteName.toLowerCase()}</Link> — free credits on signup.
      </footer>
    </div>
  );
}
