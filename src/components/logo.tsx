import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn("h-8 w-8", className)} aria-hidden="true">
      <rect x="1.5" y="1.5" width="29" height="29" rx="7" className="fill-primary" />
      <path d="M9 16.5l4.2 4.2L23 11" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 23.5h8" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className, mark = true, name = "AdAudit" }: { className?: string; mark?: boolean; name?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {mark && <LogoMark />}
      <span className="text-[1.15rem] font-bold tracking-tight text-foreground">{name}</span>
    </span>
  );
}
