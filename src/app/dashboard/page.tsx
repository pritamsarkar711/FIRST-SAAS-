import { auth } from "@/lib/auth";
import Link from "next/link";
import { SearchCheck, PenLine, Link2, Coins, FileDown, ArrowRight, Users, Radar, LineChart, TrendingUp, TrendingDown } from "lucide-react";
import { db } from "@/lib/db";
import { getCosts } from "@/lib/credits";
import { normalizeDomain } from "@/lib/guard";
import { Button } from "@/components/ui/button";
import { VerdictBadge } from "@/components/shared/report-ui";
import { ScoreHistoryChart } from "@/components/dashboard/score-history-chart";
import { OnboardingChecklist, type OnboardingStep } from "@/components/dashboard/onboarding-checklist";
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
  const [costs, audits, jobs, submissions, watchItems, watchCount, approvedPayments] = await Promise.all([
    getCosts(),
    db.audit.findMany({ where: { userId: user!.id }, orderBy: { createdAt: "desc" }, take: 15 }),
    db.contentJob.findMany({ where: { userId: user!.id }, orderBy: { createdAt: "desc" }, take: 3 }),
    db.indexRequest.count({ where: { userId: user!.id } }),
    db.watchItem.findMany({ where: { userId: user!.id, active: true }, orderBy: { nextRunAt: "asc" }, take: 3, select: { domain: true, nextRunAt: true, lastScore: true } }),
    db.watchItem.count({ where: { userId: user!.id } }),
    db.payment.count({ where: { userId: user!.id, status: "APPROVED" } }),
  ]);
  const fullUser = await db.user.findUnique({
    where: { id: user!.id },
    select: { twoFactorEnabled: true },
  });

  const doneAudits = audits.filter((a) => a.status === "DONE");
  const bestAudit = doneAudits.reduce<number | null>((best, a) => (best === null || a.probability > best ? a.probability : best), null);

  const onboardingSteps: OnboardingStep[] = [
    { id: "audit", label: "Run your first audit", desc: "A full report takes about two minutes.", href: "/dashboard/audit", done: doneAudits.length > 0, cta: "Pick a domain and start" },
    { id: "monitor", label: "Put a domain on monitoring", desc: "Automatic re-checks keep the score fresh.", href: "/dashboard/watchlist", done: watchCount > 0, cta: "Set up your first monitor" },
    { id: "article", label: "Write a policy-safe article", desc: "The writer follows AdSense content rules.", href: "/dashboard/writer", done: jobs.length > 0, cta: "Open the content writer" },
    { id: "twofa", label: "Turn on two-factor login", desc: "A one-time code keeps reports private.", href: "/dashboard/settings", done: !!fullUser?.twoFactorEnabled, cta: "Secure your account" },
  ];

  // Top domains strip: latest score per audited domain, best performers first
  const domainStats = new Map<string, { domain: string; last: number | null; prev: number | null; runs: number }>();
  for (const a of [...audits].reverse()) {
    const key = normalizeDomain(a.domain);
    if (!key) continue;
    const cur = domainStats.get(key) ?? { domain: key, last: null, prev: null, runs: 0 };
    cur.runs += 1;
    if (a.status === "DONE") { cur.prev = cur.last; cur.last = a.probability; }
    domainStats.set(key, cur);
  }
  const topDomains = [...domainStats.values()]
    .filter((d) => d.last !== null)
    .sort((a, b) => (b.last ?? 0) - (a.last ?? 0))
    .slice(0, 4);

  // Score history: most recent 12 completed audits, oldest first
  const historyRaw = [...doneAudits].reverse().slice(-12);
  // When every point falls on the same calendar day, label by time instead of repeating the date
  const sameDay = historyRaw.length > 0 &&
    new Set(historyRaw.map((a) => new Date(a.createdAt).toDateString())).size === 1;
  const historyPoints = historyRaw.map((a) => ({
    date: sameDay
      ? new Date(a.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      : new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
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

      {/* Getting started (hidden once every step is done or dismissed client-side) */}
      {onboardingSteps.some((s) => !s.done) && <OnboardingChecklist steps={onboardingSteps} />}

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

      {/* Top domains strip */}
      {topDomains.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold text-foreground"><LineChart className="h-4.5 w-4.5 text-primary" aria-hidden="true" /> Your domains</h2>
            <Link href="/dashboard/domains" className="text-sm font-semibold text-primary hover:underline">All domain trends</Link>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {topDomains.map((d) => {
              const delta = d.prev !== null ? (d.last ?? 0) - d.prev : null;
              return (
                <li key={d.domain}>
                  <Link href={`/dashboard/domains/${encodeURIComponent(d.domain)}`} className="group block rounded-md border border-border bg-secondary/40 px-3.5 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
                    <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">{d.domain}</p>
                    <p className="mt-1 flex items-center justify-between gap-2">
                      <span className={cn("text-lg font-bold", (d.last ?? 0) >= 70 ? "text-ok" : (d.last ?? 0) >= 45 ? "text-warn" : "text-risk")}>{d.last}%</span>
                      {delta !== null && delta !== 0 && (
                        <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", delta > 0 ? "text-ok" : "text-risk")}>
                          {delta > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                          {delta > 0 ? "+" : ""}{delta}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{d.runs} {d.runs === 1 ? "audit" : "audits"} · view trend</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

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
