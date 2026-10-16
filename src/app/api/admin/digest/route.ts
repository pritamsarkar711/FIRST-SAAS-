import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-guard";
import { maybeSendDigests } from "@/lib/monitor-digest";
import { logActivity } from "@/lib/activity";

const schema = z.object({ action: z.literal("send") });

/** Admin "send the monitoring digest now" button. Bypasses the 7-day cadence. */
export async function POST(req: Request) {
  const { user: admin, error } = await requireAdmin();
  if (error) return error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Unknown action." }, { status: 400 });

  const result = await maybeSendDigests({ force: true });
  logActivity({
    action: result.sent > 0 ? "DIGEST_SENT" : "DIGEST_SKIP",
    actorEmail: admin.email,
    detail: result.sent > 0 ? `Manual digest run sent ${result.sent} email(s)` : `Manual digest run skipped: ${result.skipped}`,
  });
  return NextResponse.json({ ok: true, sent: result.sent, skipped: result.skipped });
}
