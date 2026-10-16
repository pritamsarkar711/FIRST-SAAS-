import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tickWatchlist } from "@/lib/watchlist";
import { requireAdmin } from "@/lib/admin-guard";
import { rateLimit, clientIp } from "@/lib/credits";

const KEY_SETTING = "watchTickKey";

async function ensureKey(): Promise<string> {
  const row = await db.setting.findUnique({ where: { key: KEY_SETTING } });
  if (row) {
    try {
      return JSON.parse(row.value) as string;
    } catch {
      // fall through and regenerate
    }
  }
  const key = `wt_${crypto.randomUUID().replace(/-/g, "")}`;
  await db.setting.upsert({
    where: { key: KEY_SETTING },
    update: { value: JSON.stringify(key) },
    create: { key: KEY_SETTING, value: JSON.stringify(key) },
  });
  return key;
}

export async function GET() {
  // Exposes the automation key to signed-in admins so they can wire a cron job on shared hosting.
  const { error } = await requireAdmin();
  if (error) return error;
  return NextResponse.json({ key: await ensureKey() });
}

/**
 * The lazy scheduler. Runs due monitored audits.
 * - Signed-in user: processes only that user's due items (fired when the dashboard loads).
 * - ?key=<automation key>: processes everyone's due items, for a Hostinger cron hitting this URL.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`watchtick:${clientIp(req)}`, 6, 5 * 60_000).ok) {
    return NextResponse.json({ error: "Too many ticks." }, { status: 429 });
  }

  const key = req.nextUrl.searchParams.get("key");
  if (key) {
    const expected = await ensureKey();
    if (key === expected) {
      const result = await tickWatchlist({ key });
      // Weekly digest rides on the automation tick; failures are non-fatal.
      const { maybeSendDigests } = await import("@/lib/monitor-digest");
      const digest = await maybeSendDigests().catch(() => ({ sent: 0, skipped: "Digest failed.", enabled: true }));
      if (digest.sent > 0) {
        logActivity({ action: "DIGEST_SENT", actorEmail: "automation", detail: `${digest.sent} monitoring digest email(s) sent` });
      }
      return NextResponse.json({ ok: true, ...result, digest: { sent: digest.sent, skipped: digest.skipped || undefined } });
    }
    return NextResponse.json({ error: "Invalid key." }, { status: 403 });
  }

  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await tickWatchlist({ userId: user.id });
  return NextResponse.json({ ok: true, ...result });
}
