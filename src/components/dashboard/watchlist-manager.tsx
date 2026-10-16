"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Radar, Play, Pause, Trash2, CircleCheck, CircleAlert, CircleMinus, Plus, ArrowRight, Coins, RefreshCw, ScanSearch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { Illustration } from "@/components/shared/illustration";
import { cn } from "@/lib/utils";

interface WatchHistoryPoint { id: string; probability: number; createdAt: string }
interface WatchItem {
  id: string; domain: string; target: string; mode: string; deepScan: boolean; intervalDays: number;
  active: boolean; lastAuditId: string | null; lastScore: number | null;
  lastRunAt: string | null; nextRunAt: string | null; runs: number; pausedReason: string | null;
  running: boolean; history: WatchHistoryPoint[];
}

const NETWORKS = [
  { value: "ADSENSE", label: "Google AdSense" },
  { value: "EZOIC", label: "Ezoic" },
  { value: "MEDIAVINE", label: "Mediavine" },
  { value: "RAPTIVE", label: "Raptive" },
];

const MODE_LABELS: Record<string, string> = { NORMAL: "Normal", STANDARD: "Standard", PREMIUM: "Premium" };

function timeUntil(iso: string | null): string {
  if (!iso) return "not scheduled";
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "due now";
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "within the hour";
  if (hours < 48) return `in ${hours}h`;
  return `in ${Math.round(hours / 24)} days`;
}

function scoreColor(score: number): string {
  return score >= 70 ? "text-primary" : score >= 45 ? "text-[#b45309]" : "text-[#b91c1c]";
}

/** Tiny inline sparkline of the last checks. */
function Spark({ points }: { points: WatchHistoryPoint[] }) {
  if (points.length < 2) return null;
  const w = 96;
  const h = 28;
  const vals = points.map((p) => p.probability);
  const min = Math.min(...vals, 0);
  const max = Math.max(...vals, 100);
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * (w - 4) + 2;
    const y = h - 3 - ((p.probability - min) / Math.max(max - min, 1)) * (h - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = points[points.length - 1].probability;
  const stroke = last >= 70 ? "#0d6b4d" : last >= 45 ? "#b45309" : "#b91c1c";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" aria-hidden="true">
      <polyline points={coords.join(" ")} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={coords[coords.length - 1].split(",")[0]} cy={coords[coords.length - 1].split(",")[1]} r="2.4" fill={stroke} />
    </svg>
  );
}

export function WatchlistManager({ credits, costs, deepCost = 6 }: { credits: number; costs: { normal: number; standard: number; premium: number }; deepCost?: number }) {
  const router = useRouter();
  const [items, setItems] = useState<WatchItem[] | null>(null);
  const [balance, setBalance] = useState(credits);
  const [limit, setLimit] = useState<number | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);

  const [domain, setDomain] = useState("");
  const [target, setTarget] = useState("ADSENSE");
  const [mode, setMode] = useState("STANDARD");
  const [deep, setDeep] = useState(false);
  const [intervalDays, setIntervalDays] = useState("7");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items);
      setBalance(data.credits);
      setLimit(typeof data.limit === "number" ? data.limit : null);
      setPlanName(data.planName || null);
      // stop polling when no item has a check in flight
      if (pollRef.current && !data.items.some((i: WatchItem) => i.running)) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    } catch { /* keep old state */ }
  }, []);

  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(async () => {
      await load();
      setLoading(false);
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  // Lazy scheduler: when the monitoring page loads, run any due checks once per browser session.
  useEffect(() => {
    if (tickedRef.current) return;
    tickedRef.current = true;
    let key = "adaudit-watchtick";
    let last = 0;
    try { last = Number(sessionStorage.getItem(key) || 0); } catch { /* private mode */ }
    if (Date.now() - last < 30 * 60_000) return;
    try { sessionStorage.setItem(key, String(Date.now())); } catch { /* ignore */ }
    fetch("/api/watchlist/tick", { method: "POST" }).catch(() => {});
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    let ticks = 0;
    pollRef.current = setInterval(async () => {
      ticks++;
      await load();
      if (ticks > 60) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    }, 4000);
  }, [load]);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setAddError("");
    setNotice("");
    setAdding(true);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, target, mode, intervalDays: Number(intervalDays), deepScan: deep }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAddError(data.error || "Could not add the domain.");
        return;
      }
      setDomain("");
      setNotice("Monitoring added. The first scheduled check will run on its cycle, or use Check now to start immediately.");
      await load();
      router.refresh();
    } catch {
      setAddError("Network error. Try again.");
    } finally {
      setAdding(false);
    }
  }

  async function toggleItem(item: WatchItem) {
    setRowBusy(item.id);
    setNotice("");
    try {
      await fetch(`/api/watchlist/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !item.active }),
      });
      await load();
    } finally {
      setRowBusy(null);
    }
  }

  async function runNow(item: WatchItem) {
    setRowBusy(item.id);
    setNotice("");
    try {
      const res = await fetch(`/api/watchlist/${item.id}/run`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data.error || "Could not start the check.");
        await load();
        return;
      }
      setNotice(`Check started for ${item.domain}. The report link appears here the moment it is ready.`);
      startPolling();
      await load();
    } finally {
      setRowBusy(null);
    }
  }

  async function removeItem(item: WatchItem) {
    setRowBusy(item.id);
    try {
      await fetch(`/api/watchlist/${item.id}`, { method: "DELETE" });
      await load();
      router.refresh();
    } finally {
      setRowBusy(null);
    }
  }

  const activeCount = items?.filter((i) => i.active).length ?? 0;
  const cost = costs[mode.toLowerCase() as "normal" | "standard" | "premium"];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Site monitoring</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Put your important domains on a repeating check. Audit Form re-audits each site on its schedule,
            scores it, and keeps a trend of every check so you can see approval odds moving.
          </p>
        </div>
        <div className="rounded-md border border-border bg-card px-4 py-2.5 text-sm">
          {limit === null ? (
            <span className="flex items-center gap-2" aria-hidden="true">
              <span className="h-4 w-14 animate-pulse rounded-sm bg-secondary" />
              <span className="text-border">|</span>
              <span className="h-4 w-36 animate-pulse rounded-sm bg-secondary" />
            </span>
          ) : (
            <>
              <span className="font-bold">{balance}</span> <span className="text-muted-foreground">credits</span>
              <span className="mx-2 text-border">|</span>
              <span className="font-bold">{activeCount}</span> <span className="text-muted-foreground">of {limit} monitors active</span>
              {planName && <span className="ml-2 rounded-sm bg-accent px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">{planName}</span>}
              {activeCount >= limit && (
                <Link href="/dashboard/billing" className="ml-2 font-semibold text-primary hover:underline">Upgrade</Link>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Monitored domains */}
        <section aria-label="Monitored domains" className="order-2 lg:order-1">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Monitored domains</h2>
          {loading ? (
            <div className="space-y-3" aria-hidden="true">
              {[0, 1].map((i) => (
                <div key={i} className="h-[118px] animate-pulse rounded-lg border border-border bg-secondary/40" />
              ))}
            </div>
          ) : items && items.length > 0 ? (
            <ul className="space-y-3">
              {items.map((item) => {
                const isRunning = item.running;
                return (
                  <li key={item.id} className="rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {item.active ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" aria-hidden="true" /> Paused
                            </span>
                          )}
                          <h3 className="truncate text-[15px] font-bold">{item.domain}</h3>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {NETWORKS.find((n) => n.value === item.target)?.label ?? item.target}
                          {" · "}{MODE_LABELS[item.mode] ?? item.mode} mode
                          {item.deepScan && (
                            <span className="ml-1.5 inline-flex items-center gap-1 font-bold text-primary">
                              <ScanSearch className="h-3 w-3" aria-hidden="true" /> Deep scan
                            </span>
                          )}
                          {" · "}every {item.intervalDays} days
                          {" · "}{item.runs} {item.runs === 1 ? "check" : "checks"} run
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Next check {timeUntil(item.nextRunAt)}
                        </p>
                        {item.pausedReason && (
                          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-[#b45309]">
                            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            {item.pausedReason}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-4">
                        {item.history.length >= 2 && <Spark points={[...item.history].reverse()} />}
                        {item.lastScore !== null ? (
                          <div className="text-right">
                            <p className={cn("text-2xl font-bold leading-none", scoreColor(item.lastScore))}>
                              {item.lastScore}%
                            </p>
                            <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">last score</p>
                          </div>
                        ) : (
                          <div className="text-right">
                            <p className="text-2xl font-bold leading-none text-muted-foreground/50">--</p>
                            <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">no check yet</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runNow(item)}
                        disabled={rowBusy === item.id || isRunning}
                        className="gap-1.5"
                      >
                        {isRunning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
                        Check now
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleItem(item)}
                        disabled={rowBusy === item.id}
                        className="gap-1.5"
                      >
                        {item.active ? <Pause className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
                        {item.active ? "Pause" : "Resume"}
                      </Button>
                      <Select
                        value={String(item.intervalDays)}
                        onValueChange={async (v) => {
                          setRowBusy(item.id);
                          try {
                            await fetch(`/api/watchlist/${item.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ intervalDays: Number(v) }),
                            });
                            await load();
                          } finally { setRowBusy(null); }
                        }}
                      >
                        <SelectTrigger className="h-8 w-[132px] text-xs" aria-label="Check interval">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">Every 7 days</SelectItem>
                          <SelectItem value="14">Every 14 days</SelectItem>
                          <SelectItem value="30">Every 30 days</SelectItem>
                        </SelectContent>
                      </Select>

                      <button
                        type="button"
                        onClick={async () => {
                          setRowBusy(item.id);
                          try {
                            await fetch(`/api/watchlist/${item.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ deepScan: !item.deepScan }),
                            });
                            await load();
                          } finally { setRowBusy(null); }
                        }}
                        disabled={rowBusy === item.id}
                        aria-pressed={item.deepScan}
                        aria-label={`Deep scan is ${item.deepScan ? "on" : "off"} for ${item.domain}`}
                        className={cn(
                          "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-bold transition-colors disabled:opacity-50",
                          item.deepScan
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <ScanSearch className="h-3.5 w-3.5" aria-hidden="true" />
                        Deep
                      </button>

                      <div className="ml-auto flex items-center gap-2">
                        {item.lastAuditId && (
                          <Link
                            href={`/dashboard/audit/${item.lastAuditId}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                          >
                            Latest report <ArrowRight className="h-3 w-3" aria-hidden="true" />
                          </Link>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeItem(item)}
                          disabled={rowBusy === item.id}
                          className="h-8 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Stop monitoring ${item.domain}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remove
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              image="monitor"
              title="No domains monitored yet"
              body="Add a domain and Audit Form will re-check it on a schedule, keep every score, and show you the trend."
              size="md"
            />
          )}

          {notice && (
            <p className="mt-3 flex items-start gap-2 rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-muted-foreground" role="status">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              {notice}
            </p>
          )}
        </section>

        {/* Add form */}
        <aside className="order-1 lg:order-2">
          <form onSubmit={addItem} className="rounded-lg border border-border bg-card p-5" aria-label="Add a domain to monitoring">
            <h2 className="flex items-center gap-2 text-[15px] font-bold">
              <Plus className="h-4 w-4 text-primary" aria-hidden="true" /> Monitor a domain
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Each scheduled check uses the same credits as a normal audit in the chosen mode.
            </p>

            <div className="mt-4 space-y-3.5">
              <div>
                <label htmlFor="watch-domain" className="mb-1.5 block text-sm font-semibold">Domain</label>
                <Input
                  id="watch-domain"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="yourblog.com"
                  required
                  minLength={4}
                  maxLength={120}
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold">Ad network</label>
                <Select value={target} onValueChange={setTarget}>
                  <SelectTrigger aria-label="Ad network"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NETWORKS.map((n) => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Depth</label>
                  <Select value={mode} onValueChange={setMode}>
                    <SelectTrigger aria-label="Audit mode"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NORMAL">Normal</SelectItem>
                      <SelectItem value="STANDARD">Standard</SelectItem>
                      <SelectItem value="PREMIUM">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Repeat</label>
                  <Select value={intervalDays} onValueChange={setIntervalDays}>
                    <SelectTrigger aria-label="Repeat interval"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Every 7 days</SelectItem>
                      <SelectItem value="14">Every 14 days</SelectItem>
                      <SelectItem value="30">Every 30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <label
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-md border p-3 transition-colors",
                  deep ? "border-primary bg-accent" : "border-border bg-card hover:border-input"
                )}
              >
                <input
                  type="checkbox"
                  checked={deep}
                  onChange={(e) => setDeep(e.target.checked)}
                  className="sr-only"
                  aria-describedby="watch-deep-desc"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-sm border",
                    deep ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card"
                  )}
                >
                  {deep && (
                    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 6.5 4.7 9 10 3.4" />
                    </svg>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-foreground">
                    Deep scan
                    <span className="inline-flex items-center gap-1 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                      <ScanSearch className="h-3 w-3" aria-hidden="true" /> +{deepCost}
                    </span>
                  </span>
                  <span id="watch-deep-desc" className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    Every scheduled check samples 10 articles and verifies your policy pages for real.
                  </span>
                </span>
              </label>

              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Coins className="h-3.5 w-3.5" aria-hidden="true" />
                {cost + (deep ? deepCost : 0)} credits per check{deep ? ` (${cost} + ${deepCost} deep)` : ""} · {balance} available
              </p>

              {addError && (
                <p className="flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive" role="alert">
                  <CircleMinus className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {addError}
                </p>
              )}

              <Button type="submit" disabled={adding || !domain.trim()} className="w-full gap-1.5">
                <Radar className="h-4 w-4" aria-hidden="true" />
                {adding ? "Adding…" : "Start monitoring"}
              </Button>
            </div>
          </form>

          <div className="mt-4 rounded-lg border border-dashed border-border bg-secondary/40 p-4 text-xs leading-relaxed text-muted-foreground">
            <div className="flex items-start gap-3">
              <Illustration name="monitor" alt="" className="hidden h-16 w-20 shrink-0 sm:block [&>img]:h-full [&>img]:w-full [&>img]:object-contain" />
              <div>
                <p className="font-bold text-foreground">How scheduling works</p>
                <p className="mt-1.5">
                  Checks run automatically when you open the dashboard, or around the clock if your host
                  pings the monitoring endpoint. If a check cannot run because credits ran out, the monitor
                  pauses itself and tells you, so nothing silently fails.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
