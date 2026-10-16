"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleMinus, CircleX, SearchCheck, FileDown, Trash2, Coins, Layers, RotateCw, LineChart, ExternalLink, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScoreRing, VerdictBadge, StatusIcon } from "@/components/shared/report-ui";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

interface StartResponse {
  ok?: boolean; id?: string; batchId?: string | null; error?: string; needCredits?: number;
  audits?: { id: string; domain: string }[]; invalid?: string[];
}
interface HistoryItem {
  id: string; domain: string; target: string; mode: string; deepScan?: boolean; status: string;
  probability: number; verdict: string | null; batchId: string | null; createdAt: string;
}
interface BatchRow { id: string; domain: string; status: string; probability: number; verdict: string | null; error: string | null }

const NETWORKS = [
  { value: "ADSENSE", label: "Google AdSense" },
  { value: "EZOIC", label: "Ezoic" },
  { value: "MEDIAVINE", label: "Mediavine" },
  { value: "RAPTIVE", label: "Raptive" },
];

const MODES = [
  { value: "NORMAL", title: "Normal", desc: "Efficient model, common rules, fastest result.", badge: null as string | null },
  { value: "STANDARD", title: "Standard", desc: "Recommended. Strong model, deep policy review.", badge: "Best value" },
  { value: "PREMIUM", title: "Premium", desc: "Top-tier frontier model. Maximum depth and findings.", badge: null },
];

const MAX_BATCH = 10;

interface PollState {
  id?: string;
  status: string;
  probability?: number;
  verdict?: string | null;
  error?: string | null;
  domain: string;
}

export function AuditWorkspace({
  costs,
  deepCost = 6,
  credits,
  history,
  initialDomain = "",
  initialNetwork = "ADSENSE",
  initialDeep = false,
  autostart = false,
}: {
  costs: { normal: number; standard: number; premium: number };
  deepCost?: number;
  credits: number;
  history: HistoryItem[];
  initialDomain?: string;
  initialNetwork?: string;
  initialDeep?: boolean;
  autostart?: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"single" | "batch">("single");
  const [domain, setDomain] = useState(initialDomain);
  const [batchInput, setBatchInput] = useState("");
  const [invalidDomains, setInvalidDomains] = useState<string[]>([]);
  const [network, setNetwork] = useState(initialNetwork);
  const [mode, setMode] = useState("STANDARD");
  const [deepScan, setDeepScan] = useState(initialDeep);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [poll, setPoll] = useState<PollState | null>(null);
  const [batch, setBatch] = useState<{ batchId: string; rows: BatchRow[] } | null>(null);
  const [scoreFilter, setScoreFilter] = useState<"all" | "ready" | "close" | "risk">("all");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const batchRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (batchRef.current) { clearInterval(batchRef.current); batchRef.current = null; }
  }, []);

  const modeCost = costs[mode.toLowerCase() as "normal" | "standard" | "premium"];
  const perAuditCost = modeCost + (deepScan ? deepCost : 0);

  const startAudit = useCallback(async (d: string, n: string, m: string, deep: boolean) => {
    setError("");
    setBusy(true);
    setBatch(null);
    setPoll({ status: "PENDING", domain: d });
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: d, network: n, mode: m, deepScan: deep }),
      });
      const data: StartResponse = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPoll(null);
        if (res.status === 402) {
          setError(`${data.error} You have ${credits} credits. Top up on the billing page.`);
        } else {
          setError(data.error || "Could not start the audit.");
        }
        return;
      }
      const id = data.id || data.audits?.[0]?.id;
      if (!id) {
        setPoll(null);
        setError("Could not start the audit. Try again.");
        return;
      }
      setPoll({ status: "PENDING", domain: d, id });
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/audit/${id}`);
          const a = await r.json();
          if (a.status === "DONE" || a.status === "FAILED") {
            stopPolling();
            setPoll({ id, status: a.status, probability: a.probability, verdict: a.verdict, error: a.error, domain: a.domain });
            if (a.status === "DONE") router.refresh();
          } else {
            setPoll((p) => (p ? { ...p, status: a.status } : p));
          }
        } catch { /* keep polling */ }
      }, 3000);
    } catch {
      setPoll(null);
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }, [credits, router, stopPolling]);
  const parsedBatchDomains = batchInput
    .split(/[\n,]/)
    .map((s) => s.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase())
    .filter(Boolean);
  const uniqueBatch = Array.from(new Set(parsedBatchDomains)).slice(0, MAX_BATCH);
  const batchCost = uniqueBatch.length * perAuditCost;

  const startBatch = useCallback(async (domains: string[], n: string, m: string, deep: boolean) => {
    setError("");
    setInvalidDomains([]);
    setBusy(true);
    setPoll(null);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains, network: n, mode: m, deepScan: deep }),
      });
      const data: StartResponse = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 402) {
          setError(`${data.error} You have ${credits} credits. Top up on the billing page.`);
        } else {
          setError(data.error || "Could not start the batch.");
          if (data.invalid) setInvalidDomains(data.invalid);
        }
        return;
      }
      if (data.invalid?.length) setInvalidDomains(data.invalid);
      const first = data.audits?.[0];
      if (!data.batchId && first) {
        // Single-domain run: reuse the single progress panel and poller.
        setPoll({ status: "PENDING", domain: first.domain, id: first.id });
        pollRef.current = setInterval(async () => {
          try {
            const r = await fetch(`/api/audit/${first.id}`);
            const a = await r.json();
            if (a.status === "DONE" || a.status === "FAILED") {
              stopPolling();
              setPoll({ id: first.id, status: a.status, probability: a.probability, verdict: a.verdict, error: a.error, domain: a.domain });
              if (a.status === "DONE") router.refresh();
            } else {
              setPoll((p) => (p ? { ...p, status: a.status } : p));
            }
          } catch { /* keep polling */ }
        }, 3000);
        return;
      }
      const initial: BatchRow[] = (data.audits || []).map((a) => ({ id: a.id, domain: a.domain, status: "PENDING", probability: 0, verdict: null, error: null }));
      const bid = data.batchId!;
      setBatch({ batchId: bid, rows: initial });
      const fetchBatch = async () => {
        try {
          const r = await fetch(`/api/audit?batch=${encodeURIComponent(bid)}`);
          if (!r.ok) return;
          const d = await r.json();
          const rows: BatchRow[] = d.audits || [];
          setBatch({ batchId: bid, rows });
          if (rows.length > 0 && rows.every((x) => x.status === "DONE" || x.status === "FAILED")) {
            if (batchRef.current) { clearInterval(batchRef.current); batchRef.current = null; }
            router.refresh();
          }
        } catch { /* keep polling */ }
      };
      await fetchBatch();
      batchRef.current = setInterval(fetchBatch, 4000);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }, [credits, router]);

  useEffect(() => {
    if (autostart && domain && !startedRef.current) {
      startedRef.current = true;
      void startAudit(domain, network, "STANDARD", false);
    }
    return stopPolling;
  }, [autostart, domain, network, startAudit, stopPolling]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (tab === "batch") {
      if (uniqueBatch.length === 0) {
        setError("Enter at least one domain, one per line.");
        return;
      }
      await startBatch(uniqueBatch, network, mode, deepScan);
      return;
    }
    const d = domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(d)) {
      setError("Enter a valid domain, for example myblog.com");
      return;
    }
    await startAudit(d, network, mode, deepScan);
  }

  const enough = tab === "batch" ? credits >= batchCost : credits >= perAuditCost;
  const displayCost = tab === "batch" ? batchCost : perAuditCost;

  return (
    <div className="space-y-8">
      {/* Form card */}
      <form onSubmit={submit} className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">New site audit</h1>
            <p className="mt-1 text-sm text-muted-foreground">Crawls your real site, then reviews it for {NETWORKS.find((n) => n.value === network)?.label} readiness.</p>
          </div>
          <div className="flex rounded-md border border-border p-0.5" role="tablist" aria-label="Audit input mode">
            {(["single", "batch"] as const).map((t) => (
              <button
                key={t} type="button" role="tab" aria-selected={tab === t}
                onClick={() => { setTab(t); setError(""); }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-bold transition-colors",
                  tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "batch" && <Layers className="h-3.5 w-3.5" />}
                {t === "single" ? "Single site" : `Batch (up to ${MAX_BATCH})`}
              </button>
            ))}
          </div>
        </div>

        <div className={cn("mt-5 grid gap-4", tab === "single" && "md:grid-cols-[1fr_180px]")}>
          {tab === "single" ? (
            <div>
              <label htmlFor="a-domain" className="mb-1.5 block text-sm font-semibold text-foreground">Your domain</label>
              <input
                id="a-domain" type="text" inputMode="url" value={domain} onChange={(e) => setDomain(e.target.value)}
                placeholder="yourblog.com" autoComplete="url"
                className="h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="a-batch" className="mb-1.5 block text-sm font-semibold text-foreground">
                Domains <span className="font-normal text-muted-foreground">(one per line, max {MAX_BATCH})</span>
              </label>
              <textarea
                id="a-batch" rows={5} value={batchInput}
                onChange={(e) => setBatchInput(e.target.value)}
                placeholder={"siteone.com\nsitetwo.com\nsitethree.com"}
                className="w-full resize-y rounded-md border border-input bg-card px-3 py-2.5 font-mono text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {parsedBatchDomains.length > MAX_BATCH && (
                <p className="mt-1.5 text-xs font-semibold text-warn">Only the first {MAX_BATCH} domains will run.</p>
              )}
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-foreground">Ad network</label>
            <Select value={network} onValueChange={setNetwork}>
              <SelectTrigger className="h-11 w-full rounded-md text-[15px]" aria-label="Target network"><SelectValue /></SelectTrigger>
              <SelectContent>
                {NETWORKS.map((n) => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Analysis mode">
          {MODES.map((m) => (
            <button
              key={m.value} type="button" role="radio" aria-checked={mode === m.value}
              onClick={() => setMode(m.value)}
              className={cn(
                "relative rounded-md border p-3.5 text-left transition-colors",
                mode === m.value ? "border-primary bg-accent" : "border-border bg-card hover:border-input"
              )}
            >
              {m.badge && <span className="absolute -top-2 right-3 rounded-sm bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{m.badge}</span>}
              <p className="flex items-center justify-between font-bold text-foreground">
                {m.title}
                {mode === m.value && <CircleCheck className="h-4 w-4 text-primary" aria-hidden="true" />}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{m.desc}</p>
              <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary">
                <Coins className="h-3.5 w-3.5" /> {costs[m.value.toLowerCase() as "normal" | "standard" | "premium"]} credits
              </p>
            </button>
          ))}
        </div>

        {/* Deep scan toggle */}
        <label
          className={cn(
            "mt-3 flex cursor-pointer items-start gap-3 rounded-md border p-3.5 transition-colors",
            deepScan ? "border-primary bg-accent" : "border-border bg-card hover:border-input"
          )}
        >
          <input
            type="checkbox"
            checked={deepScan}
            onChange={(e) => setDeepScan(e.target.checked)}
            className="sr-only"
            aria-describedby="deep-scan-desc"
          />
          <span
            aria-hidden="true"
            className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border",
              deepScan ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card"
            )}
          >
            {deepScan && (
              <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 6.5 4.7 9 10 3.4" />
              </svg>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-foreground">Deep scan</span>
              <span className="inline-flex items-center gap-1 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                <ScanSearch className="h-3 w-3" aria-hidden="true" /> +{deepCost} credits
              </span>
            </span>
            <span id="deep-scan-desc" className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              Samples 10 articles instead of 3, reads every sitemap in the index, and opens your About, Contact, Privacy and Terms pages for real to verify they exist and hold real content. Also measures publishing freshness and the share of thin posts.
            </span>
          </span>
        </label>

        {error && <p className="mt-4 rounded-md bg-risk-soft px-3 py-2.5 text-sm font-medium text-risk" role="alert">
          {error} {error.includes("credits") && <Link href="/dashboard/billing" className="underline font-bold">Buy credits</Link>}
        </p>}
        {invalidDomains.length > 0 && (
          <p className="mt-2 rounded-md bg-warn-soft px-3 py-2.5 text-sm font-medium text-warn" role="alert">
            Skipped (unreachable or invalid): {invalidDomains.join(", ")}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {tab === "batch" && uniqueBatch.length > 0 && (
              <span className="font-semibold text-foreground">{uniqueBatch.length} {uniqueBatch.length === 1 ? "site" : "sites"} × {perAuditCost} = </span>
            )}
            {deepScan && tab === "single" && (
              <span className="font-semibold text-foreground">{modeCost} + {deepCost} deep = </span>
            )}
            Balance: <span className="font-bold text-foreground">{credits.toLocaleString()}</span> credits
            {!enough && <span className="ml-1 font-semibold text-risk">(need {displayCost})</span>}
          </p>
          <Button type="submit" disabled={busy || !enough} className="h-11 rounded-md px-6 font-semibold">
            <SearchCheck className="mr-2 h-4.5 w-4.5" />
            {busy ? "Starting..." : tab === "batch" ? `Run ${uniqueBatch.length || ""} ${uniqueBatch.length === 1 ? "audit" : "audits"}` : "Run audit"}
          </Button>
        </div>
      </form>

      {/* Live batch progress */}
      {batch && (
        <div className="fade-up rounded-lg border border-border bg-card p-5 sm:p-6" aria-live="polite">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Layers className="h-5 w-5 text-primary" />
              <p className="font-bold text-foreground">Batch of {batch.rows.length}</p>
            </div>
            <BatchCounter rows={batch.rows} />
          </div>
          <ol className="mt-4 divide-y divide-border overflow-hidden rounded-md border border-border">
            {batch.rows.map((row, i) => (
              <li key={row.id} className="flex items-center gap-3 bg-card px-4 py-3">
                <span className="w-6 text-xs font-bold text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                <div className="min-w-0 flex-1">
                  {row.status === "DONE" ? (
                    <Link href={`/dashboard/audit/${row.id}`} className="truncate font-semibold text-foreground hover:text-primary">{row.domain}</Link>
                  ) : (
                    <span className="truncate font-semibold text-foreground">{row.domain}</span>
                  )}
                  {row.status === "FAILED" && row.error && <p className="mt-0.5 truncate text-xs text-risk">{row.error}</p>}
                </div>
                {row.status === "DONE" && (
                  <span className={cn(
                    "rounded-sm px-2 py-1 text-xs font-bold",
                    row.probability >= 70 ? "bg-ok-soft text-ok" : row.probability >= 45 ? "bg-warn-soft text-warn" : "bg-risk-soft text-risk"
                  )}>
                    {row.probability}%
                  </span>
                )}
                <RowStatus status={row.status} />
              </li>
            ))}
          </ol>
          {batch.rows.every((r) => r.status === "DONE" || r.status === "FAILED") && (
            <p className="mt-3 text-sm text-muted-foreground">
              Batch finished. Reports stay in your audit history, and each one can be downloaded as a PDF.
            </p>
          )}
        </div>
      )}

      {/* Live single progress */}
      {poll && (
        <div className="fade-up rounded-lg border border-border bg-card p-5 sm:p-6" aria-live="polite">
          {poll.status === "FAILED" ? (
            <div>
              <div className="flex items-center gap-2.5">
                <CircleX className="h-6 w-6 text-risk" />
                <p className="font-bold text-foreground">Audit failed for {poll.domain}</p>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{poll.error || "Unknown error"} Credits were refunded.</p>
            </div>
          ) : poll.status === "DONE" ? (
            <div>
              <div className="flex flex-col items-center gap-5 sm:flex-row">
                <ScoreRing value={poll.probability || 0} size={110} />
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Audit complete for {poll.domain}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <VerdictBadge verdict={poll.verdict || ""} />
                    <span className="text-lg font-bold text-foreground">{poll.probability}% approval probability</span>
                  </div>
                  <Link href={`/dashboard/audit/${poll.id || ""}`}>
                    <Button className="mt-3 rounded-md font-semibold">View full report</Button>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <AuditProgress status={poll.status} domain={poll.domain} />
          )}
        </div>
      )}

      {/* History */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-foreground">Audit history</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/domains"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              <LineChart className="h-3.5 w-3.5" aria-hidden="true" /> Domain trends
            </Link>
            {[
              { v: "all", label: "All" },
              { v: "ready", label: "70%+" },
              { v: "close", label: "45-69%" },
              { v: "risk", label: "Under 45%" },
            ].map((f) => (
              <button
                key={f.v} type="button"
                onClick={() => setScoreFilter(f.v as typeof scoreFilter)}
                aria-pressed={scoreFilter === f.v}
                className={cn(
                  "rounded-sm border px-2.5 py-1.5 text-xs font-bold transition-colors",
                  scoreFilter === f.v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
            {history.length > 0 && (
              <a
                href="/api/export/audits"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                download
              >
                <FileDown className="h-3.5 w-3.5" aria-hidden="true" /> Export CSV
              </a>
            )}
          </div>
        </div>
        {history.length === 0 ? (
          <EmptyState
            image="/illustrations/audit.png"
            title="No audits yet"
            body="Your first audit takes about two minutes: pick a domain, choose a mode, and the engine does the rest."
            cta="Run your first audit"
            href="/dashboard/audit"
          />
        ) : (
          <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
            <ul className="divide-y divide-border">
              {history.filter((h) =>
                scoreFilter === "all" ? true :
                scoreFilter === "ready" ? h.status === "DONE" && h.probability >= 70 :
                scoreFilter === "close" ? h.status === "DONE" && h.probability >= 45 && h.probability < 70 :
                h.status === "DONE" && h.probability < 45
              ).map((h) => (
                <li key={h.id} className="flex flex-col gap-2 p-4 transition-colors hover:bg-secondary/40 sm:flex-row sm:items-center">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-bold uppercase text-primary" aria-hidden="true">
                    {h.domain.replace(/^www\./, "").charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/domains/${encodeURIComponent(h.domain)}`}
                        className="font-semibold text-foreground hover:text-primary"
                        title={`Score trend for ${h.domain}`}
                      >
                        {h.domain}
                      </Link>
                      {h.batchId && <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary-foreground">Batch</span>}
                    </div>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      <span>{networkLabel(h.target)}</span>
                      <span>{h.mode.charAt(0) + h.mode.slice(1).toLowerCase()} mode</span>
                      {h.deepScan && <span className="inline-flex items-center gap-1 font-semibold text-primary"><ScanSearch className="h-3 w-3" aria-hidden="true" />Deep scan</span>}
                      <span>{new Date(h.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(h.status === "DONE" || h.status === "FAILED") && (
                      <button
                        type="button"
                        onClick={() => { setTab("single"); setDomain(h.domain); setNetwork(h.target); setMode(h.mode); setDeepScan(h.deepScan === true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
                        title={`Run ${h.domain} again`}
                        aria-label={`Run ${h.domain} again with the same settings`}
                      >
                        <RotateCw className="h-3.5 w-3.5" /> Re-run
                      </button>
                    )}
                    {h.status === "DONE" && (
                      <>
                        <span className={cn(
                          "rounded-sm px-2 py-1 text-xs font-bold",
                          h.probability >= 70 ? "bg-ok-soft text-ok" : h.probability >= 45 ? "bg-warn-soft text-warn" : "bg-risk-soft text-risk"
                        )}>
                          {h.probability}%
                        </span>
                        <Link
                          href={`/dashboard/audit/${h.id}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                          aria-label="Open report"
                          title="Open report"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                        <a href={`/api/audit/${h.id}/pdf`} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary" aria-label="Download PDF report" title="Download PDF report">
                          <FileDown className="h-4 w-4" />
                        </a>
                      </>
                    )}
                    {h.status === "RUNNING" || h.status === "PENDING" ? <span className="text-xs font-semibold text-warn">Analyzing...</span> : null}
                    {h.status === "FAILED" && <span className="text-xs font-semibold text-risk">Failed</span>}
                  </div>
                </li>
              ))}
            </ul>
            {history.filter((h) =>
              scoreFilter === "all" ? true :
              scoreFilter === "ready" ? h.status === "DONE" && h.probability >= 70 :
              scoreFilter === "close" ? h.status === "DONE" && h.probability >= 45 && h.probability < 70 :
              h.status === "DONE" && h.probability < 45
            ).length === 0 && (
              <p className="p-4 text-center text-sm text-muted-foreground">No audits match this filter.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function networkLabel(code: string): string {
  const map: Record<string, string> = { ADSENSE: "Google AdSense", EZOIC: "Ezoic", MEDIAVINE: "Mediavine", RAPTIVE: "Raptive" };
  return map[code] || code;
}

function BatchCounter({ rows }: { rows: BatchRow[] }) {
  const failed = rows.filter((r) => r.status === "FAILED").length;
  const finished = rows.filter((r) => r.status === "DONE" || r.status === "FAILED").length;
  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-bold text-foreground">{finished}/{rows.length}</span> done
      {failed > 0 && <span className="ml-2 font-semibold text-risk">{failed} failed</span>}
    </p>
  );
}

function RowStatus({ status }: { status: string }) {
  if (status === "DONE") return <CircleCheck className="h-5 w-5 shrink-0 text-ok" aria-label="Completed" />;
  if (status === "FAILED") return <CircleX className="h-5 w-5 shrink-0 text-risk" aria-label="Failed" />;
  return <StatusIcon status="pending" className="h-5 w-5 shrink-0" aria-label="In progress" />;
}

function AuditProgress({ status, domain }: { status: string; domain: string }) {
  const steps = [
    { key: "CRAWL", label: "Crawling your site" },
    { key: "ANALYZE", label: "AI policy review" },
    { key: "SCORE", label: "Scoring and roadmap" },
  ];
  const activeIndex = status === "PENDING" ? 0 : status === "RUNNING" ? 1 : 2;
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <StatusIcon status="pending" className="h-5 w-5" />
        <p className="font-bold text-foreground">Auditing {domain}</p>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">This usually takes 1 to 3 minutes. You can leave this page open.</p>
      <ol className="mt-4 space-y-3">
        {steps.map((st, i) => (
          <li key={st.key} className="flex items-center gap-3">
            {i < activeIndex ? (
              <CircleCheck className="h-5 w-5 text-ok" />
            ) : i === activeIndex ? (
              <StatusIcon status="pending" className="h-5 w-5" />
            ) : (
              <CircleMinus className="h-5 w-5 text-muted-foreground/40" />
            )}
            <span className={cn("text-sm", i <= activeIndex ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {st.label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
