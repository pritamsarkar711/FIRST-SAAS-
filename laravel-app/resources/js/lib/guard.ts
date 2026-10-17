/**
 * Client-safe subset of the original src/lib/guard.ts (the SSRF checks live
 * in the Laravel backend now). Only the pure domain normalizer is needed by
 * dashboard components.
 */

/** Lowercases, strips scheme/www and any path/query/hash. */
export function normalizeDomain(input: string): string {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split("?")[0].split("#")[0];
  return d;
}
