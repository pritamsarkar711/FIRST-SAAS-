import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { totpSecret, totpKeyuri, totpVerify } from "@/lib/totp";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.twoFactorEnabled) return NextResponse.json({ error: "2FA is already enabled" }, { status: 400 });

  const { password } = await req.json().catch(() => ({ password: "" }));
  if (!verifyPassword(password || "", user.passwordHash)) {
    return NextResponse.json({ error: "Password is incorrect" }, { status: 403 });
  }

  const secret = totpSecret();
  const otpauth = totpKeyuri(user.email, "Audit Form", secret);
  const qr = await QRCode.toDataURL(otpauth, { margin: 1, width: 220, color: { dark: "#1b2620", light: "#ffffff" } });

  // store temporarily (not enabled until verified)
  await db.user.update({ where: { id: user.id }, data: { twoFactorSecret: secret } });
  return NextResponse.json({ secret, otpauth, qr });
}
