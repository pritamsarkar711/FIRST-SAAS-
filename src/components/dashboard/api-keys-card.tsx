"use client";

import { useCallback, useState } from "react";
import { Terminal, Copy, CircleCheck, Plus, Trash2, ExternalLink, Activity, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useInitialFetch } from "@/lib/use-initial-fetch";

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  requestCount: number;
  dailyCap: number | null;
  revokedAt: string | null;
  createdAt: string;
}

interface UsageDay { day: string; count: number }

const CAP_CHOICES = [25, 50, 100, 250, 500] as const;

export function ApiKeysCard() {
  const [keys, setKeys] = useState<ApiKeyRow[] | null>(null);
  const [usage, setUsage] = useState<UsageDay[] | null>(null);
  const [perKey, setPerKey] = useState<Record<string, UsageDay[]>>({});
  const [chartKey, setChartKey] = useState<string>("all");
  const [maxActive, setMaxActive] = useState(5);
  const [name, setName] = useState("");
  const [createCap, setCreateCap] = useState<string>("");
  const [capEdit, setCapEdit] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [freshSecret, setFreshSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/keys");
      if (res.ok) {
        const d = await res.json();
        setKeys(d.keys || []);
        setMaxActive(d.maxActive ?? 5);
        setUsage(Array.isArray(d.usage) ? d.usage : []);
        setPerKey(d.perKey && typeof d.perKey === "object" ? d.perKey : {});
      } else {
        setKeys([]);
        setUsage([]);
        setPerKey({});
      }
    } catch {
      setKeys([]);
      setUsage([]);
      setPerKey({});
    }
  }, []);
  useInitialFetch(load);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    setError("");
    setNotice("");
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", name, dailyCap: createCap ? Number(createCap) : null }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy("");
    if (res.ok) {
      setName("");
      setCreateCap("");
      setFreshSecret(d.secret);
      setCopied(false);
      void load();
    } else {
      setError(d.error || "Could not create the key.");
    }
  }

  async function setCap(id: string) {
    const raw = capEdit[id];
    if (raw === undefined) return;
    const value = raw.trim() === "" ? null : Number(raw);
    if (value !== null && (!Number.isFinite(value) || value < 1)) {
      setError("Cap must be a number of 1 or more, or empty for unlimited.");
      return;
    }
    setBusy(`cap-${id}`);
    setError("");
    setNotice("");
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setCap", id, dailyCap: value }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy("");
    if (res.ok) {
      setNotice(value === null ? "Daily cap removed. This key is unlimited again." : `Daily cap set to ${value.toLocaleString()} requests per day.`);
      setCapEdit((m) => { const next = { ...m }; delete next[id]; return next; });
      void load();
    } else {
      setError(d.error || "Could not update the cap.");
    }
  }

  async function revokeKey(id: string) {
    setBusy(id);
    setError("");
    setNotice("");
    await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke", id }),
    });
    setBusy("");
    setNotice("Key revoked. Scripts using it will get a 401 until you create a new one.");
    void load();
  }

  async function copySecret() {
    if (!freshSecret) return;
    try {
      await navigator.clipboard.writeText(freshSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const activeCount = (keys || []).filter((k) => !k.revokedAt).length;
  const activeKeys = (keys || []).filter((k) => !k.revokedAt);
  const series = chartKey === "all" ? (usage || []) : (perKey[chartKey] || usage || []);
  const chartTitle = chartKey === "all"
    ? "API calls · last 14 days"
    : `API calls · ${keys?.find((k) => k.id === chartKey)?.name || "key"} · last 14 days`;
  const todayCount = series.length ? series[series.length - 1].count : 0;

  return (
    <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-bold text-foreground">
        <Terminal className="h-4.5 w-4.5 text-primary" /> Developer API
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Start audits from your own scripts and apps with a bearer key. Keys use the same credit balance as the dashboard, and each key can carry its own daily call cap.{" "}
        <a href="/docs/api" className="font-semibold text-primary underline underline-offset-2">
          Read the API docs <ExternalLink className="inline h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </p>

      {/* One-time secret */}
      {freshSecret && (
        <div className="mt-4 rounded-md border-2 border-primary/40 bg-primary/5 p-4" role="alert">
          <p className="text-sm font-bold text-foreground">Copy this key now. It is shown only once.</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <code className="min-w-0 flex-1 truncate rounded-sm bg-secondary px-3 py-2.5 font-mono text-xs text-foreground" aria-label="Your new API key">
              {freshSecret}
            </code>
            <Button type="button" variant="outline" onClick={copySecret} className="h-10 shrink-0 rounded-md font-semibold">
              {copied ? <CircleCheck className="mr-2 h-4 w-4 text-ok" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? "Copied" : "Copy key"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Only a hash is stored, so nobody can recover this value later, including us.</p>
        </div>
      )}

      {/* Usage chart with per-key selector */}
      {usage !== null && keys !== null && keys.length > 0 && (
        <div className="mt-5 rounded-md border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <Activity className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> {chartTitle}
            </p>
            <p className="text-xs text-muted-foreground">
              {series.reduce((s, d) => s + d.count, 0)} total · {todayCount} today
            </p>
          </div>

          {activeKeys.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5" role="tablist" aria-label="Choose which key's usage to chart">
              <button
                type="button"
                role="tab"
                aria-selected={chartKey === "all"}
                onClick={() => setChartKey("all")}
                className={cn(
                  "h-7 rounded-sm border px-2.5 text-xs font-semibold transition-colors",
                  chartKey === "all"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                All keys
              </button>
              {keys.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  role="tab"
                  aria-selected={chartKey === k.id}
                  onClick={() => setChartKey(k.id)}
                  className={cn(
                    "h-7 max-w-40 truncate rounded-sm border px-2.5 text-xs font-semibold transition-colors",
                    chartKey === k.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    k.revokedAt && "opacity-55",
                  )}
                  title={k.name}
                >
                  {k.name}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 flex h-20 items-end gap-1.5" role="img" aria-label={`API usage for the last 14 days, ${series.reduce((s, d) => s + d.count, 0)} calls in total`}>
            {series.map((d) => {
              const max = Math.max(...series.map((x) => x.count), 1);
              const pct = d.count === 0 ? 0 : Math.max(8, Math.round((d.count / max) * 100));
              return (
                <div key={d.day} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`${d.day}: ${d.count} ${d.count === 1 ? "call" : "calls"}`}>
                  <span className={cn(
                    "pointer-events-none absolute -top-1 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-sm bg-foreground px-1.5 py-0.5 text-[10px] font-bold text-background group-hover:block",
                  )}>
                    {d.count}
                  </span>
                  <div
                    className={cn(
                      "w-full rounded-t-sm transition-colors",
                      d.count === 0 ? "bg-muted" : "bg-primary group-hover:bg-primary/80"
                    )}
                    style={{ height: `${d.count === 0 ? 4 : pct}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
            <span>{new Date(series[0]?.day || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            <span>Today</span>
          </div>
        </div>
      )}

      {/* Key list */}
      {keys === null ? (
        <div className="mt-4 space-y-2">
          {[0, 1].map((i) => <div key={i} className="h-11 animate-pulse rounded-md bg-muted" />)}
        </div>
      ) : keys.length === 0 ? (
        <p className="mt-4 rounded-md bg-secondary px-3 py-2.5 text-sm text-muted-foreground">
          No API keys yet. Create one below to call the audit API from your own code.
        </p>
      ) : (
        <ul className="mt-4 max-h-96 divide-y divide-border overflow-y-auto rounded-md border border-border">
          {keys.map((k) => {
            const editing = capEdit[k.id] !== undefined;
            const todayFor = perKey[k.id]?.length ? perKey[k.id][perKey[k.id].length - 1].count : 0;
            const overCap = k.dailyCap !== null && todayFor >= k.dailyCap;
            return (
              <li key={k.id} className="px-3.5 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      k.revokedAt ? "bg-risk" : overCap ? "bg-warn" : "bg-ok",
                    )}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                      {k.name}
                      {k.revokedAt && <span className="rounded-sm bg-risk/10 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-risk">Revoked</span>}
                      {!k.revokedAt && overCap && <span className="rounded-sm bg-warn/10 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-warn">Cap reached</span>}
                    </p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {k.prefix}··· · {k.requestCount} {k.requestCount === 1 ? "call" : "calls"} all time
                      {k.dailyCap !== null ? ` · cap ${k.dailyCap.toLocaleString()}/day` : " · no cap"}
                      {k.lastUsedAt ? ` · last used ${new Date(k.lastUsedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : " · never used"}
                    </p>
                  </div>
                  {!k.revokedAt && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setCapEdit((m) => (m[k.id] !== undefined ? (() => { const next = { ...m }; delete next[k.id]; return next; })() : { ...m, [k.id]: String(k.dailyCap ?? "") }))}
                        disabled={busy === `cap-${k.id}`}
                        className="h-8 rounded-md text-muted-foreground hover:text-foreground"
                        aria-label={`Edit daily cap for ${k.name}`}
                      >
                        <Gauge className="h-4 w-4" aria-hidden="true" /> Cap
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => revokeKey(k.id)}
                        disabled={busy === k.id}
                        className="h-8 rounded-md text-risk hover:text-risk"
                        aria-label={`Revoke API key ${k.name}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" /> Revoke
                      </Button>
                    </div>
                  )}
                </div>
                {!k.revokedAt && editing && (
                  <form
                    onSubmit={(e) => { e.preventDefault(); void setCap(k.id); }}
                    className="mt-2.5 flex flex-col gap-2 rounded-md bg-secondary/60 p-2.5 sm:flex-row sm:items-center"
                  >
                    <label htmlFor={`cap-${k.id}`} className="sr-only">Daily cap for {k.name}</label>
                    <Input
                      id={`cap-${k.id}`}
                      type="number"
                      min={1}
                      max={10000}
                      value={capEdit[k.id]}
                      onChange={(e) => setCapEdit((m) => ({ ...m, [k.id]: e.target.value }))}
                      placeholder="Requests per day, empty = unlimited"
                      className="h-9 flex-1 rounded-sm bg-card"
                    />
                    <div className="flex items-center gap-1.5">
                      {CAP_CHOICES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCapEdit((m) => ({ ...m, [k.id]: String(c) }))}
                          className="h-9 rounded-sm border border-border bg-card px-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                          aria-label={`Set cap to ${c}`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button type="submit" size="sm" disabled={busy === `cap-${k.id}`} className="h-9 rounded-sm font-semibold">Save</Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setCapEdit((m) => { const next = { ...m }; delete next[k.id]; return next; })}
                        className="h-9 rounded-sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Create form */}
      <form onSubmit={createKey} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="api-key-name" className="sr-only">Key name</label>
          <Input
            id="api-key-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Key name, e.g. CI script"
            maxLength={40}
            className="h-11 rounded-md"
          />
        </div>
        <div className="sm:w-44">
          <label htmlFor="api-key-cap" className="sr-only">Daily call cap</label>
          <Input
            id="api-key-cap"
            type="number"
            min={1}
            max={10000}
            value={createCap}
            onChange={(e) => setCreateCap(e.target.value)}
            placeholder="Daily cap (optional)"
            className="h-11 rounded-md"
          />
        </div>
        <Button type="submit" disabled={name.trim().length < 2 || busy === "create" || activeCount >= maxActive} className="h-11 rounded-md font-semibold">
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Create key
        </Button>
      </form>
      {error && <p className="mt-2 text-sm font-medium text-risk" role="alert">{error}</p>}
      {notice && !error && <p className="mt-2 text-sm font-medium text-ok" role="status">{notice}</p>}
      {activeCount >= maxActive && !error && (
        <p className="mt-2 text-xs text-muted-foreground">Limit of {maxActive} active keys reached. Revoke one to add another.</p>
      )}
    </div>
  );
}
