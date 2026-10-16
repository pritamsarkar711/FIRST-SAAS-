import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { runWriter, parseLinks } from "@/lib/writer-runner";
import { getCosts, deductCredits, rateLimit, clientIp } from "@/lib/credits";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  type: z.enum(["ADSENSE", "AFFILIATE"]),
  keyword: z.string().trim().min(3).max(120),
  mode: z.enum(["STANDARD", "PREMIUM"]),
  words: z.number().int().min(800).max(4000),
  imageStyle: z.enum(["vector", "photo", "brutalist", "diagram"]),
  internalLinksRaw: z.string().max(2000).optional().default(""),
  affiliateLinksRaw: z.string().max(2000).optional().default(""),
  siteName: z.string().max(120).optional().default(""),
  audience: z.string().max(200).optional().default(""),
  notes: z.string().max(600).optional().default(""),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  if (!rateLimit(`writer:${clientIp(req)}`, 6, 10 * 60_000).ok) {
    return NextResponse.json({ error: "Too many generations started. Wait a few minutes." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input." }, { status: 400 });
  }
  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  if (user.status === "SUSPENDED") return NextResponse.json({ error: "This account is suspended." }, { status: 403 });

  const d = parsed.data;
  const costs = await getCosts();
  const creditsUsed = costs.writer[d.mode.toLowerCase() as "standard" | "premium"] ?? 15;

  const ok = await deductCredits(user.id, creditsUsed);
  if (!ok) return NextResponse.json({ error: `Not enough credits. This article needs ${creditsUsed} credits.`, needCredits: creditsUsed }, { status: 402 });

  const job = await db.contentJob.create({
    data: {
      userId: user.id,
      type: d.type,
      mode: d.mode,
      keyword: d.keyword,
      creditsUsed,
      input: JSON.stringify({
        keyword: d.keyword,
        mode: d.mode,
        words: d.words,
        imageStyle: d.imageStyle,
        internalLinks: parseLinks(d.internalLinksRaw),
        affiliateLinks: parseLinks(d.affiliateLinksRaw).map((l) => ({ label: l.anchor || "product", url: l.url })),
        siteName: d.siteName,
        audience: d.audience,
        notes: d.notes,
      }),
    },
  });

  void runWriter(job.id).catch(() => {});
  logActivity({
    action: "WRITER_START",
    actorEmail: user.email,
    userId: user.id,
    detail: `${d.type.toLowerCase()} article · "${d.keyword}" · ${d.mode.toLowerCase()} · ${d.words} words`,
    ip: clientIp(req),
  });
  return NextResponse.json({ ok: true, id: job.id, creditsUsed });
}
