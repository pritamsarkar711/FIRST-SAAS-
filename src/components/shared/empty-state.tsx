import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Branded empty state with the flat-vector illustration set. */
export function EmptyState({
  image,
  title,
  body,
  cta,
  href,
  size = "md",
  className,
}: {
  image: string;
  title: string;
  body: string;
  cta?: string;
  href?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-lg border border-dashed border-border bg-secondary/40 px-6 text-center print:hidden", size === "md" ? "py-10" : "py-7", className)}>
      <div className={cn("relative overflow-hidden rounded-md border border-border bg-card", size === "md" ? "h-28 w-44" : "h-20 w-32")}>
        <Image src={image} alt="" fill sizes="200px" className="object-cover" />
      </div>
      <p className={cn("mt-4 font-bold text-foreground", size === "md" ? "text-[15px]" : "text-sm")}>{title}</p>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{body}</p>
      {cta && href && (
        <Link
          href={href}
          className="mt-4 inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {cta}
        </Link>
      )}
    </div>
  );
}
