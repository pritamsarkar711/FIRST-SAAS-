import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { totpVerify } from "@/lib/totp";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { clientIp } from "@/lib/credits";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user || !user.twoFactorSecret) return NextResponse.json({ error: "Start the setup first" }, { status: 400 });

  const { code } = await req.json().catch(() => ({ code: "" }));
  let ok = false;
  try { ok = totpVerify((code || "").trim(), user.twoFactorSecret); } catch { ok = false; }
  if (!ok) return NextResponse.json({ error: "The code is not valid. Check your authenticator app clock and try again." }, { status: 400 });

  await db.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
  logActivity({ action: "AUTH_2FA_ENABLE", actorEmail: user.email, userId: user.id, ip: clientIp(req) });
  return NextResponse.json({ ok: true });
}
