import { useSyncExternalStore } from "react";
import { Link } from "@inertiajs/react";
import { CircleCheck, Circle, SearchCheck, Radar, PenLine, ShieldCheck, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OnboardingStep {
  id: string;
  label: string;
  desc: string;
  href: string;
  done: boolean;
  cta: string;
}

const ICONS: Record<string, typeof SearchCheck> = {
  audit: SearchCheck,
  monitor: Radar,
  article: PenLine,
  twofa: ShieldCheck,
};

const STORAGE_KEY = "adaudit-onboarding-dismissed";

// Tiny localStorage-backed store: hydration-safe (server snapshot = false) and
// notifies subscribers the moment the checklist is dismissed.
let listeners: (() => void)[] = [];
function subscribe(cb: () => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}
function notify() {
  for (const l of [...listeners]) l();
}
function getSnapshot(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
function getServerSnapshot(): boolean {
  return false;
}

export function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const doneCount = steps.filter((s) => s.done).length;

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // private mode: dismissal lasts for this visit only
    }
    notify();
  }

  if (dismissed) return null;

  return (
    <section className="rounded-lg border border-border bg-card p-5" aria-label="Getting started checklist">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-bold text-foreground">Getting started</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {doneCount === steps.length
              ? "Everything is set up. Your account is in great shape."
              : `${steps.length - doneCount} step${steps.length - doneCount === 1 ? "" : "s"} to get the most out of Audit Form.`}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Dismiss the getting started checklist"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3" role="presentation">
        <div className="h-2 flex-1 overflow-hidden rounded-sm bg-secondary">
          <div
            className="h-full rounded-sm bg-primary transition-all"
            style={{ width: `${Math.round((doneCount / steps.length) * 100)}%` }}
          />
        </div>
        <span className="text-xs font-bold text-muted-foreground">{doneCount}/{steps.length}</span>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {steps.map((s) => {
          const Icon = ICONS[s.id] ?? CircleCheck;
          return (
            <li key={s.id}>
              <Link
                href={s.href}
                className={cn(
                  "flex h-full items-start gap-3 rounded-md border p-3.5 transition-colors",
                  s.done
                    ? "border-border bg-secondary/40"
                    : "border-border hover:border-primary/40 hover:bg-accent/40",
                )}
              >
                {s.done ? (
                  <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-ok" aria-hidden="true" />
                ) : (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm font-semibold", s.done ? "text-muted-foreground line-through decoration-border" : "text-foreground")}>
                    {s.label}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    {!s.done && <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
                    {s.done ? s.desc : s.cta}
                    {!s.done && <ArrowRight className="h-3 w-3" aria-hidden="true" />}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
