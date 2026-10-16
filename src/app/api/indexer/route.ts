import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getCosts, deductCredits, rateLimit, clientIp } from "@/lib/credits";
import { assertPublicUrl, normalizeDomain } from "@/lib/guard";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  domain: z.string().trim().min(4).max(120),
  urls: z.array(z.string().trim().url()).min(1).max(20),
});

function userKey(userId: string): string {
  return createHash("sha256").update(`${userId}:${process.env.NEXTAUTH_SECRET || "adaudit"}`).digest("hex").slice(0, 32);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  if (!rateLimit(`indexer:${clientIp(req)}`, 8, 10 * 60_000).ok) {
    return NextResponse.json({ error: "Too many submissions. Wait a few minutes." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Provide your domain and 1 to 20 URLs." }, { status: 400 });

  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  const domain = normalizeDomain(parsed.data.domain);
  const urls = parsed.data.urls;
  // All URLs must belong to the domain
  if (urls.some((u) => normalizeDomain(u) !== domain)) {
    return NextResponse.json({ error: "Every URL must be on the same domain." }, { status: 400 });
  }
  try { await assertPublicUrl(domain); } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid domain" }, { status: 400 });
  }

  const costs = await getCosts();
  const creditsUsed = costs.index;
  const ok = await deductCredits(user.id, creditsUsed);
  if (!ok) return NextResponse.json({ error: `Not enough credits. A batch costs ${creditsUsed}.`, needCredits: creditsUsed }, { status: 402 });

  const key = userKey(user.id);
  const keyFileUrl = `https://${domain}/${key}.txt`;

  // Verify the key file is live at the user's site
  let verified = false;
  try {
    const res = await fetch(keyFileUrl, { signal: AbortSignal.timeout(10_000), cache: "no-store", headers: { "User-Agent": "AdAuditBot/1.0" } });
    if (res.ok) verified = (await res.text()).trim() === key;
  } catch { /* not verified */ }

  if (!verified) {
    // refund: nothing was submitted
    const { addCredits } = await import("@/lib/credits");
    await addCredits(user.id, creditsUsed);
    const reqRow = await db.indexRequest.create({
      data: { userId: user.id, urls: JSON.stringify(urls), keyFileUrl, status: "PENDING", creditsUsed: 0 },
    });
    return NextResponse.json({
      ok: false,
      key,
      keyFileUrl,
      requestId: reqRow.id,
      error: `The key file was not found at ${keyFileUrl} or does not match. Upload a file named ${key}.txt containing exactly: ${key} — then submit again. Credits were not charged.`,
    });
  }

  const engines = [
    "https://api.indexnow.org/indexnow",
  ];
  let submitted = 0;
  const errors: string[] = [];
  for (const endpoint of engines) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", Host: "api.indexnow.org" },
        body: JSON.stringify({ host: domain, key, keyLocation: keyFileUrl, urlList: urls }),
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok || res.status === 202) submitted = urls.length;
      else errors.push(`IndexNow responded ${res.status}`);
    } catch (e) {
      errors.push(e instanceof Error ? e.message.slice(0, 120) : "Submission failed");
    }
  }

  const row = await db.indexRequest.create({
    data: {
      userId: user.id,
      urls: JSON.stringify(urls),
      keyFileUrl,
      status: submitted > 0 ? (errors.length ? "PARTIAL" : "SUBMITTED") : "FAILED",
      result: JSON.stringify({ submitted, errors }),
      creditsUsed,
    },
  });

  if (submitted === 0) {
    return NextResponse.json({ ok: false, key, keyFileUrl, requestId: row.id, error: errors.join("; ") || "Submission failed." });
  }
  logActivity({
    action: "INDEXER_SUBMIT",
    actorEmail: user.email,
    userId: user.id,
    detail: `${submitted} URLs on ${domain}`,
    ip: clientIp(req),
  });
  return NextResponse.json({ ok: true, key, keyFileUrl, requestId: row.id, submitted });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const history = await db.indexRequest.findMany({
    where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10,
    select: { id: true, urls: true, status: true, result: true, createdAt: true },
  });
  return NextResponse.json({
    key: userKey(user.id),
    history: history.map((h) => ({ ...h, urls: JSON.parse(h.urls) as string[], result: h.result ? JSON.parse(h.result) : null, createdAt: h.createdAt })),
  });
}

// key generation helper unused elsewhere; keep randomBytes import meaningful for potential rotation
export const _randomKey = () => randomBytes(16).toString("hex");
