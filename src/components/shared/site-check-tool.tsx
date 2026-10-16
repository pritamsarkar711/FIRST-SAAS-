"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleCheck, TriangleAlert, CircleX, Globe, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Check { id: string; label: string; status: "ok" | "warn" | "risk"; detail: string }
interface SiteCheckResult { domain: string; checks: Check[]; passed: number; total: number }

const STATUS_ICON = {
  ok: CircleCheck,
  warn: TriangleAlert,
  risk: CircleX,
} as const;

const STATUS_STYLE = {
  ok: { chip: "bg-ok-soft text-ok", icon: "text-ok" },
  warn: { chip: "bg-warn-soft text-warn", icon: "text-warn" },
  risk: { chip: "bg-risk-soft text-risk", icon: "text-risk" },
} as const;

export function SiteCheckTool() {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SiteCheckResult | null>(null);

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    if (loading) return;
    const value = domain.trim();
    if (!value) {
      setError("Type a domain first, e.g. yourblog.com");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/tools/site-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "The check could not run. Try again in a moment.");
      } else {
        setResult(data as SiteCheckResult);
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border bg-secondary/50 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <Globe className="h-5 w-5 text-primary" aria-hidden="true" /> Instant site check
          </h2>
          <span className="rounded-sm bg-accent px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">Free, no signup</span>
        </div>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Seven checks reviewers and crawlers run on any site, done in seconds: HTTPS, meta tags, mobile viewport, AdSense tag, ads.txt, robots and sitemap, and your About, Contact and Privacy pages opened for real.
        </p>
      </div>

      <div className="px-5 py-5 sm:px-6">
        <form onSubmit={run} className="flex flex-col gap-2 sm:flex-row" aria-label="Run a free site check">
          <label htmlFor="sitecheck-domain" className="sr-only">Domain to check</label>
          <input
            id="sitecheck-domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="yourblog.com"
            autoComplete="url"
            inputMode="url"
            className="h-11 flex-1 rounded-md border border-input bg-background px-3.5 text-[15px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-primary"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Globe className="h-4 w-4" aria-hidden="true" />}
            {loading ? "Checking..." : "Check site"}
          </button>
        </form>
        {error && (
          <p role="alert" className="mt-2.5 rounded-md border border-risk/30 bg-risk-soft px-3 py-2 text-sm font-medium text-risk">
            {error}
          </p>
        )}

        {loading && (
          <ul className="mt-5 space-y-2.5" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="h-14 animate-pulse rounded-md bg-muted" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </ul>
        )}

        {result && !loading && (
          <div className="mt-5" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-secondary/40 px-4 py-3">
              <p className="text-sm text-foreground">
                <span className="font-bold">{result.domain}</span> ·{" "}
                <span className={cn("font-bold", result.passed >= 5 ? "text-ok" : result.passed >= 3 ? "text-warn" : "text-risk")}>
                  {result.passed} of {result.total} checks passed
                </span>
              </p>
              <Link
                href={`/register?domain=${encodeURIComponent(result.domain)}&network=ADSENSE`}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
              >
                Run the full audit on {result.domain} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
            <ul className="mt-3 space-y-2.5">
              {result.checks.map((c) => {
                const Icon = STATUS_ICON[c.status];
                return (
                  <li key={c.id} className="rounded-md border border-border p-4">
                    <div className="flex items-start gap-3">
                      <span className={cn("mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md", STATUS_STYLE[c.status].chip)}>
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground">{c.label}</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{c.detail}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              This free check looks at seven surface signals, including opening your About, Contact and Privacy pages for real. The full audit crawls your sitemap, samples articles and reviews 40+ policy points against the network you are targeting.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
