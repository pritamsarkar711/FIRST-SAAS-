import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/credits";
import { addWatchItem, getMonitorLimit } from "@/lib/watchlist";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true, credits: true } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [items, plan] = await Promise.all([
    db.watchItem.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        audits: {
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { id: true, probability: true, status: true, verdict: true, createdAt: true },
        },
      },
    }),
    getMonitorLimit(user.id),
  ]);

  return NextResponse.json({
    items: items.map((i) => ({
      id: i.id,
      domain: i.domain,
      target: i.target,
      mode: i.mode,
      intervalDays: i.intervalDays,
      active: i.active,
      lastAuditId: i.lastAuditId,
      lastScore: i.lastScore,
      lastRunAt: i.lastRunAt?.toISOString() || null,
      nextRunAt: i.nextRunAt?.toISOString() || null,
      runs: i.runs,
      pausedReason: i.pausedReason,
      running: i.audits.some((a) => a.status === "PENDING" || a.status === "RUNNING"),
      history: i.audits.filter((a) => a.status === "DONE").map((a) => ({ id: a.id, probability: a.probability, createdAt: a.createdAt.toISOString() })),
    })),
    credits: user.credits,
    limit: plan.limit,
    planName: plan.planName,
  });
}

const createSchema = z.object({
  domain: z.string().trim().min(4).max(120),
  target: z.enum(["ADSENSE", "EZOIC", "MEDIAVINE", "RAPTIVE"]),
  mode: z.enum(["NORMAL", "STANDARD", "PREMIUM"]),
  intervalDays: z.union([z.literal(7), z.literal(14), z.literal(30)]),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  if (!rateLimit(`watch:${clientIp(req)}`, 12, 10 * 60_000).ok) {
    return NextResponse.json({ error: "Too many changes. Wait a few minutes." }, { status: 429 });
  }
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true, status: true } });
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  if (user.status === "SUSPENDED") return NextResponse.json({ error: "This account is suspended." }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the monitoring settings and try again." }, { status: 400 });

  const result = await addWatchItem(user.id, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ ok: true, id: result.id });
}
