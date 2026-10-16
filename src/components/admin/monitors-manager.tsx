"use client";

import { useCallback, useState } from "react";
import { Radar, ScanSearch, PauseCircle, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInitialFetch } from "@/lib/use-initial-fetch";

interface MonitorRow {
  id: string;
  domain: string;
  target: string;
  mode: string;
  deepScan: boolean;
  intervalDays: number;
  active: boolean;
  pausedReason: string | null;
  runs: number;
  lastScore: number | null;
  lastRunAt: string | null;
  nextRunAt: string;
  overdueMinutes: number | null;
  user: { email: string; status: string };
  createdAt: string;
}

interface Payload {
  monitors: MonitorRow[];
  summary: { total: number; active: number; deep: number; overdue: number };
}

function fmtWhen(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtNext(iso: string, overdueMinutes: number | null): string {
  if (overdueMinutes !== null) {
    if (overdueMinutes >= 1440) return `overdue ${Math.floor(overdueMinutes / 1440)}d`;
    if (overdueMinutes >= 60) return `overdue ${Math.floor(overdueMinutes / 60)}h`;
    return `overdue ${overdueMinutes}m`;
  }
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return days <= 0 ? "due today" : `in ${days}d`;
}

export function MonitorsManager() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "deep" | "overdue">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/monitors");
    const d = await res.json().catch(() => ({}));
    setData({ monitors: d.monitors || [], summary: d.summary || { total: 0, active: 0, deep: 0, overdue: 0 } });
    setLoading(false);
  }, []);
  useInitialFetch(load);

  const monitors = data?.monitors || [];
  const summary = data?.summary || { total: 0, active: 0, deep: 0, overdue: 0 };
  const shown = monitors.filter((m) =>
    filter === "all" ? true
      : filter === "active" ? m.active
        : filter === "deep" ? m.deepScan
          : m.overdueMinutes !== null
  );

  const FILTERS: { key: typeof filter; label: string }[] = [
    { key: "all", label: `All (${summary.total})` },
    { key: "active", label: `Active (${summary.active})` },
    { key: "deep", label: `Deep scan (${summary.deep})` },
    { key: "overdue", label: `Overdue (${summary.overdue})` },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Monitors</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every scheduled site check on the platform. Overdue rows wait on the automation tick; runs charge the owner credits at check time.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter monitors">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "h-8 rounded-sm border px-3 text-xs font-semibold transition-colors",
              filter === f.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/60 text-left">
              <th className="px-4 py-2.5 font-bold">Domain</th>
              <th className="px-4 py-2.5 font-bold">Owner</th>
              <th className="px-4 py-2.5 font-bold">Depth</th>
              <th className="px-4 py-2.5 font-bold">Cadence</th>
              <th className="px-4 py-2.5 font-bold">Last score</th>
              <th className="px-4 py-2.5 font-bold">Runs</th>
              <th className="px-4 py-2.5 font-bold">Next check</th>
              <th className="px-4 py-2.5 font-bold">State</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No monitors match this filter.</td></tr>
            ) : shown.map((m) => (
              <tr key={m.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-secondary/40">
                <td className="px-4 py-3 font-semibold text-foreground">{m.domain}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {m.user.email}
                  {m.user.status === "SUSPENDED" && (
                    <span className="ml-1.5 rounded-sm bg-risk/10 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-risk">Suspended</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-semibold text-muted-foreground">{m.target.toLowerCase()} · {m.mode.toLowerCase()}</span>
                  {m.deepScan && (
                    <span className="ml-1.5 inline-flex items-center gap-1 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold text-primary">
                      <ScanSearch className="h-3 w-3" aria-hidden="true" /> Deep
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">every {m.intervalDays}d</td>
                <td className="px-4 py-3">
                  {m.lastScore === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className={cn("rounded-sm px-2 py-1 text-xs font-bold",
                      m.lastScore >= 70 ? "bg-ok-soft text-ok" : m.lastScore >= 45 ? "bg-warn-soft text-warn" : "bg-risk-soft text-risk")}>
                      {m.lastScore}%
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{m.runs}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {m.active ? (
                    <span className={cn("font-semibold", m.overdueMinutes !== null && "text-warn")}>{fmtNext(m.nextRunAt, m.overdueMinutes)}</span>
                  ) : "—"}
                  <span className="block text-[11px] text-muted-foreground/80">last run {fmtWhen(m.lastRunAt)}</span>
                </td>
                <td className="px-4 py-3">
                  {m.active ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-ok"><Radar className="h-3.5 w-3.5" aria-hidden="true" /> Active</span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground"
                      title={m.pausedReason || undefined}
                    >
                      <PauseCircle className="h-3.5 w-3.5" aria-hidden="true" /> Paused
                      {m.pausedReason && <CircleAlert className="h-3.5 w-3.5 text-warn" aria-hidden="true" />}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
