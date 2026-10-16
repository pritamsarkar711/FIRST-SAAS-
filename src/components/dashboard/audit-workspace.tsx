"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleCheck, CircleMinus, CircleX, SearchCheck, FileDown, Trash2, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScoreRing, VerdictBadge, StatusIcon } from "@/components/shared/report-ui";
import { cn } from "@/lib/utils";

interface StartResponse { ok?: boolean; id?: string; error?: string; needCredits?: number }

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
  credits,
  history,
}: {
  costs: { normal: number; standard: number; premium: number };
  credits: number;
  history: { id: string; domain: string; target: string; mode: string; status: string; probability: number; verdict: string | null; createdAt: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [domain, setDomain] = useState(params.get("domain") || "");
  const [network, setNetwork] = useState(params.get("network") || "ADSENSE");
  const [mode, setMode] = useState("STANDARD");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [poll, setPoll] = useState<PollState | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autostart = params.get("autostart") === "1";
  const startedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const startAudit = useCallback(async (d: string, n: string, m: string) => {
    setError("");
    setBusy(true);
    setPoll({ status: "PENDING", domain: d });
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: d, network: n, mode: m }),
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
      const id = data.id!;
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

  useEffect(() => {
    if (autostart && domain && !startedRef.current) {
      startedRef.current = true;
      void startAudit(domain, network, "STANDARD");
    }
    return stopPolling;
  }, [autostart, domain, network, startAudit, stopPolling]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const d = domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(d)) {
      setError("Enter a valid domain, for example myblog.com");
      return;
    }
    await startAudit(d, network, mode);
  }

  const cost = costs[mode.toLowerCase() as "normal" | "standard" | "premium"];
  const enough = credits >= cost;

  return (
    <div className="space-y-8">
      {/* Form card */}
      <form onSubmit={submit} className="rounded-lg border border-border bg-white p-5 sm:p-6">
        <h1 className="text-lg font-bold text-foreground">New site audit</h1>
        <p className="mt-1 text-sm text-muted-foreground">Crawls your real site, then reviews it for {NETWORKS.find((n) => n.value === network)?.label} readiness.</p>

        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_180px]">
          <div>
            <label htmlFor="a-domain" className="mb-1.5 block text-sm font-semibold text-foreground">Your domain</label>
            <input
              id="a-domain" type="text" inputMode="url" value={domain} onChange={(e) => setDomain(e.target.value)}
              placeholder="yourblog.com" autoComplete="url"
              className="h-11 w-full rounded-md border border-input bg-white px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
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
                mode === m.value ? "border-primary bg-accent" : "border-border bg-white hover:border-input"
              )}
            >
              {m.badge && <span className="absolute -top-2 right-3 rounded-sm bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{m.badge}</span>}
              <p className="font-bold text-foreground">{m.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{m.desc}</p>
              <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary">
                <Coins className="h-3.5 w-3.5" /> {costs[m.value.toLowerCase() as "normal" | "standard" | "premium"]} credits
              </p>
            </button>
          ))}
        </div>

        {error && <p className="mt-4 rounded-md bg-risk-soft px-3 py-2.5 text-sm font-medium text-risk" role="alert">
          {error} {error.includes("credits") && <Link href="/dashboard/billing" className="underline font-bold">Buy credits</Link>}
        </p>}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Balance: <span className="font-bold text-foreground">{credits.toLocaleString()}</span> credits
            {!enough && <span className="ml-1 font-semibold text-risk">(need {cost})</span>}
          </p>
          <Button type="submit" disabled={busy || !enough} className="h-11 rounded-md px-6 font-semibold">
            <SearchCheck className="mr-2 h-4.5 w-4.5" /> {busy ? "Starting..." : "Run audit"}
          </Button>
        </div>
      </form>

      {/* Live progress */}
      {poll && (
        <div className="fade-up rounded-lg border border-border bg-white p-5 sm:p-6">
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
        <h2 className="text-lg font-bold text-foreground">Audit history</h2>
        {history.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-border bg-secondary/40 p-8 text-center">
            <SearchCheck className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">No audits yet. Run your first one above.</p>
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-lg border border-border bg-white">
            <ul className="divide-y divide-border">
              {history.map((h) => (
                <li key={h.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <Link href={`/dashboard/audit/${h.id}`} className="font-semibold text-foreground hover:text-primary">
                      {h.domain}
                    </Link>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      <span>{networkLabel(h.target)}</span>
                      <span>{h.mode.charAt(0) + h.mode.slice(1).toLowerCase()} mode</span>
                      <span>{new Date(h.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {h.status === "DONE" && (
                      <>
                        <span className={cn(
                          "rounded-sm px-2 py-1 text-xs font-bold",
                          h.probability >= 70 ? "bg-ok-soft text-ok" : h.probability >= 45 ? "bg-warn-soft text-warn" : "bg-risk-soft text-risk"
                        )}>
                          {h.probability}%
                        </span>
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
