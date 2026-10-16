import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn("h-8 w-8", className)} aria-hidden="true">
      <rect x="1.5" y="1.5" width="29" height="29" rx="8" className="fill-primary" />
      {/* audit bars, rising */}
      <rect x="8" y="17" width="3.6" height="7" rx="1.8" fill="#fff" />
      <rect x="14.2" y="13" width="3.6" height="11" rx="1.8" fill="#fff" fillOpacity="0.85" />
      <rect x="20.4" y="8" width="3.6" height="16" rx="1.8" fill="#fff" />
    </svg>
  );
}

export function Logo({ className, mark = true, name = "Audit Form" }: { className?: string; mark?: boolean; name?: string }) {
  const [first, ...rest] = name.split(" ");
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {mark && <LogoMark />}
      <span className="text-[1.2rem] font-extrabold tracking-tight text-foreground">
        {first}{" "}
        <span className="text-primary">{rest.join(" ")}</span>
      </span>
    </span>
  );
}
