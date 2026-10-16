import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { clientIp, rateLimit } from "@/lib/credits";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  action: z.enum(["profile", "password"]),
  name: z.string().trim().min(2).max(60).optional(),
  current: z.string().max(100).optional(),
  next: z.string().min(8).max(100).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  if (!rateLimit(`settings:${clientIp(req)}`, 10, 5 * 60_000).ok) {
    return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }

  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const ip = clientIp(req);

  if (parsed.data.action === "profile") {
    const name = parsed.data.name;
    if (!name) return NextResponse.json({ error: "Enter your name." }, { status: 400 });
    await db.user.update({ where: { id: user.id }, data: { name } });
    return NextResponse.json({ ok: true, message: "Profile updated." });
  }

  // Password change
  const { current, next } = parsed.data;
  if (!current || !next) return NextResponse.json({ error: "Fill in both password fields." }, { status: 400 });
  if (!user.passwordHash) {
    return NextResponse.json({ error: "This account signs in with Google and has no password set." }, { status: 400 });
  }
  if (!verifyPassword(current, user.passwordHash)) {
    logActivity({ action: "AUTH_PASSWORD_CHANGE", actorEmail: user.email, userId: user.id, detail: "Failed: current password was wrong", ip });
    return NextResponse.json({ error: "Your current password is not correct." }, { status: 400 });
  }
  await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(next) } });
  logActivity({ action: "AUTH_PASSWORD_CHANGE", actorEmail: user.email, userId: user.id, detail: "Password changed", ip });
  return NextResponse.json({ ok: true, message: "Password changed." });
}
