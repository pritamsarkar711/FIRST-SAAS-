import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { totpVerify } from "@/lib/totp";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { password, code } = await req.json().catch(() => ({ password: "", code: "" }));
  if (!verifyPassword(password || "", user.passwordHash)) {
    return NextResponse.json({ error: "Password is incorrect" }, { status: 403 });
  }
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    let ok = false;
    try { ok = totpVerify((code || "").trim(), user.twoFactorSecret); } catch { ok = false; }
    if (!ok) return NextResponse.json({ error: "The authenticator code is not valid" }, { status: 400 });
  }
  await db.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false, twoFactorSecret: null } });
  return NextResponse.json({ ok: true });
}
