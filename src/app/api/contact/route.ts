import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/credits";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  reason: z.string().trim().min(2).max(60),
  message: z.string().trim().min(10).max(2000),
});

export async function POST(req: NextRequest) {
  if (!rateLimit(`contact:${clientIp(req)}`, 5, 10 * 60_000).ok) {
    return NextResponse.json({ error: "Too many messages. Try again later." }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fill in every field correctly." }, { status: 400 });
  }
  const session = await auth();
  let userId: string | null = null;
  if (session?.user?.email) {
    const u = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
    userId = u?.id ?? null;
  }
  await db.contactMessage.create({ data: { ...parsed.data, userId } });
  return NextResponse.json({ ok: true });
}
