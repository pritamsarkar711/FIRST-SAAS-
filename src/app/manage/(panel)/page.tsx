import Link from "next/link";
import { Users, SearchCheck, Receipt, Coins, ArrowRight, CircleCheck, CircleX, Clock } from "lucide-react";
import { db } from "@/lib/db";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const [users, audits7d, auditsTotal, revenueAgg, pendingPayments, recentUsers, recentAudits] = await Promise.all([
    db.user.count(),
    db.audit.count({ where: { createdAt: { gte: since7d } } }),
    db.audit.count(),
    db.payment.aggregate({ where: { status: "APPROVED" }, _sum: { amount: true } }),
    db.payment.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 6, include: { user: { select: { email: true } } } }),
    db.user.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, email: true, name: true, createdAt: true, credits: true } }),
    db.audit.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { user: { select: { email: true } } } }),
  ]);
  const revenue = revenueAgg._sum.amount || 0;

  const stats = [
    { label: "Users", value: users, icon: Users, href: "/manage/users" },
    { label: "Audits (7 days)", value: audits7d, icon: SearchCheck, href: "/manage/audits" },
    { label: "Audits total", value: auditsTotal, icon: SearchCheck, href: "/manage/audits" },
    { label: "Revenue", value: `$${revenue.toFixed(2)}`, icon: Coins, href: "/manage/payments" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Manage dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Everything happening on the platform at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="group rounded-lg border border-border bg-white p-5 transition-shadow hover:shadow-[0_2px_10px_rgba(27,38,32,0.07)]">
            <div className="flex items-center justify-between">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-accent text-primary"><s.icon className="h-4.5 w-4.5" /></span>
              <ArrowRight className="h-4 w-4 text-muted-foreground/0 transition-all group-hover:text-muted-foreground" />
            </div>
            <p className="mt-3 text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-white p-5">
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

        <div className="rounded-lg border border-border bg-white p-5">
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

      <div className="rounded-lg border border-border bg-white p-5">
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
  );
}
