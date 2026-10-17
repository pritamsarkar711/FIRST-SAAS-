import { Link, usePage } from "@inertiajs/react";
import { Users, SearchCheck, Receipt, Coins, ArrowRight, CircleCheck, CircleX, Clock, Radar, PauseCircle, AlarmClock, ScanSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminShell } from "@/components/admin/shell";

interface PendingPayment {
  id: string;
  planName: string;
  gateway: string;
  amount: number;
  createdAt: string;
  user: { email: string };
}
interface RecentUser {
  id: string;
  email: string;
  name: string | null;
  credits: number;
  createdAt: string;
}
interface RecentAudit {
  id: string;
  domain: string;
  target: string;
  mode: string;
  status: string;
  probability: number;
  user: { email: string };
}
interface AttentionItem {
  id: string;
  domain: string;
  intervalDays: number;
  active: boolean;
  pausedReason: string | null;
  user: { email: string };
}

export default function ManageDashboard() {
  const { props } = usePage<any>();
  const adminName = props.adminName ?? (props.auth?.user?.name || props.auth?.user?.email || "");

  const statsData = {
    users: props.stats?.users ?? 0,
    audits7d: props.stats?.audits7d ?? 0,
    auditsTotal: props.stats?.auditsTotal ?? 0,
    revenue: props.stats?.revenue ?? 0,
  };
  const pendingPayments: PendingPayment[] = props.pendingPayments ?? [];
  const recentUsers: RecentUser[] = props.recentUsers ?? [];
  const recentAudits: RecentAudit[] = props.recentAudits ?? [];
  const activeMonitors = props.monitors?.active ?? 0;
  const dueMonitors = props.monitors?.due ?? 0;
  const pausedMonitors = props.monitors?.paused ?? 0;
  const watchFailures7d = props.monitors?.failures7d ?? 0;
  const deepMonitors = props.monitors?.deep ?? 0;
  const attentionItems: AttentionItem[] = props.attentionItems ?? [];

  const stats = [
    { label: "Users", value: statsData.users, icon: Users, href: "/manage/users" },
    { label: "Audits (7 days)", value: statsData.audits7d, icon: SearchCheck, href: "/manage/audits" },
    { label: "Audits total", value: statsData.auditsTotal, icon: SearchCheck, href: "/manage/audits" },
    { label: "Revenue", value: `$${statsData.revenue.toFixed(2)}`, icon: Coins, href: "/manage/payments" },
  ];

  return (
    <AdminShell adminName={adminName}>
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Manage dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Everything happening on the platform at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="group rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-[0_2px_10px_rgba(27,38,32,0.07)]">
            <div className="flex items-center justify-between">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-accent text-primary"><s.icon className="h-4.5 w-4.5" /></span>
              <ArrowRight className="h-4 w-4 text-muted-foreground/0 transition-all group-hover:text-muted-foreground" />
            </div>
            <p className="mt-3 text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-bold text-foreground"><Radar className="h-4.5 w-4.5 text-primary" /> Site monitoring health</h2>
          <div className="flex items-center gap-3">
            <Link href="/manage/monitors" className="text-sm font-semibold text-primary hover:underline">All monitors</Link>
            <Link href="/manage/activity?tab=monitoring" className="text-sm font-semibold text-primary hover:underline">Monitoring log</Link>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            { label: "Active monitors", value: activeMonitors, cls: "", icon: Radar },
            { label: "Deep scan", value: deepMonitors, cls: "", icon: ScanSearch },
            { label: "Due now", value: dueMonitors, cls: dueMonitors > 0 ? "text-warn" : "", icon: AlarmClock },
            { label: "Auto-paused", value: pausedMonitors, cls: pausedMonitors > 0 ? "text-risk" : "", icon: PauseCircle },
            { label: "Failed checks (7d)", value: watchFailures7d, cls: watchFailures7d > 0 ? "text-risk" : "", icon: CircleX },
          ].map((s) => (
            <div key={s.label} className="rounded-md border border-border bg-secondary/40 px-3.5 py-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><s.icon className="h-3.5 w-3.5" aria-hidden="true" /> {s.label}</p>
              <p className={cn("mt-1 text-xl font-bold", s.cls || "text-foreground")}>{s.value}</p>
            </div>
          ))}
        </div>
        {attentionItems.length > 0 && (
          <ul className="mt-3 divide-y divide-border">
            {attentionItems.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{w.domain}</p>
                  <p className="text-xs text-muted-foreground">{w.user.email} · every {w.intervalDays}d</p>
                </div>
                {w.active ? (
                  <span className="shrink-0 rounded-sm bg-warn-soft px-2 py-0.5 text-xs font-bold text-warn">due now</span>
                ) : (
                  <span className="shrink-0 max-w-[55%] truncate rounded-sm bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground" title={w.pausedReason || "Paused"}>paused</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold text-foreground"><Clock className="h-4.5 w-4.5 text-primary" /> Payments awaiting review</h2>
            <Link href="/manage/payments" className="text-sm font-semibold text-primary hover:underline">All</Link>
          </div>
          {pendingPayments.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nothing pending. Good work.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {pendingPayments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{p.user.email}</p>
                    <p className="text-xs text-muted-foreground">{p.planName} · {p.gateway} · {new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-foreground">${p.amount.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-foreground">Newest users</h2>
            <Link href="/manage/users" className="text-sm font-semibold text-primary hover:underline">All</Link>
          </div>
          <ul className="mt-3 divide-y divide-border">
            {recentUsers.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{u.name || u.email}</p>
                  <p className="text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                </div>
                <span className="shrink-0 rounded-sm bg-accent px-2 py-0.5 text-xs font-bold text-primary">{u.credits} cr</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="font-bold text-foreground">Latest audits</h2>
        <ul className="mt-3 divide-y divide-border">
          {recentAudits.length === 0 && <li className="py-3 text-sm text-muted-foreground">No audits yet.</li>}
          {recentAudits.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{a.domain}</p>
                <p className="text-xs text-muted-foreground">{a.user.email} · {a.target.toLowerCase()} · {a.mode.toLowerCase()}</p>
              </div>
              {a.status === "DONE" ? (
                <span className={`shrink-0 rounded-sm px-2 py-1 text-xs font-bold ${a.probability >= 70 ? "bg-ok-soft text-ok" : a.probability >= 45 ? "bg-warn-soft text-warn" : "bg-risk-soft text-risk"}`}>
                  {a.probability}%
                </span>
              ) : a.status === "FAILED" ? (
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-risk"><CircleX className="h-3.5 w-3.5" /> failed</span>
              ) : (
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-warn"><CircleCheck className="h-3.5 w-3.5" /> running</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-foreground"><Receipt className="h-3.5 w-3.5" /> Tip: review manual payments at least once per day to keep users happy.</p>
    </div>
    </AdminShell>
  );
}
