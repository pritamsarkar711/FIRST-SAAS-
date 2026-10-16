import { db } from "@/lib/db";
import { getCosts, deductCredits } from "@/lib/credits";
import { normalizeDomain, assertPublicUrl } from "@/lib/guard";
import { runAudit } from "@/lib/audit-runner";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activity";

export const WATCH_LIMIT = 10;
export const INTERVALS = [7, 14, 30] as const;

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export interface StartRunResult {
  ok: boolean;
  reason?: "NOT_FOUND" | "INVALID" | "NOT_ENOUGH_CREDITS" | "ALREADY_RUNNING";
  auditId?: string;
  need?: number;
}

/**
 * Starts one monitored audit for a watch item: validates, deducts credits,
 * creates the Audit row linked to the item and fires the background runner.
 * Does not throw into callers.
 */
export async function startWatchRun(item: { id: string; userId: string; domain: string; target: string; mode: string; runs: number; intervalDays: number }): Promise<StartRunResult> {
  try {
    const costs = await getCosts();
    const creditsUsed = costs.audit[item.mode.toLowerCase() as "normal" | "standard" | "premium"] ?? 12;

    const ok = await deductCredits(item.userId, creditsUsed);
    if (!ok) return { ok: false, reason: "NOT_ENOUGH_CREDITS", need: creditsUsed };

    const audit = await db.audit.create({
      data: {
        userId: item.userId,
        domain: item.domain,
        target: item.target,
        mode: item.mode,
        status: "PENDING",
        creditsUsed,
        watchItemId: item.id,
      },
    });

    const now = new Date();
    await db.watchItem.update({
      where: { id: item.id },
      data: {
        lastRunAt: now,
        nextRunAt: new Date(now.getTime() + item.intervalDays * 24 * 60 * 60_000),
        runs: { increment: 1 },
        pausedReason: null,
      },
    });

    void runAudit(audit.id).catch(() => {});
    logActivity({
      action: "WATCH_RUN",
      userId: item.userId,
      actorEmail: "system",
      detail: `${item.domain} · ${item.target} · ${item.mode.toLowerCase()} · scheduled check #${item.runs + 1}`,
    });
    return { ok: true, auditId: audit.id };
  } catch {
    return { ok: false, reason: "INVALID" };
  }
}

/**
 * Lazy scheduler. When userId is provided only that user's due items run
 * (used when a signed-in dashboard loads). When `key` matches the stored
 * automation key it processes every due item (for external cron on Hostinger).
 * Returns a small summary so callers can surface what happened.
 */
export async function tickWatchlist(opts: { userId?: string; key?: string; actorEmail?: string }): Promise<{ ran: number; skipped: number; checked: number }> {
  const now = new Date();
  const where = {
    active: true,
    nextRunAt: { lte: now },
    ...(opts.userId ? { userId: opts.userId } : {}),
  };

  const due = await db.watchItem.findMany({
    where,
    orderBy: { nextRunAt: "asc" },
    take: opts.userId ? 5 : 15,
  });

  let ran = 0;
  let skipped = 0;

  for (const item of due) {
    const user = await db.user.findUnique({ where: { id: item.userId } });
    if (!user || user.status !== "ACTIVE") {
      skipped++;
      continue;
    }

    const result = await startWatchRun(item);
    if (result.ok) {
      ran++;
    } else if (result.reason === "NOT_ENOUGH_CREDITS") {
      skipped++;
      const alreadyPaused = await db.watchItem.findUnique({ where: { id: item.id }, select: { active: true } });
      if (alreadyPaused?.active) {
        await db.watchItem.update({
          where: { id: item.id },
          data: { active: false, pausedReason: "Paused automatically: not enough credits for the scheduled check." },
        });
        notify(
          item.userId,
          "SYSTEM",
          `Monitoring paused: ${item.domain}`,
          `The scheduled check needs ${result.need} credits but your balance is too low. Top up and re-enable monitoring whenever you are ready.`,
          "/dashboard/watchlist"
        ).catch(() => {});
      }
    } else {
      skipped++;
    }
  }

  return { ran, skipped, checked: due.length };
}

/** Validates + adds a domain to the user's watchlist. Returns an error string or the created item. */
export async function addWatchItem(
  userId: string,
  input: { domain: string; target: string; mode: string; intervalDays: number }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const domain = normalizeDomain(input.domain);
  if (!DOMAIN_RE.test(domain)) return { ok: false, error: "Enter a valid domain like example.com." };

  const count = await db.watchItem.count({ where: { userId } });
  if (count >= WATCH_LIMIT) return { ok: false, error: `Monitoring is limited to ${WATCH_LIMIT} domains. Remove one to add another.` };

  const dupe = await db.watchItem.findFirst({ where: { userId, domain, target: input.target } });
  if (dupe) return { ok: false, error: `${domain} is already being monitored for ${input.target}.` };

  try {
    await assertPublicUrl(domain);
  } catch {
    return { ok: false, error: "That domain cannot be reached for monitoring." };
  }

  const item = await db.watchItem.create({
    data: {
      userId,
      domain,
      target: input.target,
      mode: input.mode,
      intervalDays: input.intervalDays,
      active: true,
      nextRunAt: new Date(Date.now() + input.intervalDays * 24 * 60 * 60_000),
    },
  });

  logActivity({
    action: "WATCH_ADD",
    userId,
    actorEmail: "self",
    detail: `${domain} · every ${input.intervalDays} days · ${input.mode.toLowerCase()}`,
  });

  return { ok: true, id: item.id };
}
