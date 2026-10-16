import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { runAudit } from "@/lib/audit-runner";
import { getCosts, deductCredits, rateLimit, clientIp } from "@/lib/credits";
import { normalizeDomain, assertPublicUrl } from "@/lib/guard";
import { logActivity } from "@/lib/activity";

const single = z.object({
  domain: z.string().trim().min(4).max(120),
  network: z.enum(["ADSENSE", "EZOIC", "MEDIAVINE", "RAPTIVE"]),
  mode: z.enum(["NORMAL", "STANDARD", "PREMIUM"]),
  deepScan: z.boolean().optional().default(false),
});

const batch = single.omit({ domain: true }).extend({ domains: z.array(z.string().trim().min(4).max(120)).min(1).max(10) });

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const IP_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Batch progress polling: GET /api/audit?batch=<batchId> */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const batchId = req.nextUrl.searchParams.get("batch");
  if (!batchId) return NextResponse.json({ error: "Missing batch id." }, { status: 400 });

  const audits = await db.audit.findMany({
    where: { batchId, userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, domain: true, status: true, probability: true, verdict: true, error: true },
  });
  return NextResponse.json({ audits });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  if (!rateLimit(`audit:${clientIp(req)}`, 10, 10 * 60_000).ok) {
    return NextResponse.json({ error: "Too many audits started. Wait a few minutes." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const isBatch = Array.isArray((body as { domains?: unknown })?.domains);
  const parsed = (isBatch ? batch : single).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid audit request." }, { status: 400 });

  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  if (user.status === "SUSPENDED") return NextResponse.json({ error: "This account is suspended." }, { status: 403 });

  const { network, mode } = parsed.data;
  const deepScan = (parsed.data as { deepScan?: boolean }).deepScan === true;
  const costs = await getCosts();
  const creditsUsed =
    (costs.audit[mode.toLowerCase() as "normal" | "standard" | "premium"] ?? 12) +
    (deepScan ? costs.deepScan ?? 6 : 0);

  // Resolve every target up front. Invalid domains are reported before any credit moves.
  const rawDomains = isBatch ? (parsed.data as z.infer<typeof batch>).domains : [parsed.data.domain];
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const raw of rawDomains) {
    const domain = normalizeDomain(raw);
    if (!DOMAIN_RE.test(domain) || IP_RE.test(domain) || seen.has(domain)) {
      invalid.push(raw);
      continue;
    }
    seen.add(domain);
    try {
      await assertPublicUrl(domain);
      valid.push(domain);
    } catch {
      invalid.push(raw);
    }
  }

  if (valid.length === 0) {
    return NextResponse.json(
      { error: "None of those domains can be audited.", invalid },
      { status: 400 }
    );
  }

  const totalCost = creditsUsed * valid.length;
  const ok = await deductCredits(user.id, totalCost);
  if (!ok) {
    return NextResponse.json(
      { error: `Not enough credits. ${valid.length} ${valid.length === 1 ? "audit needs" : "audits need"} ${totalCost} credits.`, needCredits: totalCost },
      { status: 402 }
    );
  }

  const ip = clientIp(req);
  const batchId = isBatch && valid.length > 1 ? `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` : null;

  const created = await db.$transaction(
    valid.map((domain) =>
      db.audit.create({
        data: {
          userId: user.id,
          domain,
          target: network,
          mode,
          deepScan,
          status: "PENDING",
          creditsUsed,
          batchId,
        },
      })
    )
  );

  // Fire-and-forget: the persistent Node server processes them while the UI polls.
  for (const audit of created) void runAudit(audit.id).catch(() => {});

  logActivity({
    action: isBatch && valid.length > 1 ? "AUDIT_BATCH_START" : "AUDIT_START",
    actorEmail: user.email,
    userId: user.id,
    detail: `${valid.join(", ")} · ${network} · ${mode.toLowerCase()}${deepScan ? " · deep" : ""}`,
    ip,
  });

  return NextResponse.json({ ok: true, id: created[0]?.id, batchId, audits: created.map((a) => ({ id: a.id, domain: a.domain })), creditsUsed: totalCost, invalid });
}
