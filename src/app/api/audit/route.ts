import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { runAudit } from "@/lib/audit-runner";
import { getCosts, deductCredits, rateLimit, clientIp } from "@/lib/credits";
import { normalizeDomain, assertPublicUrl } from "@/lib/guard";

const schema = z.object({
  domain: z.string().trim().min(4).max(120),
  network: z.enum(["ADSENSE", "EZOIC", "MEDIAVINE", "RAPTIVE"]),
  mode: z.enum(["NORMAL", "STANDARD", "PREMIUM"]),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  if (!rateLimit(`audit:${clientIp(req)}`, 10, 10 * 60_000).ok) {
    return NextResponse.json({ error: "Too many audits started. Wait a few minutes." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid audit request." }, { status: 400 });

  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  if (user.status === "SUSPENDED") return NextResponse.json({ error: "This account is suspended." }, { status: 403 });

  const domain = normalizeDomain(parsed.data.domain);
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain) || /^\d{1,3}(\.\d{1,3}){3}$/.test(domain)) {
    return NextResponse.json({ error: "That does not look like a valid domain." }, { status: 400 });
  }
  try {
    await assertPublicUrl(domain); // reject private, local and unresolvable targets up front
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "This domain cannot be audited." }, { status: 400 });
  }

  const costs = await getCosts();
  const creditsUsed = costs.audit[parsed.data.mode.toLowerCase() as "normal" | "standard" | "premium"] ?? 12;

  const ok = await deductCredits(user.id, creditsUsed);
  if (!ok) {
    return NextResponse.json(
      { error: `Not enough credits. This audit needs ${creditsUsed} credits.`, needCredits: creditsUsed },
      { status: 402 }
    );
  }

  const audit = await db.audit.create({
    data: {
      userId: user.id,
      domain,
      target: parsed.data.network,
      mode: parsed.data.mode,
      status: "PENDING",
      creditsUsed,
    },
  });

  // Fire-and-forget: the persistent Node server processes it while the UI polls.
  void runAudit(audit.id).catch(() => {});

  return NextResponse.json({ ok: true, id: audit.id, creditsUsed });
}
