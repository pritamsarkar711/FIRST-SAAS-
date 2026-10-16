import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";

/**
 * Developer API keys.
 *
 * A key is only ever stored as a sha256 hash; the raw value is returned to the
 * owner exactly once at creation time. The prefix (first 11 chars) is kept for
 * display so users can tell keys apart without exposing the secret.
 */

export const API_KEY_PREFIX = "ak_";

export function createRawApiKey(): string {
  // 24 random bytes, base62-ish: ak_ + 32 url-safe chars
  return API_KEY_PREFIX + randomBytes(24).toString("base64url");
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw.trim()).digest("hex");
}

export function keyPrefixOf(raw: string): string {
  return raw.slice(0, 11);
}

export interface ApiKeyAuthResult {
  ok: boolean;
  status: number;
  error?: string;
  userId?: string;
  keyId?: string;
  keyName?: string;
  actorEmail?: string;
}

/**
 * Authenticate a request carrying `Authorization: Bearer ak_...`.
 * Only this route family may use keys; the session-based app ignores them.
 */
export async function authenticateApiKey(req: Request): Promise<ApiKeyAuthResult> {
  const header = req.headers.get("authorization") || "";
  const raw = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!raw.startsWith(API_KEY_PREFIX) || raw.length < 20 || raw.length > 80) {
    return { ok: false, status: 401, error: "Missing or malformed API key. Send `Authorization: Bearer ak_...`." };
  }

  const key = await db.apiKey.findUnique({
    where: { keyHash: hashApiKey(raw) },
    include: { user: { select: { id: true, email: true, status: true, credits: true } } },
  });
  if (!key) return { ok: false, status: 401, error: "Invalid API key." };
  if (key.revokedAt) return { ok: false, status: 401, error: "This API key has been revoked. Create a new one in Settings." };
  if (key.user.status === "SUSPENDED") return { ok: false, status: 403, error: "The account that owns this key is suspended." };

  // Usage bookkeeping is fire-and-forget; it must never slow the request down.
  void db.apiKey
    .update({
      where: { id: key.id },
      data: { lastUsedAt: new Date(), requestCount: { increment: 1 } },
    })
    .catch(() => {});

  // Per-day usage rollup for the usage chart (fire-and-forget, never blocks the request).
  const day = new Date().toISOString().slice(0, 10);
  void db.apiKeyUsage
    .upsert({
      where: { keyId_day: { keyId: key.id, day } },
      update: { count: { increment: 1 } },
      create: { keyId: key.id, day, count: 1 },
    })
    .catch(() => {});

  return {
    ok: true,
    status: 200,
    userId: key.user.id,
    keyId: key.id,
    keyName: key.name,
    actorEmail: key.user.email,
  };
}

/** Shared CORS headers for the public /api/v1 surface. */
export const v1CorsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function v1Json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...v1CorsHeaders },
  });
}

export function v1Error(error: string, status: number, extra: Record<string, unknown> = {}): Response {
  return v1Json({ ok: false, error, ...extra }, status);
}
