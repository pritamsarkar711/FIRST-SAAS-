import { db } from "@/lib/db";

type CacheEntry = { value: unknown; at: number };
const MEM_TTL_MS = 15_000;
const cache = new Map<string, CacheEntry>();

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < MEM_TTL_MS) return hit.value as T;
  try {
    const row = await db.setting.findUnique({ where: { key } });
    if (!row) return fallback;
    const value = JSON.parse(row.value) as T;
    cache.set(key, { value, at: Date.now() });
    return value;
  } catch {
    return fallback;
  }
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const raw = JSON.stringify(value);
  await db.setting.upsert({ where: { key }, update: { value: raw }, create: { key, value: raw } });
  cache.delete(key);
}

export function invalidateSetting(key?: string) {
  if (key) cache.delete(key);
  else cache.clear();
}

// ---------- typed shapes ----------
export interface SiteSettings {
  name: string;
  tagline: string;
  supportEmail: string;
  usdBdt: number;
  usdBdtAuto: boolean;
  affiliateRate: number; // percent
  minWithdrawUsd: number;
}
export const SITE_DEFAULTS: SiteSettings = {
  name: "AdAudit",
  tagline: "Know your AdSense approval odds before you apply.",
  supportEmail: "support@adaudit.app",
  usdBdt: 122,
  usdBdtAuto: true,
  affiliateRate: 20,
  minWithdrawUsd: 10,
};

export interface AiSettings {
  openrouterKey: string;
  models: { normal: string; standard: string; premium: string };
  writerModels: { standard: string; premium: string };
}
export const AI_DEFAULTS: AiSettings = {
  openrouterKey: "",
  models: {
    normal: "google/gemini-2.5-flash",
    standard: "openai/gpt-4.1",
    premium: "anthropic/claude-sonnet-4",
  },
  writerModels: {
    standard: "openai/gpt-4.1",
    premium: "anthropic/claude-sonnet-4",
  },
};

export interface CreditCosts {
  audit: { normal: number; standard: number; premium: number };
  deepScan: number; // surcharge added to the audit mode cost when deep scan is on
  writer: { standard: number; premium: number };
  index: number;
  signupBonus: number;
}
export const COSTS_DEFAULTS: CreditCosts = {
  audit: { normal: 5, standard: 12, premium: 25 },
  deepScan: 6,
  writer: { standard: 15, premium: 35 },
  index: 2,
  signupBonus: 10,
};

export interface PromptSettings {
  audit: string;
  writer: string;
  affiliate: string;
}

export interface GoogleSettings { clientId: string; clientSecret: string }
export const GOOGLE_DEFAULTS: GoogleSettings = { clientId: "", clientSecret: "" };

export interface SmtpSettings { host: string; port: number; user: string; pass: string; from: string }
export const SMTP_DEFAULTS: SmtpSettings = { host: "", port: 587, user: "", pass: "", from: "" };

// ---------- FX rate ----------
let fxCache: { rate: number; at: number } | null = null;
export async function getUsdBdt(site?: SiteSettings): Promise<number> {
  const s = site ?? (await getSetting<SiteSettings>("site", SITE_DEFAULTS));
  if (!s.usdBdtAuto) return s.usdBdt;
  if (fxCache && Date.now() - fxCache.at < 3600_000) return fxCache.rate;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(6000), cache: "no-store" });
    const data = await res.json();
    const rate = Number(data?.rates?.BDT);
    if (rate > 50 && rate < 300) {
      fxCache = { rate, at: Date.now() };
      return rate;
    }
  } catch { /* offline — fall back */ }
  return s.usdBdt;
}

export async function siteSettings(): Promise<SiteSettings> {
  return getSetting<SiteSettings>("site", SITE_DEFAULTS);
}
