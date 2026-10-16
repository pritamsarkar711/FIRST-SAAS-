import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import {
  setSetting, SITE_DEFAULTS, AI_DEFAULTS, COSTS_DEFAULTS, GOOGLE_DEFAULTS, SMTP_DEFAULTS,
} from "@/lib/settings";
import { AUDIT_PROMPT_DEFAULT, WRITER_PROMPT_DEFAULT, AFFILIATE_PROMPT_DEFAULT } from "@/lib/prompts";

let seedPromise: Promise<void> | null = null;

const PLANS = [
  {
    name: "Starter", slug: "starter", priceUsd: 6.9, credits: 60, sortOrder: 1, monitorLimit: 1,
    description: "For a first site. Run a full audit, fix issues, re-check.",
    features: JSON.stringify([
      "60 credits",
      "6 premium audits or 12 normal audits",
      "1 monitored domain on a schedule",
      "PDF readiness reports",
      "All audit modes",
      "Content writer access",
    ]),
  },
  {
    name: "Standard", slug: "standard", priceUsd: 14.9, credits: 150, sortOrder: 2, badge: "Best value", monitorLimit: 3,
    description: "Our recommended plan. Best balance of depth and cost.",
    features: JSON.stringify([
      "150 credits",
      "12 premium audits",
      "3 monitored domains on a schedule",
      "10 articles with the content writer",
      "Quick index tool",
      "Priority AI queue",
    ]),
  },
  {
    name: "Pro", slug: "pro", priceUsd: 29.9, credits: 350, sortOrder: 3, monitorLimit: 10,
    description: "For bloggers running 2 or more sites seriously.",
    features: JSON.stringify([
      "350 credits",
      "Unlimited standard audits",
      "10 monitored domains on a schedule",
      "23 premium audits",
      "Premium content writer mode",
      "Affiliate program access",
    ]),
  },
  {
    name: "Agency", slug: "agency", priceUsd: 79, credits: 1000, sortOrder: 4, monitorLimit: 25,
    description: "Audit client sites and scale your publishing.",
    features: JSON.stringify([
      "1000 credits",
      "40 premium audits",
      "25 monitored domains on a schedule",
      "Bulk auditing workflow",
      "White-labeled PDF reports",
      "Priority support",
    ]),
  },
];

const GATEWAYS = [
  { code: "bkash", name: "bKash", mode: "MANUAL", sortOrder: 1, instructions: "Send the exact amount to our bKash merchant/personal number shown at checkout, then submit the Transaction ID (TrxID). Approval is usually within 30 minutes during business hours." },
  { code: "nagad", name: "Nagad", mode: "MANUAL", sortOrder: 2, instructions: "Send Money to the Nagad number shown at checkout, then submit the Transaction ID. Approval is usually within 30 minutes." },
  { code: "rocket", name: "Rocket (DBBL)", mode: "MANUAL", sortOrder: 3, instructions: "Send Money to the Rocket number shown at checkout, then submit the Transaction ID with your name." },
  { code: "upay", name: "Upay", mode: "MANUAL", sortOrder: 4, instructions: "Send Money to the Upay number shown at checkout, then submit the Transaction ID." },
  { code: "sslcommerz", name: "SSLCommerz", mode: "API", sortOrder: 5, instructions: "Pay with cards, mobile wallets or internet banking via SSLCommerz secure checkout." },
  { code: "shurjopay", name: "ShurjoPay", mode: "API", sortOrder: 6, instructions: "Pay via ShurjoPay with cards or mobile banking." },
  { code: "aamarpay", name: "AamarPay", mode: "API", sortOrder: 7, instructions: "Pay via AamarPay with cards or mobile banking." },
  { code: "stripe", name: "Stripe (Cards)", mode: "API", sortOrder: 8, instructions: "Pay with Visa, Mastercard or AMEX via Stripe." },
  { code: "paypal", name: "PayPal", mode: "API", sortOrder: 9, instructions: "Pay with your PayPal balance or linked card." },
  { code: "paddle", name: "Paddle", mode: "API", sortOrder: 10, instructions: "Checkout with cards or PayPal via Paddle merchant of record." },
];

async function seed(): Promise<void> {
  const marker = await db.setting.findUnique({ where: { key: "seeded" } });
  if (marker) return;

  // Admin account (change the password from /manage/settings after first login)
  await db.user.upsert({
    where: { email: process.env.ADMIN_EMAIL || "admin@adaudit.app" },
    update: {},
    create: {
      email: process.env.ADMIN_EMAIL || "admin@adaudit.app",
      name: "Administrator",
      passwordHash: hashPassword(process.env.ADMIN_PASSWORD || "Admin@2024!"),
      role: "ADMIN",
      credits: 9999,
      referralCode: "ADMIN001",
    },
  });

  for (const p of PLANS) {
    await db.plan.upsert({ where: { slug: p.slug }, update: {}, create: p });
  }
  const PNG_GATEWAYS = new Set(["bkash", "nagad", "rocket", "upay", "sslcommerz", "shurjopay", "aamarpay", "mediavine", "raptive", "ezoic", "paddle"]);
  for (const g of GATEWAYS) {
    await db.gatewayConfig.upsert({
      where: { code: g.code },
      update: {},
      create: { code: g.code, name: g.name, mode: g.mode, instructions: g.instructions, sortOrder: g.sortOrder, logo: `/logos/${g.code}.${PNG_GATEWAYS.has(g.code) ? "png" : "svg"}` },
    });
  }
  // Enable the three most-used manual rails by default (no API keys needed)
  await db.gatewayConfig.updateMany({ where: { code: { in: ["bkash", "nagad", "rocket"] } }, data: { enabled: true } });

  await setSetting("site", SITE_DEFAULTS);
  await setSetting("ai", AI_DEFAULTS);
  await setSetting("costs", COSTS_DEFAULTS);
  await setSetting("google", GOOGLE_DEFAULTS);
  await setSetting("smtp", SMTP_DEFAULTS);
  await setSetting("prompts", { audit: AUDIT_PROMPT_DEFAULT, writer: WRITER_PROMPT_DEFAULT, affiliate: AFFILIATE_PROMPT_DEFAULT });
  await setSetting("indexnow", { key: "" });
  await setSetting("seeded", { at: new Date().toISOString() });
}

export function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = seed().catch((e) => {
      seedPromise = null;
      throw e;
    });
  }
  return seedPromise;
}
