import { auth } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { normalizeDomain } from "@/lib/guard";
import { VerdictBadge } from "@/components/shared/report-ui";
import { ScoreHistoryChart } from "@/components/dashboard/score-history-chart";
import { EmptyState } from "@/components/shared/empty-state";
import {
  SearchCheck, FileDown, Radar, TrendingUp, TrendingDown, ArrowRight, ExternalLink, History, ScanSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface SectionAgg { title: string; total: number; n: number }

export default async function DomainTrendPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain: rawDomain } = await params;
  let domain: string;
  try {
    domain = normalizeDomain(decodeURIComponent(rawDomain));
  } catch {
    notFound();
  }
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) notFound();

  const session = await auth();
  const user = await db.user.findUnique({
    where: { email: session!.user!.email! },
    select: { id: true },
  });

  const [audits, watches] = await Promise.all([
    db.audit.findMany({
      where: { userId: user!.id, domain: { in: [domain, `www.${domain}`] } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, target: true, mode: true, deepScan: true, status: true, probability: true, verdict: true,
        batchId: true, watchItemId: true, report: true, createdAt: true,
      },
    }),
    db.watchItem.findMany({
      where: { userId: user!.id, domain: { in: [domain, `www.${domain}`] } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const done = audits.filter((a) => a.status === "DONE");
  const latest = done[done.length - 1] ?? null;
  const previous = done.length >= 2 ? done[done.length - 2] : null;
  const delta = latest && previous ? latest.probability - previous.probability : null;
  const avg = done.length ? Math.round(done.reduce((s, a) => s + a.probability, 0) / done.length) : null;
  const best = done.length ? Math.max(...done.map((a) => a.probability)) : null;

  // Score trend points (same-day runs labeled by time, mirroring the overview chart)
  const trend = done.slice(-24);
  const sameDay = trend.length > 0 && new Set(trend.map((a) => new Date(a.createdAt).toDateString())).size === 1;
  const trendPoints = trend.map((a) => ({
    date: sameDay
      ? new Date(a.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      : new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    score: a.probability,
    domain: `${a.target.toLowerCase()} · ${a.mode.toLowerCase()}`,
  }));

  // Section averages across completed audits
  const sectionAgg = new Map<string, SectionAgg>();
  for (const a of done) {
    try {
      const report = JSON.parse(a.report || "{}");
      for (const s of report.sections ?? []) {
        if (typeof s.title !== "string" || typeof s.score !== "number") continue;
        const cur = sectionAgg.get(s.title) ?? { title: s.title, total: 0, n: 0 };
        cur.total += s.score;
        cur.n += 1;
        sectionAgg.set(s.title, cur);
      }
    } catch {
      // malformed report for one audit: skip its sections
    }
  }
  const sectionAverages = [...sectionAgg.values()]
    .map((s) => ({ title: s.title, score: Math.round(s.total / s.n) }))
    .sort((a, b) => b.score - a.score);

  const activeWatch = watches.find((w) => w.active) ?? watches[0] ?? null;

  const networkLabel = (code: string) =>
    code === "ADSENSE" ? "Google AdSense" : code === "EZOIC" ? "Ezoic" : code === "MEDIAVINE" ? "Mediavine" : code === "RAPTIVE" ? "Raptive" : code;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/domains" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-3.5 w-3.5 rotate-180" /> All domains
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{domain}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {audits.length} {audits.length === 1 ? "audit" : "audits"} on record
              {latest ? <> · last checked {new Date(latest.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</> : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/dashboard/audit?domain=${encodeURIComponent(domain)}${latest ? `&network=${latest.target}` : ""}`}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <SearchCheck className="h-4.5 w-4.5" /> Run new audit
            </Link>
            {audits.length > 0 && (
              <a
                href={`/api/export/domain?domain=${encodeURIComponent(domain)}`}
                download
                className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                <FileDown className="h-4.5 w-4.5" /> Export trend CSV
              </a>
            )}
          </div>
        </div>
      </div>

      {audits.length === 0 ? (
        <EmptyState
          image="/illustrations/audit.png"
          title="No audits for this domain"
          body="Run an audit and every score, verdict and section result for this domain will collect here."
          cta="Run first audit"
          href={`/dashboard/audit?domain=${encodeURIComponent(domain)}`}
        />
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Latest score</p>
              <div className="mt-2 flex items-center gap-2.5">
                {latest ? (
                  <>
                    <span className={cn(
                      "text-3xl font-bold",
                      latest.probability >= 70 ? "text-ok" : latest.probability >= 45 ? "text-warn" : "text-risk",
                    )}>
                      {latest.probability}%
                    </span>
                    {latest.verdict && <VerdictBadge verdict={latest.verdict} />}
                  </>
                ) : (
                  <span className="text-3xl font-bold text-muted-foreground">—</span>
                )}
              </div>
              {delta !== null && delta !== 0 && (
                <p className={cn("mt-1 inline-flex items-center gap-1 text-xs font-semibold", delta > 0 ? "text-ok" : "text-risk")}>
                  {delta > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {delta > 0 ? "+" : ""}{delta} since previous check
                </p>
              )}
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Average score</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{avg !== null ? `${avg}%` : "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Across {done.length} completed {done.length === 1 ? "check" : "checks"}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Best score</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{best !== null ? `${best}%` : "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">70% or above is apply-ready</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Monitoring</p>
              {activeWatch ? (
                <>
                  <p className="mt-2 flex items-center gap-2 text-sm font-bold text-foreground">
                    <Radar className="h-4 w-4 text-primary" aria-hidden="true" />
                    {activeWatch.active ? "Active" : "Paused"}
                    <span className="text-xs font-semibold text-muted-foreground">every {activeWatch.intervalDays} days</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {activeWatch.active && activeWatch.nextRunAt
                      ? `Next check ${new Date(activeWatch.nextRunAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                      : activeWatch.pausedReason || "Resume it to keep tracking this domain"}
                  </p>
                  <Link href="/dashboard/watchlist" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    Manage monitor <ArrowRight className="h-3 w-3" />
                  </Link>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm font-bold text-foreground">Not monitored</p>
                  <Link href="/dashboard/watchlist" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    Put this domain on a schedule <ArrowRight className="h-3 w-3" />
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Trend chart */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-bold text-foreground">Approval score trend</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Completed checks for {domain}, oldest to newest.</p>
            <div className="mt-3">
              {trendPoints.length >= 2 ? (
                <ScoreHistoryChart points={trendPoints} />
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Run one more audit of this domain to draw the trend line.
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Section averages */}
            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="font-bold text-foreground">Section averages</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">How this domain scores on each pillar, averaged across every completed check.</p>
              {sectionAverages.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No completed checks yet.</p>
              ) : (
                <ul className="mt-4 space-y-3.5">
                  {sectionAverages.map((s) => (
                    <li key={s.title}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-semibold text-foreground">{s.title}</span>
                        <span className={cn(
                          "font-bold",
                          s.score >= 70 ? "text-ok" : s.score >= 45 ? "text-warn" : "text-risk",
                        )}>
                          {s.score}/100
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-sm bg-secondary" role="presentation">
                        <div
                          className={cn(
                            "h-full rounded-sm",
                            s.score >= 70 ? "bg-ok" : s.score >= 45 ? "bg-warn" : "bg-risk",
                          )}
                          style={{ width: `${s.score}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Check history */}
            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 font-bold text-foreground">
                <History className="h-4.5 w-4.5 text-primary" aria-hidden="true" /> Check history
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Every run for this domain, newest first.</p>
              <ul className="mt-3 max-h-96 divide-y divide-border overflow-y-auto pr-1">
                {[...audits].reverse().map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        <span className="font-normal text-muted-foreground"> · {new Date(a.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.target === "ADSENSE" ? "AdSense" : networkLabel(a.target)} · {a.mode.charAt(0) + a.mode.slice(1).toLowerCase()}
                        {a.batchId ? " · batch" : ""}
                        {a.watchItemId ? " · scheduled" : ""}
                      </p>
                      {a.deepScan && (
                        <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-primary">
                          <ScanSearch className="h-3 w-3" aria-hidden="true" /> Deep scan
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {a.status === "DONE" ? (
                        <>
                          {a.verdict && <VerdictBadge verdict={a.verdict} />}
                          <span className={cn(
                            "rounded-sm px-2 py-1 text-xs font-bold",
                            a.probability >= 70 ? "bg-ok-soft text-ok" : a.probability >= 45 ? "bg-warn-soft text-warn" : "bg-risk-soft text-risk",
                          )}>
                            {a.probability}%
                          </span>
                          <Link
                            href={`/dashboard/audit/${a.id}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                            aria-label={`Open report from ${new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                            title="Open report"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </>
                      ) : a.status === "FAILED" ? (
                        <span className="text-xs font-semibold text-risk">Failed</span>
                      ) : (
                        <span className="text-xs font-semibold text-warn">Running</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
