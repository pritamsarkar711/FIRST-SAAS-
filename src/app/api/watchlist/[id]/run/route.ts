import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/credits";
import { startWatchRun } from "@/lib/watchlist";

/** Manual "check now" for a monitored domain. Costs the same credits as a normal audit. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  if (!rateLimit(`watchrun:${clientIp(req)}`, 8, 10 * 60_000).ok) {
    return NextResponse.json({ error: "Too many checks started. Wait a few minutes." }, { status: 429 });
  }
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true, status: true } });
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  if (user.status === "SUSPENDED") return NextResponse.json({ error: "This account is suspended." }, { status: 403 });

  const { id } = await ctx.params;
  const item = await db.watchItem.findUnique({ where: { id } });
  if (!item || item.userId !== user.id) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // prevent double-fire while a check from this item is already running
  const running = await db.audit.findFirst({
    where: { watchItemId: item.id, status: { in: ["PENDING", "RUNNING"] } },
    select: { id: true },
  });
  if (running) return NextResponse.json({ error: "A check for this domain is already in progress." }, { status: 409 });

  const result = await startWatchRun(item);
  if (!result.ok) {
    if (result.reason === "NOT_ENOUGH_CREDITS") {
      return NextResponse.json(
        { error: `Not enough credits. This check needs ${result.need} credits.`, needCredits: result.need },
        { status: 402 }
      );
    }
    return NextResponse.json({ error: "Could not start the check. Try again." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, auditId: result.auditId });
}
