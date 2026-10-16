import { auth } from "@/lib/auth";
import Link from "next/link";
import { db } from "@/lib/db";
import { normalizeDomain } from "@/lib/guard";
import { EmptyState } from "@/components/shared/empty-state";
import { VerdictBadge } from "@/components/shared/report-ui";
import { TrendingUp, TrendingDown, ArrowRight, Radar } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata = { title: "Domain trends" };
export const dynamic = "force-dynamic";

export default async function DomainsIndexPage() {
  const session = await auth();
  const user = await db.user.findUnique({
    where: { email: session!.user!.email! },
    select: { id: true },
  });

  const audits = await db.audit.findMany({
    where: { userId: user!.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, domain: true, target: true, status: true, probability: true, verdict: true, watchItemId: true, createdAt: true },
  });

  // Aggregate per domain (a domain may be audited against several networks; the
  // latest completed run across all networks defines the current standing).
  const byDomain = new Map<string, {
    domain: string; runs: number; lastScore: number | null; prevScore: number | null;
    bestScore: number | null; lastVerdict: string | null; lastTarget: string; lastDate: Date; monitored: boolean;
  }>();
  for (const a of audits) {
    const key = normalizeDomain(a.domain);
    if (!key) continue;
    const entry = byDomain.get(key) ?? {
      domain: key, runs: 0, lastScore: null, prevScore: null,
      bestScore: null, lastVerdict: null, lastTarget: a.target, lastDate: a.createdAt, monitored: false,
    };
    entry.runs += 1;
    if (a.status === "DONE") {
      entry.prevScore = entry.lastScore;
      entry.lastScore = a.probability;
      entry.bestScore = entry.bestScore === null ? a.probability : Math.max(entry.bestScore, a.probability);
      entry.lastVerdict = a.verdict;
      entry.lastTarget = a.target;
      entry.lastDate = a.createdAt;
    }
    if (a.watchItemId) entry.monitored = true;
    byDomain.set(key, entry);
  }
  const domains = [...byDomain.values()].sort((a, b) => b.lastDate.getTime() - a.lastDate.getTime());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Domain trends</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every domain you have audited, with its latest standing and score movement.
        </p>
      </div>

      {domains.length === 0 ? (
        <EmptyState
          image="audit-desk"
          title="No domains yet"
          body="Run your first audit and the domain will appear here with its full score history."
          cta="Run first audit"
          href="/dashboard/audit"
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <ul className="divide-y divide-border">
            {domains.map((d) => {
              const delta = d.lastScore !== null && d.prevScore !== null ? d.lastScore - d.prevScore : null;
              return (
                <li key={d.domain} className="flex flex-col gap-2.5 p-4 transition-colors hover:bg-accent/30 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/domains/${encodeURIComponent(d.domain)}`}
                        className="block max-w-full truncate font-semibold text-foreground hover:text-primary"
                      >
                        {d.domain}
                      </Link>
                      {d.monitored && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                          <Radar className="h-3 w-3" aria-hidden="true" /> Monitored
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {d.runs} {d.runs === 1 ? "audit" : "audits"} · last checked{" "}
                      {new Date(d.lastDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} ·{" "}
                      {d.lastTarget === "ADSENSE" ? "Google AdSense" : d.lastTarget.charAt(0) + d.lastTarget.slice(1).toLowerCase()}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
                    {d.lastVerdict && <VerdictBadge verdict={d.lastVerdict} />}
                    {d.lastScore !== null && (
                      <span className={cn(
                        "rounded-sm px-2 py-1 text-xs font-bold",
                        d.lastScore >= 70 ? "bg-ok-soft text-ok" : d.lastScore >= 45 ? "bg-warn-soft text-warn" : "bg-risk-soft text-risk",
                      )}>
                        {d.lastScore}%
                      </span>
                    )}
                    {delta !== null && delta !== 0 && (
                      <span
                        className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", delta > 0 ? "text-ok" : "text-risk")}
                        title="Change since the previous completed audit"
                      >
                        {delta > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                        {delta > 0 ? "+" : ""}{delta}
                      </span>
                    )}
                    <Link
                      href={`/dashboard/domains/${encodeURIComponent(d.domain)}`}
                      className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                      aria-label={`Open trend page for ${d.domain}`}
                    >
                      Trend <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
