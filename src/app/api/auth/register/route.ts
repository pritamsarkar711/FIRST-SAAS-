import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, randomCode } from "@/lib/password";
import { ensureSeeded } from "@/lib/seed";
import { getCosts, rateLimit, clientIp } from "@/lib/credits";

const schema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(100),
  acceptTerms: z.literal(true),
});

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const ip = clientIp(req);
  if (!rateLimit(`register:${ip}`, 5, 10 * 60_000).ok) {
    return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message || "Invalid input";
    return NextResponse.json({ error: msg.includes("accept") ? "You must accept the Terms of Service" : msg }, { status: 400 });
  }
  const { name, email, password } = parsed.data;

  const exists = await db.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });

  const refCode = req.cookies.get("ref")?.value || null;
  let referredById: string | null = null;
  if (refCode) {
    const referrer = await db.user.findUnique({ where: { referralCode: refCode }, select: { id: true } });
    referredById = referrer?.id ?? null;
  }

  const costs = await getCosts();
  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash: hashPassword(password),
      credits: costs.signupBonus,
      referralCode: `AD${randomCode(6)}`,
      referredById,
    },
  });

  return NextResponse.json({ ok: true, email: user.email });
}
