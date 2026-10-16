import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { VerdictBadge } from "@/components/shared/report-ui";
import type { AuditReportSection } from "@/lib/audit-runner";
import { cn } from "@/lib/utils";

interface Snapshot {
  probability: number;
  verdict: string;
  sections: AuditReportSection[];
  createdAt: string;
}

function Delta({ value, suffix = "" }: { value: number; suffix?: string }) {
  if (value > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm bg-ok-soft px-2 py-0.5 text-xs font-bold text-ok">
        <TrendingUp className="h-3.5 w-3.5" /> +{value}{suffix}
      </span>
    );
  }
  if (value < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm bg-risk-soft px-2 py-0.5 text-xs font-bold text-risk">
        <TrendingDown className="h-3.5 w-3.5" /> {value}{suffix}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
      <Minus className="h-3.5 w-3.5" /> unchanged
    </span>
  );
}

/** Progress comparison between the current audit and the previous audit of the same domain + network. */
export function ComparisonPanel({ current, previous }: { current: Snapshot; previous: Snapshot }) {
  const delta = current.probability - previous.probability;
  const prevMap = new Map(previous.sections.map((s) => [s.key, s]));

  return (
    <div className="rounded-lg border border-primary/30 bg-accent/40 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Progress since last check</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Compared with your audit from{" "}
            {new Date(previous.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-2xl font-bold leading-none text-foreground">
              {current.probability}%
              <span className="ml-2 align-middle"><Delta value={delta} /></span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">approval probability</p>
          </div>
        </div>
      </div>

      {previous.verdict !== current.verdict && (
        <div className="mt-4 flex flex-wrap items-center gap-2.5 rounded-md border border-border bg-card px-4 py-3">
          <VerdictBadge verdict={previous.verdict} />
          <span className="text-muted-foreground">→</span>
          <VerdictBadge verdict={current.verdict} />
          <span className="ml-auto text-xs font-semibold text-muted-foreground">verdict changed</span>
        </div>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {current.sections.map((sec) => {
          const prev = prevMap.get(sec.key);
          const secDelta = prev ? sec.score - prev.score : null;
          return (
            <div key={sec.key} className="flex items-center justify-between rounded-md border border-border bg-card px-3.5 py-2.5">
              <span className="min-w-0 truncate text-sm font-semibold text-foreground">{sec.title}</span>
              <span className="ml-2 flex shrink-0 items-center gap-2">
                <span className="text-sm font-bold text-foreground">{sec.score}/100</span>
                {secDelta !== null && <Delta value={secDelta} />}
              </span>
            </div>
          );
        })}
      </div>

      <p className={cn("mt-4 text-sm leading-relaxed",
        delta > 0 ? "text-ok" : delta < 0 ? "text-risk" : "text-muted-foreground")}>
        {delta > 0
          ? "Your score moved in the right direction. Keep working through the roadmap and re-check after each round of fixes."
          : delta < 0
            ? "Your score dropped since the last audit. Review the new red and orange findings before applying."
            : "No overall change yet. Work through the roadmap below, then run a fresh audit to measure progress."}
      </p>
    </div>
  );
}
