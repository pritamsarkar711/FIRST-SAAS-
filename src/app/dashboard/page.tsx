import { auth } from "@/lib/auth";
import Link from "next/link";
import { SearchCheck, PenLine, Link2, Coins, FileDown, ArrowRight, Users, Radar } from "lucide-react";
import { db } from "@/lib/db";
import { getCosts } from "@/lib/credits";
import { Button } from "@/components/ui/button";
import { VerdictBadge } from "@/components/shared/report-ui";
import { ScoreHistoryChart } from "@/components/dashboard/score-history-chart";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

export const metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const session = await auth();
  const user = await db.user.findUnique({
    where: { email: session!.user!.email! },
    select: { id: true, credits: true, createdAt: true, referralCode: true },
  });
  const [costs, audits, jobs, submissions, watchItems] = await Promise.all([
    getCosts(),
    db.audit.findMany({ where: { userId: user!.id }, orderBy: { createdAt: "desc" }, take: 15 }),
    db.contentJob.findMany({ where: { userId: user!.id }, orderBy: { createdAt: "desc" }, take: 3 }),
    db.indexRequest.count({ where: { userId: user!.id } }),
    db.watchItem.findMany({ where: { userId: user!.id, active: true }, orderBy: { nextRunAt: "asc" }, take: 3, select: { domain: true, nextRunAt: true, lastScore: true } }),
  ]);

  const doneAudits = audits.filter((a) => a.status === "DONE");
  const bestAudit = doneAudits.reduce<number | null>((best, a) => (best === null || a.probability > best ? a.probability : best), null);

  // Score history: most recent 12 completed audits, oldest first
  const historyPoints = [...doneAudits]
    .reverse()
    .slice(-12)
    .map((a) => ({
      date: new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      score: a.probability,
      domain: a.domain,
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Member since {new Date(user!.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Credits", value: user!.credits.toLocaleString(), icon: Coins, href: "/dashboard/billing" },
          { label: "Audits run", value: doneAudits.length, icon: SearchCheck, href: "/dashboard/audit" },
          { label: "Best score", value: bestAudit === null ? "—" : `${bestAudit}%`, icon: FileDown, href: "/dashboard/audit" },
          { label: "Articles written", value: jobs.length, icon: PenLine, href: "/dashboard/writer" },
        ].map((c) => (
          <Link key={c.label} href={c.href} className="group rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-[0_2px_10px_rgba(27,38,32,0.07)]">
            <div className="flex items-center justify-between">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-accent text-primary">
                <c.icon className="h-4.5 w-4.5" />
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground/0 transition-all group-hover:text-muted-foreground" />
            </div>
            <p className="mt-3 text-2xl font-bold text-foreground">{c.value}</p>
            <p className="text-sm text-muted-foreground">{c.label}</p>
          </Link>
        ))}
      </div>

      {/* Score history */}
      <div className="rounded-lg border border-border bg-card p-5 dark:bg-card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-foreground">Approval score history</h2>
          <p className="hidden items-center gap-4 text-xs text-muted-foreground sm:flex">
            <span className="flex items-center gap-1.5"><span className="h-px w-4 border-t-2 border-dashed border-ok" aria-hidden="true" /> 70 = apply-ready</span>
          </p>
        </div>
        {historyPoints.length >= 2 ? (
          <ScoreHistoryChart points={historyPoints} />
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Run at least two audits to see your progress over time.
          </p>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-bold text-foreground">Start something</h2>
          <div className="mt-3 space-y-2">
            {[
              { href: "/dashboard/audit", icon: SearchCheck, title: "Run a site audit", desc: `From ${costs.audit.normal} credits` },
              { href: "/dashboard/watchlist", icon: Radar, title: "Monitor a domain", desc: "Automatic re-checks on a schedule" },
              { href: "/dashboard/writer", icon: PenLine, title: "Write an article", desc: `From ${costs.writer.standard} credits` },
              { href: "/dashboard/indexer", icon: Link2, title: "Index new posts", desc: `${costs.index} credits per batch` },
            ].map((a) => (
              <Link key={a.href} href={a.href} className="flex items-center gap-3 rounded-md border border-border px-3.5 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
                <a.icon className="h-4.5 w-4.5 text-primary" />
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-foreground">{a.title}</span>
                  <span className="block text-xs text-muted-foreground">{a.desc}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-bold text-foreground">Your referral link</h2>
          <p className="mt-1 text-sm text-muted-foreground">Earn 20% of every payment from people you refer.</p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 truncate rounded-md border border-border bg-secondary px-3 py-2.5 text-sm text-foreground">
              /?ref={user!.referralCode}
            </code>
          </div>
          <Button asChild variant="outline" className="mt-3 w-full rounded-md font-semibold">
            <Link href="/dashboard/affiliate"><Users className="mr-2 h-4.5 w-4.5" /> Open affiliate dashboard</Link>
          </Button>
        </div>
      </div>

      {/* Monitoring strip */}
      {watchItems.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold text-foreground"><Radar className="h-4.5 w-4.5 text-primary" /> Active monitoring</h2>
            <Link href="/dashboard/watchlist" className="text-sm font-semibold text-primary hover:underline">Manage</Link>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {watchItems.map((w) => (
              <li key={w.domain} className="rounded-md border border-border bg-secondary/40 px-3.5 py-3">
                <p className="truncate text-sm font-semibold text-foreground">{w.domain}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {w.lastScore !== null ? <>Last score <span className={cn("font-bold", w.lastScore >= 70 ? "text-ok" : w.lastScore >= 45 ? "text-warn" : "text-risk")}>{w.lastScore}%</span> · </> : null}
                  {w.nextRunAt ? `next check ${new Date(w.nextRunAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "unscheduled"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent audits */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Recent audits</h2>
          <Link href="/dashboard/audit" className="text-sm font-semibold text-primary hover:underline">View all</Link>
        </div>
        {audits.length === 0 ? (
          <EmptyState
            image="/illustrations/audit.png"
            title="No audits yet"
            body="Your first audit takes about two minutes and shows exactly what a reviewer would flag."
            cta="Run first audit"
            href="/dashboard/audit"
          />
        ) : (
          <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
            <ul className="divide-y divide-border">
              {audits.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <Link href={`/dashboard/audit/${a.id}`} className="truncate font-semibold text-foreground hover:text-primary">{a.domain}</Link>
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {a.target.toLowerCase()}
                    </p>
                  </div>
                  {a.status === "DONE" ? (
                    <div className="flex items-center gap-2.5">
                      {a.verdict && <VerdictBadge verdict={a.verdict} />}
                      <span className={cn("rounded-sm px-2 py-1 text-xs font-bold",
                        a.probability >= 70 ? "bg-ok-soft text-ok" : a.probability >= 45 ? "bg-warn-soft text-warn" : "bg-risk-soft text-risk")}>
                        {a.probability}%
                      </span>
                    </div>
                  ) : a.status === "FAILED" ? (
                    <span className="text-xs font-semibold text-risk">Failed</span>
                  ) : (
                    <span className="text-xs font-semibold text-warn">Running...</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
