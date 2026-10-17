import { ScoreRing, StatusIcon } from "@/components/shared/report-ui";

/** Presentational browser-frame preview of an audit report. Used on the homepage. */
export function ReportMockup() {
  const rows: { status: "ok" | "warn" | "risk"; label: string }[] = [
    { status: "ok", label: "Privacy Policy and Contact page found" },
    { status: "ok", label: "Sitemap submitted and crawlable" },
    { status: "warn", label: "8 posts in sitemap, 25 recommended" },
    { status: "warn", label: "No author bylines detected" },
    { status: "risk", label: "2 sampled articles under 600 words" },
    { status: "risk", label: "Category pages are empty" },
  ];
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-[0_1px_3px_rgba(27,38,32,0.08),0_12px_32px_rgba(27,38,32,0.10)]" aria-hidden="true">
      <div className="flex items-center gap-1.5 border-b border-border bg-muted px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#d5dcd8]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#d5dcd8]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#d5dcd8]" />
        <span className="ml-3 hidden rounded-sm bg-background px-2.5 py-0.5 text-[11px] text-muted-foreground sm:block">
          mygreengarden.com / audit report
        </span>
      </div>
      <div className="grid gap-4 p-4 sm:p-5 sm:grid-cols-[auto_1fr] sm:gap-6">
        <div className="flex flex-row items-center gap-4 sm:flex-col sm:items-start">
          <ScoreRing value={62} size={96} label="Approval" />
          <div className="flex flex-wrap gap-1.5 sm:mt-1">
            <span className="rounded-sm bg-warn-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-warn">Wait and improve</span>
          </div>
        </div>
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Findings</p>
          <ul className="space-y-2.5">
            {rows.map((r, i) => (
              <li key={i} className="flex items-center gap-2.5 rounded-md border border-border bg-secondary/50 px-3 py-2">
                <StatusIcon status={r.status} className="h-4 w-4 shrink-0" />
                <span className="text-[13px] leading-snug text-foreground">{r.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
