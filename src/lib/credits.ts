import { db } from "@/lib/db";
import { getSetting, COSTS_DEFAULTS, type CreditCosts } from "@/lib/settings";

export async function getCosts(): Promise<CreditCosts> {
  return getSetting<CreditCosts>("costs", COSTS_DEFAULTS);
}

/** Atomically deduct credits. Returns false when the balance is insufficient. */
export async function deductCredits(userId: string, amount: number): Promise<boolean> {
  if (amount <= 0) return true;
  const res = await db.user.updateMany({
    where: { id: userId, credits: { gte: amount } },
    data: { credits: { decrement: amount } },
  });
  return res.count > 0;
}

export async function addCredits(userId: string, amount: number): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { credits: { increment: amount } } });
}

// ---------- simple in-memory rate limiter ----------
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (b.count >= limit) return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  b.count++;
  return { ok: true };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : null) || req.headers.get("x-real-ip") || "unknown";
}
