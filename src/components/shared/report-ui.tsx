import { cn } from "@/lib/utils";
import { CircleCheck, CircleMinus, CircleX, Loader2 } from "lucide-react";

export type Status = "ok" | "warn" | "risk";

export function StatusIcon({ status, className }: { status: Status | "pending"; className?: string }) {
  if (status === "ok") return <CircleCheck className={cn("h-5 w-5 text-ok", className)} aria-label="Okay" />;
  if (status === "warn") return <CircleMinus className={cn("h-5 w-5 text-warn", className)} aria-label="Needs improvement" />;
  if (status === "pending") return <Loader2 className={cn("h-5 w-5 animate-spin text-muted-foreground", className)} aria-label="Checking" />;
  return <CircleX className={cn("h-5 w-5 text-risk", className)} aria-label="Needs fixing" />;
}

export function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    ok: { label: "Okay", cls: "bg-ok-soft text-ok" },
    warn: { label: "Improve", cls: "bg-warn-soft text-warn" },
    risk: { label: "Fix", cls: "bg-risk-soft text-risk" },
  };
  return (
    <span className={cn("inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-bold", map[status].cls)}>
      {map[status].label}
    </span>
  );
}

export function ScoreRing({ value, size = 120, stroke = 10, label }: { value: number; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 70 ? "var(--ok)" : pct >= 45 ? "var(--warn)" : "var(--risk)";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`${label || "Score"}: ${pct} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold leading-none" style={{ fontSize: size * 0.28, color }}>{pct}</span>
        {label !== undefined && <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}

export function VerdictBadge({ verdict }: { verdict: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    APPLY_NOW: { label: "Apply now", cls: "bg-ok-soft text-ok" },
    WAIT_AND_IMPROVE: { label: "Wait and improve", cls: "bg-warn-soft text-warn" },
    HIGH_RISK_OF_REJECTION: { label: "High risk of rejection", cls: "bg-risk-soft text-risk" },
  };
  const v = map[verdict] || { label: verdict, cls: "bg-muted text-muted-foreground" };
  return <span className={cn("inline-flex items-center rounded-sm px-2.5 py-1 text-xs font-bold uppercase tracking-wide", v.cls)}>{v.label}</span>;
}

export function ScoreBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 70 ? "bg-ok" : pct >= 45 ? "bg-warn" : "bg-risk";
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}
