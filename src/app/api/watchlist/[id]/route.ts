import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";

const patchSchema = z.object({
  active: z.boolean().optional(),
  intervalDays: z.union([z.literal(7), z.literal(14), z.literal(30)]).optional(),
  deepScan: z.boolean().optional(),
});

async function ownedItem(id: string, userId: string) {
  const item = await db.watchItem.findUnique({ where: { id } });
  if (!item || item.userId !== userId) return null;
  return item;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const item = await ownedItem(id, user.id);
  if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });

  const data: { active?: boolean; intervalDays?: number; deepScan?: boolean; pausedReason?: string | null; nextRunAt?: Date } = {};
  if (typeof parsed.data.active === "boolean") {
    data.active = parsed.data.active;
    // re-enabling schedules from now, clearing any auto-pause note
    if (parsed.data.active) {
      data.pausedReason = null;
      data.nextRunAt = new Date(Date.now() + item.intervalDays * 24 * 60 * 60_000);
    }
  }
  if (typeof parsed.data.deepScan === "boolean") {
    data.deepScan = parsed.data.deepScan;
  }
  if (parsed.data.intervalDays) {
    data.intervalDays = parsed.data.intervalDays;
    // Recompute the next run from the last actual run so the schedule stays meaningful:
    // never run -> one interval from now; otherwise lastRun + new interval.
    const base = item.lastRunAt ? item.lastRunAt.getTime() : Date.now();
    const candidate = base + parsed.data.intervalDays * 24 * 60 * 60_000;
    data.nextRunAt = new Date(Math.max(candidate, Date.now() + 60_000));
  }

  const updated = await db.watchItem.update({ where: { id }, data });

  logActivity({
    action: "WATCH_UPDATE",
    userId: user.id,
    actorEmail: "self",
    detail: `${item.domain} · ${data.active === false ? "paused" : data.active === true ? "resumed" : data.deepScan !== undefined ? (data.deepScan ? "deep scan on" : "deep scan off") : `interval ${updated.intervalDays}d`}`,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const item = await ownedItem(id, user.id);
  if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await db.watchItem.delete({ where: { id } });
  logActivity({
    action: "WATCH_REMOVE",
    userId: user.id,
    actorEmail: "self",
    detail: item.domain,
  });
  return NextResponse.json({ ok: true });
}
