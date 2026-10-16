import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createRawApiKey, keyPrefixOf, hashApiKey } from "@/lib/api-keys";
import { rateLimit, clientIp } from "@/lib/credits";
import { logActivity } from "@/lib/activity";

const MAX_ACTIVE_KEYS = 5;

const createSchema = z.object({
  action: z.literal("create"),
  name: z.string().trim().min(2).max(40),
  dailyCap: z.coerce.number().int().min(1).max(10000).nullable().optional(),
});

const revokeSchema = z.object({
  action: z.literal("revoke"),
  id: z.string().min(1).max(64),
});

const capSchema = z.object({
  action: z.literal("setCap"),
  id: z.string().min(1).max(64),
  dailyCap: z.coerce.number().int().min(1).max(10000).nullable(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keys = await db.apiKey.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, prefix: true, lastUsedAt: true, requestCount: true,
      dailyCap: true, revokedAt: true, createdAt: true,
    },
  });

  // 14-day usage series (UTC days, gaps included) rolled up per key so the UI can
  // show both the combined chart and a per-key breakdown.
  const since = new Date(Date.now() - 13 * 86_400_000);
  const sinceDay = since.toISOString().slice(0, 10);
  const usage = await db.apiKeyUsage.findMany({
    where: { key: { userId: user.id }, day: { gte: sinceDay } },
    select: { keyId: true, day: true, count: true },
  });
  const byDay = new Map<string, number>();
  const byKeyDay = new Map<string, number>();
  for (const row of usage) {
    byDay.set(row.day, (byDay.get(row.day) || 0) + row.count);
    byKeyDay.set(`${row.keyId}|${row.day}`, row.count);
  }
  const days: { day: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    days.push({ day: d, count: byDay.get(d) || 0 });
  }
  const perKey: Record<string, { day: string; count: number }[]> = {};
  for (const k of keys) {
    const series: { day: string; count: number }[] = [];
    for (const d of days) series.push({ day: d.day, count: byKeyDay.get(`${k.id}|${d.day}`) || 0 });
    perKey[k.id] = series;
  }

  return NextResponse.json({ keys, maxActive: MAX_ACTIVE_KEYS, usage: days, perKey });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  if (user.status === "SUSPENDED") return NextResponse.json({ error: "This account is suspended." }, { status: 403 });
  if (!rateLimit(`keys:${clientIp(req)}`, 10, 10 * 60_000).ok) {
    return NextResponse.json({ error: "Too many requests. Try again in a few minutes." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const action = (body as { action?: string } | null)?.action;

  if (action === "create") {
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Give the key a short name (2 to 40 characters)." }, { status: 400 });

    const activeCount = await db.apiKey.count({ where: { userId: user.id, revokedAt: null } });
    if (activeCount >= MAX_ACTIVE_KEYS) {
      return NextResponse.json({ error: `You already have ${MAX_ACTIVE_KEYS} active keys. Revoke one before creating another.` }, { status: 400 });
    }

    const raw = createRawApiKey();
    const key = await db.apiKey.create({
      data: {
        userId: user.id,
        name: parsed.data.name,
        prefix: keyPrefixOf(raw),
        keyHash: hashApiKey(raw),
        dailyCap: parsed.data.dailyCap ?? null,
      },
    });

    logActivity({
      action: "API_KEY_CREATE",
      actorEmail: user.email,
      userId: user.id,
      detail: `${parsed.data.name} · ${key.prefix}`,
      ip: clientIp(req),
    });

    // The raw key is returned exactly once. The database only keeps the hash.
    return NextResponse.json({
      ok: true,
      key: { id: key.id, name: key.name, prefix: key.prefix, createdAt: key.createdAt },
      secret: raw,
    });
  }

  if (action === "setCap") {
    const parsed = capSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Cap must be between 1 and 10,000 requests per day, or empty for unlimited." }, { status: 400 });

    const key = await db.apiKey.findFirst({ where: { id: parsed.data.id, userId: user.id } });
    if (!key) return NextResponse.json({ error: "Key not found." }, { status: 404 });

    await db.apiKey.update({ where: { id: key.id }, data: { dailyCap: parsed.data.dailyCap } });
    logActivity({
      action: "API_KEY_UPDATE",
      actorEmail: user.email,
      userId: user.id,
      detail: `${key.name} · daily cap ${parsed.data.dailyCap === null ? "removed (unlimited)" : `set to ${parsed.data.dailyCap}/day`}`,
      ip: clientIp(req),
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "revoke") {
    const parsed = revokeSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Missing key id." }, { status: 400 });

    const key = await db.apiKey.findFirst({ where: { id: parsed.data.id, userId: user.id } });
    if (!key) return NextResponse.json({ error: "Key not found." }, { status: 404 });
    if (key.revokedAt) return NextResponse.json({ ok: true });

    await db.apiKey.update({ where: { id: key.id }, data: { revokedAt: new Date() } });
    logActivity({
      action: "API_KEY_REVOKE",
      actorEmail: user.email,
      userId: user.id,
      detail: `${key.name} · ${key.prefix}`,
      ip: clientIp(req),
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
