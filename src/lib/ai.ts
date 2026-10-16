import { getSetting, AI_DEFAULTS, type AiSettings } from "@/lib/settings";

export type AiMode = "normal" | "standard" | "premium";

interface LlmArgs {
  system: string;
  user: string;
  mode: AiMode;
  maxTokens?: number;
  temperature?: number;
  writer?: boolean;
}

const ZAI_MODELS: Record<AiMode, string> = {
  normal: "glm-4-flash",
  standard: "glm-4-plus",
  premium: "glm-4-plus",
};

export async function aiSettings(): Promise<AiSettings> {
  return getSetting<AiSettings>("ai", AI_DEFAULTS);
}

export function modelForMode(ai: AiSettings, mode: AiMode, writer = false): string {
  if (writer) return ai.writerModels?.[mode === "normal" ? "standard" : mode] || AI_DEFAULTS.writerModels.standard;
  return ai.models?.[mode] || AI_DEFAULTS.models.standard;
}

async function openRouterChat(ai: AiSettings, args: LlmArgs, model: string): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ai.openrouterKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXTAUTH_URL || "https://adaudit.app",
      "X-Title": "Audit Form",
    },
    body: JSON.stringify({
      model,
      max_tokens: args.maxTokens ?? 8000,
      temperature: args.temperature ?? 0.4,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
    }),
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenRouter error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty completion from OpenRouter");
  return content as string;
}

async function zaiChat(args: LlmArgs, mode: AiMode): Promise<string> {
  const { default: ZAI } = await import("z-ai-web-dev-sdk");
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    model: ZAI_MODELS[mode],
    max_tokens: args.maxTokens ?? 8000,
    temperature: args.temperature ?? 0.4,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
  } as never);
  const content = (completion as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty completion from AI provider");
  return content;
}

export async function llmComplete(args: LlmArgs): Promise<{ text: string; provider: string; model: string }> {
  const ai = await aiSettings();
  const model = modelForMode(ai, args.mode, args.writer);
  if (ai.openrouterKey && ai.openrouterKey.trim().length > 10) {
    return { text: await openRouterChat(ai, args, model), provider: "openrouter", model };
  }
  return { text: await zaiChat(args, args.mode), provider: "zai", model: ZAI_MODELS[args.mode] };
}

/** Runs the completion and robustly extracts the first balanced JSON object. Retries once on parse failure. */
export async function llmJson<T>(args: LlmArgs): Promise<{ data: T; provider: string; model: string }> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { text, provider, model } = await llmComplete({
        ...args,
        system: attempt === 0 ? args.system : `${args.system}\n\nCRITICAL: your previous reply was not parseable JSON. Return ONLY the raw JSON object this time, nothing else.`,
      });
      const data = extractJson<T>(text);
      if (data) return { data, provider, model };
      throw new Error("JSON extraction failed");
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("AI request failed");
}

export function extractJson<T>(text: string): T | null {
  if (!text) return null;
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const start = t.indexOf("{");
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < t.length; i++) {
    const ch = t[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) return null;
  try {
    return JSON.parse(t.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/** Image generation: uses built-in SDK in sandbox, or admin-configured OpenRouter-compatible endpoint. */
export async function generateImage(prompt: string, size: "1024x1024" | "1344x768" = "1344x768"): Promise<Buffer> {
  const { default: ZAI } = await import("z-ai-web-dev-sdk");
  const zai = await ZAI.create();
  const response = await zai.images.generations.create({
    prompt,
    size,
  } as never);
  const b64 = (response as { data?: { base64?: string }[] })?.data?.[0]?.base64;
  if (!b64) throw new Error("Image generation returned no data");
  return Buffer.from(b64, "base64");
}
