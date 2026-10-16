# AdAudit Worklog

Shared handover document for all agents working on this project.

## Project
AdAudit — a SaaS that audits blogs for Google AdSense / Ezoic / Mediavine / Raptive approval readiness, shows green/orange/red findings with an approval probability, generates branded PDF reports, and ships content-writer, affiliate-writer, quick-index tools, an affiliate program with withdrawals, subscriptions with BD payment gateways, and a full admin panel at /manage/.

Stack: Next.js 16 App Router, TypeScript, Tailwind 4 + shadcn/ui, Prisma (SQLite sandbox / MySQL-ready for Hostinger), NextAuth v4 (credentials + Google + TOTP 2FA), OpenRouter AI with z-ai fallback, @react-pdf/renderer, cheerio crawler with SSRF guard.

Design language: single primary color #0d6b4d (deep emerald), no gradients, 6px radius, Open Sans (Telenor @font-face auto-activates if /public/fonts/Telenor-*.woff2 dropped in), Lucide icons (no sparkles/zap/alert icons), 2016-era flat business design. Brand assets in /public/illustrations (8 flat-vector images) and /public/logos (19 real third-party logos with graceful fallback).

## Credentials (sandbox)
- Admin: admin@adaudit.app / Admin@2024! (change from /manage/settings in production)
- Test user: test.publisher@example.com / TestPass123!
- Plans seeded: Starter $6.9/60cr, Standard $14.9/150cr, Pro $29.9/350cr, Agency $79/1000cr
- Gateways seeded: bkash/nagad/rocket/upay (manual), sslcommerz/shurjopay/aamarpay/stripe/paypal/paddle (API, disabled until admin adds keys)

---
Task ID: 1
Agent: Z.ai main
Task: Foundation — schema, deps, design system, core libs

Work Log:
- Installed @react-pdf/renderer, cheerio, otplib (v13 wrapper at lib/totp.ts), qrcode, nodemailer
- Full Prisma schema (User, Audit, Plan, Subscription, Payment, GatewayConfig, ContactMessage, BlogPost, AffiliateEarning with fromUser relation, Withdrawal, ContentJob, IndexRequest, Setting) pushed to SQLite
- globals.css design tokens (ok/warn/risk scale, dotgrid, article-body typography, CKEditor polish), layout.tsx with Open Sans + Telenor auto-activation
- lib/: password (scrypt), settings (cached + FX), prompts (master audit/writer/affiliate), ai (OpenRouter + z-ai fallback, JSON extraction, image gen), guard (SSRF), crawler (homepage + robots + sitemap + article sampling), seed, credits (atomic deduct + rate limit), auth (dynamic Google + credentials + 2FA), audit-runner, writer-runner, pdf.tsx, admin-guard, totp, use-initial-fetch

Stage Summary:
- Foundation complete. All core libs production-shaped.

---
Task ID: 2
Agent: Z.ai main
Task: Public site + auth + dashboard + audit engine + writer + indexer + billing + affiliate + admin panel + blog

Work Log:
- Public site: home (hero + mockup + features + how-it-works + 3-color anatomy + tools + pricing w/ USD-BDT toggle + blog preview + FAQ + CTA), features, how-it-works, tools, pricing, about, contact (reason dropdown -> /api/contact), terms, privacy, refund, blog list/detail
- Auth: register (terms checkbox, referral capture via ?ref= middleware cookie), login with 2FA challenge, Google button (auto-appears when admin adds OAuth keys), /suspended page
- Dashboard: shell w/ sidebar + credits pill; overview; audit workspace (domain/network/mode cards w/ costs, live progress polling, history w/ PDF links); report page (score ring, verdict, 6 sections, strengths/risks/fixes, roadmap); writer workspace (AdSense + Affiliate tabs, mode/length/image-style, internal+affiliate links, poll, article preview + HTML copy/download + SEO meta + WP publish dialog); indexer (IndexNow key file flow + verify + submit + history); affiliate (referral link, stats, withdrawals); billing (cost cards, plans, checkout w/ gateway select + manual TrxID flow, payment history); settings (profile, password, 2FA setup/enable/disable w/ QR)
- Admin /manage: separate login (admin-only verify), dashboard stats, users (search, credits, suspend, 2FA reset, admin toggle, delete), audits (all + PDF), payments (approve/reject -> credits + subscription + affiliate earning), plans CRUD, gateways (enable + instructions + API key JSON), affiliate (rate + withdrawals approve/reject/complete + commissions), messages (reply w/ optional SMTP email + close), blog (CKEditor 5 CDN classic build, cover upload, SEO fields), settings (site/AI models/prompts/costs/Google OAuth/SMTP tabs + OpenRouter key test)
- APIs: audit (start + poll + PDF + delete), writer (start + poll + delete + publish-wp with media upload), indexer (IndexNow w/ key file verification), billing, affiliate (withdraw w/ ledger consumption), settings (profile/password), 2fa setup/enable/disable, contact, upload (2.5MB allowlist), admin/* (guard via requireAdmin)
- PDF: 3-page branded report (cover w/ score + verdict + meta, findings w/ color-coded items, strengths/risks/fixes/roadmap + disclaimer), Helvetica, A4, page numbers

Fixes during build (root causes found and resolved):
- otplib v13 API change -> lib/totp.ts wrapper (generateSecret/generateURI/verifySync)
- getServerSession() without options -> central auth() helper in lib/auth.ts used everywhere
- next-auth/react SessionProvider lacks "use client" in v4 -> wrapper at components/session-provider.tsx
- react-hooks/set-state-in-effect lint -> useInitialFetch hook (deferred macrotask) across all managers
- rich-editor ref-during-render -> useEffect sync
- Literal-IP SSRF gap in audit API -> regex block + assertPublicUrl up front (crawl runner also enforces)
- JWEDecryptionFailed + missing /api/billing and /api/writer/[id] routes (lost to dir errors) -> recreated and verified end-to-end

Verified end-to-end (curl + browser):
- Register -> login -> audit waitbutwhy.com: DONE, 85% APPLY_NOW, 6 evidence-based sections, 202 pages, 3 articles sampled, WordPress detected
- Audit of dead domain: honest HIGH_RISK report (crawl failure surfaced, credits refunded)
- PDF: 5-page A4 branded report downloads correctly
- Payment: bkash manual order -> admin approve -> credits 5 -> 155, subscription + affiliate earning rows created
- Writer: snake-plant article DONE, 1520 words, 3 AI images in /public/generated
- Browser QA: home desktop/mobile (iPhone 14), report desktop/mobile, login, admin — all render cleanly, no overflow/overlap
- Security: SSRF rejects localhost/private IPs, unauth admin API 401, rate limits on auth/audit/writer/contact/checkout/withdraw, scrypt hashes, security headers in next.config, poweredByHeader off

Stage Summary:
- Full platform operational in sandbox. Dev server on :3000. Next agent should: add premium API gateway implementations (Stripe/SSLCommerz checkout sessions) when admin keys exist, moderation niceties, and further UI polish.
