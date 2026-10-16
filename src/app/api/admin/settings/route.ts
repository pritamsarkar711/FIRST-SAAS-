import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-guard";
import { setSetting, getSetting, SITE_DEFAULTS, AI_DEFAULTS, COSTS_DEFAULTS, GOOGLE_DEFAULTS, SMTP_DEFAULTS } from "@/lib/settings";
import { AUDIT_PROMPT_DEFAULT, WRITER_PROMPT_DEFAULT, AFFILIATE_PROMPT_DEFAULT } from "@/lib/prompts";
import { logActivity } from "@/lib/activity";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  const [site, ai, costs, google, smtp, prompts, indexnow] = await Promise.all([
    getSetting("site", SITE_DEFAULTS),
    getSetting("ai", AI_DEFAULTS),
    getSetting("costs", COSTS_DEFAULTS),
    getSetting("google", GOOGLE_DEFAULTS),
    getSetting("smtp", SMTP_DEFAULTS),
    getSetting("prompts", { audit: AUDIT_PROMPT_DEFAULT, writer: WRITER_PROMPT_DEFAULT, affiliate: AFFILIATE_PROMPT_DEFAULT }),
    getSetting("indexnow", { key: "" }),
  ]);
  return NextResponse.json({ site, ai, costs, google, smtp, prompts, indexnow });
}

const schema = z.object({
  key: z.enum(["site", "ai", "costs", "google", "smtp", "prompts", "indexnow"]),
  value: z.record(z.string(), z.unknown()),
});

export async function POST(req: NextRequest) {
  const { user: admin, error } = await requireAdmin();
  if (error) return error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid settings payload." }, { status: 400 });

  const { key, value } = parsed.data;
  await setSetting(key, value);
  logActivity({ action: "SETTINGS_SAVE", actorEmail: admin.email, detail: `Updated ${key} settings` });
  return NextResponse.json({ ok: true });
}

const testSchema = z.object({ openrouterKey: z.string().min(10) });

export async function PUT(req: NextRequest) {
  // Test the OpenRouter key with a minimal completion
  const { error } = await requireAdmin();
  if (error) return error;
  const parsed = testSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Paste a key first." }, { status: 400 });
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${parsed.data.openrouterKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai/gpt-4o-mini", max_tokens: 10, messages: [{ role: "user", content: "Reply with the word OK" }] }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return NextResponse.json({ ok: false, error: `Key rejected: HTTP ${res.status}` });
    return NextResponse.json({ ok: true, message: "Key works." });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Request failed" });
  }
}
