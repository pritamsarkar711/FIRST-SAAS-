import { ScoreRing, VerdictBadge, ScoreBar, type Status } from "@/components/shared/report-ui";
import { CircleCheck, CircleMinus, CircleX, ScanSearch } from "lucide-react";
import type { AuditReport } from "@/lib/audit-runner";
import { networkName } from "@/lib/audit-runner";
import { cn } from "@/lib/utils";

const STATUS_ICONS = { ok: CircleCheck, warn: CircleMinus, risk: CircleX } as const;

export interface ReportViewProps {
  domain: string;
  target: string;
  mode: string;
  createdAt: string | Date;
  report: AuditReport;
  signals?: {
    estimatedPages?: number;
    articles?: { length: number }[];
    sitemap?: { exists: boolean; urlCount?: number };
    homepage?: { platform?: string };
    deepScan?: boolean;
    sitemapsTraversed?: number;
    navPageChecks?: { path: string; url: string; statusCode: number; wordCount: number; hasContent: boolean }[];
    categoryCheck?: { url: string; statusCode: number; wordCount: number; articleLinks: number } | null;
    contentFreshness?: { newest: string | null; oldest: string | null; datedArticles: number; within365d: number; within90d: number } | null;
    thinArticleRatio?: number | null;
  } | null;
  children?: React.ReactNode;
  footerNote?: string | null;
}

/** Full read-only audit report body shared by the dashboard and public share pages. */
export function ReportView({ domain, target, mode, createdAt, report, signals, children, footerNote }: ReportViewProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{domain}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
            {networkName(target)} · {mode.charAt(0) + mode.slice(1).toLowerCase()} mode{" "}
            {signals?.deepScan && (
              <span className="inline-flex items-center gap-1 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                <ScanSearch className="h-3 w-3" aria-hidden="true" /> Deep scan
              </span>
            )}
            {" · "}{new Date(createdAt).toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
          </p>
        </div>
        {children}
      </div>

      {/* Summary card */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_3px_rgba(27,38,32,0.05)] dark:bg-card sm:p-6 print:border-0 print:shadow-none">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <ScoreRing value={report.probability} size={128} label="Approval" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <VerdictBadge verdict={report.verdict} />
              <span className="text-lg font-bold text-foreground">{report.probability}% approval probability</span>
            </div>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{report.summary}</p>
            {signals ? (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["Pages found", signals.estimatedPages ?? 0],
                  ["Articles sampled", Array.isArray(signals.articles) ? signals.articles.length : 0],
                  ["Sitemap", signals.sitemap?.exists ? `${signals.sitemap.urlCount ?? 0} URLs` : "Missing"],
                  ["Platform", signals.homepage?.platform || "Unknown"],
                ].map(([k, v]) => (
                  <div key={String(k)} className="rounded-md border border-border bg-secondary/50 px-3 py-2 print:break-inside-avoid">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{k}</p>
                    <p className="mt-0.5 text-sm font-bold text-foreground">{String(v)}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Deep scan evidence */}
      {signals?.deepScan && (
        <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <ScanSearch className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="font-bold text-foreground">Deep scan evidence</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Verified by opening these pages directly, not by guessing from link text.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Policy pages opened</p>
              {signals.navPageChecks?.length ? (
                <ul className="mt-2 divide-y divide-border overflow-hidden rounded-md border border-border">
                  {signals.navPageChecks.map((p) => (
                    <li key={p.path} className="flex items-center gap-2.5 bg-card px-3 py-2.5">
                      {p.hasContent ? <CircleCheck className="h-4 w-4 shrink-0 text-ok" aria-label="found with real content" /> : p.statusCode === 200 ? <CircleMinus className="h-4 w-4 shrink-0 text-warn" aria-label="reachable but thin" /> : <CircleX className="h-4 w-4 shrink-0 text-risk" aria-label="not reachable" />}
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold capitalize text-foreground">{p.path} page</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{p.statusCode === 200 ? `${p.wordCount.toLocaleString()} words` : `HTTP ${p.statusCode}`}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 rounded-md bg-warn-soft px-3 py-2.5 text-sm text-warn">None of the About, Contact, Privacy or Terms pages could be found in the site navigation.</p>
              )}
              <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">Content freshness</p>
              {signals.contentFreshness ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {[
                    ["Newest post", signals.contentFreshness.newest || "Not dated"],
                    ["Oldest sampled", signals.contentFreshness.oldest || "Not dated"],
                    ["Updated in 90 days", `${signals.contentFreshness.within90d}/${signals.contentFreshness.datedArticles}`],
                    ["Updated in a year", `${signals.contentFreshness.within365d}/${signals.contentFreshness.datedArticles}`],
                  ].map(([k, v]) => (
                    <div key={String(k)} className="rounded-md border border-border bg-secondary/50 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{k}</p>
                      <p className="mt-0.5 text-sm font-bold text-foreground">{String(v)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 rounded-md bg-warn-soft px-3 py-2.5 text-sm text-warn">No publish dates were found in the sampled articles.</p>
              )}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Category page probe</p>
              {signals.categoryCheck ? (
                <div className="mt-2 rounded-md border border-border px-3 py-2.5">
                  <p className="truncate text-xs text-muted-foreground" title={signals.categoryCheck.url}>{signals.categoryCheck.url}</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <span className="font-semibold text-foreground">HTTP {signals.categoryCheck.statusCode}</span>
                    <span className="text-muted-foreground">{signals.categoryCheck.wordCount.toLocaleString()} words on page</span>
                    <span className="text-muted-foreground">{signals.categoryCheck.articleLinks} links found</span>
                  </div>
                </div>
              ) : (
                <p className="mt-2 rounded-md bg-secondary/60 px-3 py-2.5 text-sm text-muted-foreground">No category or topic link was found on the homepage to probe.</p>
              )}
              <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">Thin content</p>
              {typeof signals.thinArticleRatio === "number" ? (
                <div className="mt-2 rounded-md border border-border px-3 py-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Sampled articles under 600 words</span>
                    <span className={cn("font-bold", signals.thinArticleRatio >= 0.34 ? "text-risk" : signals.thinArticleRatio > 0 ? "text-warn" : "text-ok")}>
                      {Math.round(signals.thinArticleRatio * 100)}%
                    </span>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Not enough dated samples to measure.</p>
              )}
              {typeof signals.sitemapsTraversed === "number" && (
                <p className="mt-4 text-xs text-muted-foreground">Sitemap files read end to end: {signals.sitemapsTraversed}.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sections */}
      <div className="grid gap-4 lg:grid-cols-2 print:block">
        {report.sections.map((sec) => (
          <div key={sec.key} className="rounded-lg border border-border bg-card p-5 dark:bg-card print:mb-4 print:break-inside-avoid">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-foreground">{sec.title}</h2>
              <span className={cn("rounded-sm px-2 py-0.5 text-xs font-bold",
                sec.status === "ok" ? "bg-ok-soft text-ok" : sec.status === "warn" ? "bg-warn-soft text-warn" : "bg-risk-soft text-risk")}>
                {sec.score}/100
              </span>
            </div>
            <ScoreBar value={sec.score} className="mt-2.5" />
            <ul className="mt-4 space-y-3">
              {sec.items.map((item, i) => {
                const Icon = STATUS_ICONS[item.status as Status] || CircleMinus;
                return (
                  <li key={i} className="flex items-start gap-2.5 print:break-inside-avoid">
                    <Icon className={cn("mt-0.5 h-4.5 w-4.5 shrink-0",
                      item.status === "ok" ? "text-ok" : item.status === "warn" ? "text-warn" : "text-risk")} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{item.label}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Strengths / risks / fixes */}
      <div className="grid gap-4 md:grid-cols-3 print:block">
        {[
          { title: "Strengths", items: report.strengths, cls: "text-ok", bg: "bg-ok-soft" },
          { title: "Risks", items: report.risks, cls: "text-warn", bg: "bg-warn-soft" },
          { title: "Critical fixes", items: report.criticalFixes, cls: "text-risk", bg: "bg-risk-soft" },
        ].map((col) => (
          <div key={col.title} className="rounded-lg border border-border bg-card p-5 dark:bg-card print:mb-4 print:break-inside-avoid">
            <h2 className={cn("font-bold", col.cls)}>{col.title}</h2>
            <ul className="mt-3 space-y-2.5">
              {(col.items || []).map((t, i) => (
                <li key={i} className={cn("flex items-start gap-2 rounded-md px-3 py-2 text-sm leading-snug", col.bg)}>
                  <span className="font-bold">{i + 1}.</span> {t}
                </li>
              ))}
              {(!col.items || col.items.length === 0) && <li className="text-sm text-muted-foreground">Nothing reported.</li>}
            </ul>
          </div>
        ))}
      </div>

      {/* Roadmap */}
      <div className="rounded-lg border border-border bg-card p-5 dark:bg-card sm:p-6 print:break-inside-avoid">
        <h2 className="text-lg font-bold text-foreground">Fix-first roadmap</h2>
        <ol className="mt-4 space-y-4">
          {report.roadmap.map((r) => (
            <li key={r.step} className="flex gap-3.5 print:break-inside-avoid">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{r.step}</span>
              <div>
                <p className="font-semibold text-foreground">{r.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{r.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {footerNote || `Independent assessment. Not affiliated with or endorsed by ${networkName(target)}.`}
      </p>
    </div>
  );
}
