import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { runAudit } from "@/lib/audit-runner";
import { getCosts, deductCredits, rateLimit, clientIp } from "@/lib/credits";
import { normalizeDomain, assertPublicUrl } from "@/lib/guard";
import { authenticateApiKey, v1Json, v1Error, v1CorsHeaders } from "@/lib/api-keys";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const startSchema = z.object({
  domain: z.string().trim().min(4).max(120),
  network: z.enum(["ADSENSE", "EZOIC", "MEDIAVINE", "RAPTIVE"]).default("ADSENSE"),
  mode: z.enum(["NORMAL", "STANDARD", "PREMIUM"]).default("STANDARD"),
});

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const IP_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

function publicAudit(a: {
  id: string; domain: string; target: string; mode: string; status: string;
  probability: number; verdict: string | null; error: string | null;
  creditsUsed: number; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: a.id,
    domain: a.domain,
    network: a.target,
    mode: a.mode.toLowerCase(),
    status: a.status.toLowerCase(), // pending | running | done | failed
    probability: a.status === "DONE" ? a.probability : null,
    verdict: a.verdict,
    error: a.error,
    credits_used: a.creditsUsed,
    created_at: a.createdAt.toISOString(),
    updated_at: a.updatedAt.toISOString(),
  };
}

/** GET /api/v1/audits — the 20 most recent audits on the key owner's account. */
export async function GET(req: NextRequest) {
  const authResult = await authenticateApiKey(req);
  if (!authResult.ok) return v1Error(authResult.error || "Unauthorized", authResult.status);

  const audits = await db.audit.findMany({
    where: { userId: authResult.userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return v1Json({ ok: true, count: audits.length, audits: audits.map(publicAudit) });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: v1CorsHeaders });
}

/** POST /api/v1/audits — start one audit. Same engine, credits and guards as the app. */
export async function POST(req: NextRequest) {
  const authResult = await authenticateApiKey(req);
  if (!authResult.ok) return v1Error(authResult.error || "Unauthorized", authResult.status);

  if (!rateLimit(`v1audit:${authResult.keyId}`, 30, 10 * 60_000).ok) {
    return v1Error("Rate limit exceeded. 30 audit starts per 10 minutes per key.", 429);
  }

  const body = await req.json().catch(() => null);
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return v1Error("Invalid request body. Provide { domain, network?, mode? }.", 400, {
      fields: ["domain (required)", "network: ADSENSE | EZOIC | MEDIAVINE | RAPTIVE", "mode: NORMAL | STANDARD | PREMIUM"],
    });
  }

  const user = await db.user.findUnique({ where: { id: authResult.userId } });
  if (!user) return v1Error("Account not found.", 401);

  const { network, mode } = parsed.data;
  const domain = normalizeDomain(parsed.data.domain);
  if (!DOMAIN_RE.test(domain) || IP_RE.test(domain)) {
    return v1Error("That domain does not look valid. Example: myblog.com", 400);
  }
  try {
    await assertPublicUrl(domain);
  } catch {
    return v1Error("That domain cannot be audited from this service.", 400);
  }

  const costs = await getCosts();
  const creditsUsed = costs.audit[mode.toLowerCase() as "normal" | "standard" | "premium"] ?? 12;

  const ok = await deductCredits(user.id, creditsUsed);
  if (!ok) {
    return v1Error(`Not enough credits. This audit costs ${creditsUsed} credits.`, 402, {
      credits_needed: creditsUsed,
      top_up: "/dashboard/billing",
    });
  }

  const audit = await db.audit.create({
    data: {
      userId: user.id,
      domain,
      target: network,
      mode,
      status: "PENDING",
      creditsUsed,
    },
  });

  void runAudit(audit.id).catch(() => {});

  logActivity({
    action: "API_AUDIT_START",
    actorEmail: authResult.actorEmail || user.email,
    userId: user.id,
    detail: `${domain} · ${network} · ${mode.toLowerCase()} · key ${authResult.keyName}`,
    ip: clientIp(req),
  });

  return v1Json(
    {
      ok: true,
      audit: publicAudit(audit),
      poll: `/api/v1/audits/${audit.id}`,
      next_check_hint: "Poll every 5 seconds until status is done or failed. A full check usually takes 1 to 3 minutes.",
    },
    202
  );
}
