import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const items = await db.watchItem.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { email: true, status: true } } },
  });

  const now = Date.now();
  const monitors = items.map((w) => ({
    id: w.id,
    domain: w.domain,
    target: w.target,
    mode: w.mode,
    deepScan: w.deepScan,
    intervalDays: w.intervalDays,
    active: w.active,
    pausedReason: w.pausedReason,
    runs: w.runs,
    lastScore: w.lastScore,
    lastRunAt: w.lastRunAt,
    nextRunAt: w.nextRunAt,
    overdueMinutes: w.active && w.nextRunAt.getTime() < now ? Math.round((now - w.nextRunAt.getTime()) / 60_000) : null,
    user: { email: w.user.email, status: w.user.status },
    createdAt: w.createdAt,
  }));

  return NextResponse.json({
    monitors,
    summary: {
      total: monitors.length,
      active: monitors.filter((m) => m.active).length,
      deep: monitors.filter((m) => m.deepScan).length,
      overdue: monitors.filter((m) => m.overdueMinutes !== null).length,
    },
  });
}
