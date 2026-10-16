import { db } from "@/lib/db";
import { getCosts, deductCredits } from "@/lib/credits";
import { normalizeDomain, assertPublicUrl } from "@/lib/guard";
import { runAudit } from "@/lib/audit-runner";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activity";
import { getSetting } from "@/lib/settings";

/** Fallback limit for accounts without an active plan (admin-tunable via Setting). */
export const WATCH_LIMIT_DEFAULT = 1;
export const INTERVALS = [7, 14, 30] as const;

/**
 * How many domains this account may monitor at once: the active plan's
 * monitorLimit when there is one, otherwise the platform free-tier default.
 */
export async function getMonitorLimit(userId: string): Promise<{ limit: number; planName: string | null }> {
  const sub = await db.subscription.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
  }).catch(() => null);
  // planId relation is not declared on Subscription; look the plan up by id instead
  if (sub) {
    const plan = sub.planId ? await db.plan.findUnique({ where: { id: sub.planId } }).catch(() => null) : null;
    const limit = plan?.monitorLimit ?? null;
    if (limit !== null) return { limit, planName: sub.planName };
  }
  const free = await getSetting<number>("monitorLimitFree", WATCH_LIMIT_DEFAULT);
  return { limit: typeof free === "number" && free >= 0 ? free : WATCH_LIMIT_DEFAULT, planName: null };
}

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
export async function startWatchRun(item: { id: string; userId: string; domain: string; target: string; mode: string; deepScan?: boolean; runs: number; intervalDays: number }): Promise<StartRunResult> {
  try {
    const costs = await getCosts();
    const creditsUsed =
      (costs.audit[item.mode.toLowerCase() as "normal" | "standard" | "premium"] ?? 12) +
      (item.deepScan ? costs.deepScan ?? 6 : 0);

    const ok = await deductCredits(item.userId, creditsUsed);
    if (!ok) return { ok: false, reason: "NOT_ENOUGH_CREDITS", need: creditsUsed };

    const audit = await db.audit.create({
      data: {
        userId: item.userId,
        domain: item.domain,
        target: item.target,
        mode: item.mode,
        deepScan: item.deepScan === true,
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
      detail: `${item.domain} · ${item.target} · ${item.mode.toLowerCase()}${item.deepScan ? " · deep" : ""} · scheduled check #${item.runs + 1}`,
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
  input: { domain: string; target: string; mode: string; intervalDays: number; deepScan?: boolean }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const domain = normalizeDomain(input.domain);
  if (!DOMAIN_RE.test(domain)) return { ok: false, error: "Enter a valid domain like example.com." };

  const count = await db.watchItem.count({ where: { userId } });
  const { limit, planName } = await getMonitorLimit(userId);
  if (count >= limit) {
    return {
      ok: false,
      error: planName
        ? `Your ${planName} plan covers ${limit} monitored ${limit === 1 ? "domain" : "domains"} and all are in use. Upgrade your plan for more slots.`
        : `Monitoring on the free tier covers ${limit} domain. Upgrade to a plan for more monitored domains.`,
    };
  }

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
      deepScan: input.deepScan === true,
      intervalDays: input.intervalDays,
      active: true,
      nextRunAt: new Date(Date.now() + input.intervalDays * 24 * 60 * 60_000),
    },
  });

  logActivity({
    action: "WATCH_ADD",
    userId,
    actorEmail: "self",
    detail: `${domain} · every ${input.intervalDays} days · ${input.mode.toLowerCase()}${input.deepScan ? " · deep" : ""}`,
  });

  return { ok: true, id: item.id };
}
