/**
 * Third-party brand logos. Uses real logo files shipped in /public/logos,
 * and falls back to a clean neutral badge if a file is missing.
 */
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function BrandLogo({
  name,
  src,
  size = 20,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-sm border bg-muted font-semibold text-muted-foreground",
          className
        )}
        style={{ width: size * 1.6, height: size * 1.15, fontSize: Math.max(9, size * 0.5) }}
        title={name}
      >
        {name.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  // v=2: brand assets were replaced with real logo files; bust any cached copies.
  const bust = src.includes("?") ? src : `${src}?v=3`;
  return (

    <img
      src={bust}
      alt={`${name} logo`}
      width={size * 2.2}
      height={size * 1.15}
      className={cn("rounded-sm bg-white object-contain p-0.5 dark:bg-white/90", className)}
      style={{ height: size * 1.15, width: "auto" }}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}
