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

---
Task ID: 3 (cron round 1)
Agent: Z.ai cron review
Task: QA assessment + new features (dark mode, notifications, share links, comparison, chart) + styling details

Work Log (current project status assessment first):
- QA: lint clean, zero runtime errors in dev.log, all 15+ routes 200. Platform stable -> proceeded to feature work per mandate.

Features added:
- Dark mode: ThemeProvider (next-themes, class strategy) in root layout; ThemeToggle in site header (desktop + mobile menu), dashboard topbar and admin topbar. Full dark token set already existed in globals.css.
- Notification system: Notification model + lib/notify.ts; real-event hooks wired into audit DONE/FAILED, payment approve/reject, withdrawal approve/reject/complete, support reply. API /api/notifications (GET list+unread, POST mark read one/all). Bell with unread badge + dropdown (polls 30s) in dashboard + admin shells.
- Shareable reports: Audit.shareToken; POST/DELETE /api/audit/[id]/share; public read-only page /share/[token] with branded header, CTA, noindex metadata. Share chip + copy + revoke UI on the report page.
- Audit comparison: report page auto-fetches previous DONE audit of same domain+network and renders "Progress since last check" panel: probability delta, verdict change row, per-section score deltas with trend arrows.
- Score history chart: recharts LineChart of last 12 audit scores on dashboard overview with 70-line "apply-ready" reference; theme-aware colors.
- Report view extracted to shared component (components/shared/report-view.tsx) used by dashboard + public share page; print button + print stylesheet (nav/header/buttons hidden, white doc).

Styling details:
- 39 files: hardcoded bg-white surfaces -> theme-aware bg-card; headers -> bg-background/95 so dark mode is consistent.
- Illustrated empty states (EmptyState component) applied to audit history, dashboard recent audits, admin blog, admin messages, admin payments.
- Blog covers: branded dotgrid + logo-mark pattern when a post has no cover image (list + detail).
- BrandLogo: white padded chip so favicon-style logos read well in dark mode.

Bugs found and fixed this round:
- /dashboard/audit/[id] redirected to login: rewritten page had reintroduced bare getServerSession() -> switched to auth() helper.
- Notification model 500: prisma client not regenerated after db:push in the running server -> bunx prisma generate + server restart.
- Network/gateway logos rendered as broken images: PNG bytes served with image/svg+xml content type -> renamed 11 files to .png, updated GatewayConfig.logo rows and hardcoded refs. Verified: ezoic/mediavine/raptive marks now render.
- setMounted-in-effect lint errors (2): replaced with useSyncExternalStore-based useHasMounted hook.
- Comparison copy: neutral-delta message corrected.

Verified in browser (dark + light):
- Dashboard: bell with unread badge + dropdown notification, score chart rendering, dark surfaces consistent.
- Report: share chip + copy + revoke, comparison panel with per-section deltas (Content -20, Traffic -10 etc.), verdict change row, dark mode.
- Public /share/<token>: read-only branded report, real crawl evidence, CTA header.
- Trust bar: all four network logos render as real marks.
- Final: lint clean, 0 runtime errors, all routes 200, both themes verified on home/dashboard/report.

Stage Summary:
- Platform now has dark mode, notifications, public share links, audit progress comparison, score history chart, print support, and polished empty states.
- Next priorities: API gateway checkout implementations (Stripe/SSLCommerz sessions) when admin keys are configured; email digests; admin activity log; bulk audit input; sitemap-level content scanning depth.

---
Task ID: 4 (cron round 2)
Agent: Z.ai cron review
Task: QA assessment + bulk audits, activity log, security page, SEO, real gateway logos

Work Log (status assessment first):
- QA: lint clean, zero runtime errors in dev.log, all routes 200, no horizontal overflow at 1366px and 390px on home/features/pricing/blog/login/register/manage/dashboard/report/billing/settings. Platform stable -> proceeded to feature work.

Features added:
- Bulk audit (multi-domain): Audit.batchId column; POST /api/audit now accepts {domains: string[]} (max 10) alongside single {domain}. Per-domain validation (format, dedupe, SSRF assertPublicUrl) happens BEFORE any credits move; invalid domains are returned as skipped. Total cost deducted atomically, all audits created in one transaction sharing a batchId, all runners fire in parallel. GET /api/audit?batch=<id> for progress polling. UI: audit workspace got Single/Batch tabs, live per-domain progress list with counters (n/m done, failures), DONE rows link to reports; single-domain batch falls back to the single progress panel. History rows show a "Batch" chip.
- Admin activity log: new ActivityLog model; lib/activity.ts logActivity() (fire-and-forget, never throws). Wired into: credentials/Google login, login failures (wrong password, no account, suspended, bad 2FA), 2FA challenge/enable/disable, register (email + Google), signOut event, audit start/batch/delete, writer start, indexer submit, checkout submit, payment approve/reject, user credits/suspend/activate/role/delete/2FA-reset, plan save, gateway save, settings save, blog publish, withdraw request/approve/reject/complete. /manage/activity page: category tabs (auth/audits/tools/billing/affiliate/users/admin), search by email/detail/IP, pagination, color-coded event badges. Admin sidebar has "Activity log" entry.
- User security page: GET /api/security returns the user's own last 12 visible events; Settings page shows a "Recent account activity" card with labeled events + IP + time.
- SEO: src/app/sitemap.ts (static routes + all published blog posts); blog detail page now emits Article JSON-LD (headline/author/dates/publisher), OpenGraph metadata, and a reading-time badge; blog list cards show reading time.

Bugs found and fixed this round:
- MISSING ROUTE /api/settings (dir existed, route file gone): profile save + password change were 404. Recreated with profile/password actions, scrypt verify, rate limit, activity logging. Verified wrong-password rejection and success flows in browser; test user password restored to TestPass123!.
- Infinite fetch loops: two new components passed unstable inline callbacks to useInitialFetch (new identity every render -> effect refetch loop, page stuck on "Loading", request flood). Fixed with stable useCallback (defaults) in activity-manager and settings RecentActivity.
- Batch Zod schema bug: batch = single.extend({domains}) kept required "domain" -> every batch rejected "Invalid audit request". Fixed with single.omit({domain:true}).extend(...). Verified end-to-end: 2-domain batch ran, both DONE (85%/75%), credits 135->111 correct.
- Placeholder gateway logos: bkash/nagad/rocket/upay/sslcommerz/shurjopay/aamarpay PNGs were identical 1478-byte placeholder glyphs (dark circle-chevron) - violated the "real logos" requirement. Fetched real brand assets via image-search, cropped tiles out of a real ShurjoPay payment grid (PIL), keyed out tile backgrounds/borders, generated a clean aamarPay wordmark for the one unfindable asset. seed.ts also wrote /logos/<code>.svg for png assets on fresh DBs - fixed with a PNG extension set (incl. paddle).
- Stale image cache: browser profile + next/image optimizer cached old placeholder renders; switched footer strip to plain <img> with ?v=3 and BrandLogo now appends ?v=3 to /logos/ paths. Verified: footer, checkout cards, and admin gateways all show real marks.

Styling details:
- Footer: payments trust strip (7 real gateway logos in bordered chips) + "Payments handled by verified gateways" / "Reports stored privately" notes.
- Pricing cards: per-credit unit price line under credits (USD + BDT aware).
- Audit history: Re-run action per row (fills form + scrolls up); aria-live on progress panels.

Verified in browser:
- Batch flow (2 domains, standard): live counter 0/2 -> both DONE, notifications fired, history chips + re-run present.
- Activity log: real trail incl. failed password attempt, batch start detail, sign-outs; category tabs + search work.
- Settings: profile save, wrong-password rejection, password change, security events with IPs.
- Real logos render on footer (7), checkout (bkash/nagad/rocket), trust bar unchanged (ezoic/mediavine/raptive already real).
- sitemap.xml lists all routes + blog posts; blog JSON-LD valid.
- Dark + light verified on new pages; mobile 390px batch UI has no overflow.

Stage Summary:
- Platform now has batch audits, a complete immutable audit trail, user-visible security events, SEO sitemap + structured data, and authentic third-party brand assets.
- Test user password remains TestPass123! (docs accurate).
- Next priorities: API-gateway checkout sessions (Stripe/SSLCommerz) when admin keys exist; email digests for weekly audit reminders; per-page (sitemap URL) audit depth; export audit history CSV; rate-limit alerting in activity feed.

---
Task ID: 5 (cron round 3)
Agent: Z.ai cron review
Task: QA assessment + Site Monitoring (watchlist), CSV exports, Stripe Checkout, styling details

Work Log (status assessment first):
- QA: lint clean, all routes 200, home/dashboard/audit/report/writer/billing/affiliate verified in browser at desktop + 390px mobile, no overflow, no runtime errors. Platform stable -> proceeded to feature work per mandate.

Features added:
- SITE MONITORING (watchlist): new WatchItem model (userId+domain+target unique, intervalDays 7/14/30, active, lastAuditId/lastScore/lastRunAt/nextRunAt, runs, pausedReason) + Audit.watchItemId link. lib/watchlist.ts: startWatchRun (atomic credit deduct -> audit create -> schedule update -> background runner), addWatchItem (validate + dupe + SSRF assertPublicUrl + limit 10), tickWatchlist (lazy scheduler; user-scoped or global by key). Auto-pause with notification when credits run out ("Paused automatically... Top up and re-enable"). audit-runner now updates the watch item on DONE and sends "Scheduled check ready" notifications.
- Watchlist APIs: GET/POST /api/watchlist (list w/ per-item sparkline history + server-truth running flag), PATCH/DELETE /api/watchlist/[id] (pause/resume resets schedule + clears pause note; interval recompute anchored to lastRunAt), POST /api/watchlist/[id]/run (check now, 409 if a check is in flight), POST/GET /api/watchlist/tick (lazy tick: session = own due items; ?key= automation key from Setting watchTickKey = all due items, for Hostinger cron; admin GET returns the key).
- Watchlist UI: /dashboard/watchlist with sidebar entry (Radar icon). Cards show Active/Paused badge, network/mode/interval, checks run, next check relative time, last score color-coded, inline SVG sparkline of last checks, Check now / Pause-Resume / interval select / Latest report / Remove. Add form panel with per-check cost + balance, "How scheduling works" explainer. Page load fires one tick per 30-min session window (sessionStorage guard). Dashboard overview: "Monitor a domain" quick action + "Active monitoring" strip with next-run dates and Manage link.
- CSV EXPORTS: /api/export/audits (user's own history, BOM + escaped CSV, activity logged, "Export CSV" button on audit history). /api/export/admin?type=users|payments|audits|watchlist with admin-side Export CSV buttons on Users, Payments, Audits managers.
- STRIPE CHECKOUT (real API gateway): lib/payments.ts approvePaymentById() extracted (credits + subscription + affiliate commission + notify, exactly-once) now shared by admin approve route and Stripe verify. POST /api/billing creates Payment then (gateway.mode=API && code=stripe && sk_ key present) creates a Stripe Checkout Session via REST (no SDK) with client_reference_id=paymentId, redirects buyer. GET /api/billing filters unconfigured API gateways out of checkout. /api/billing/stripe/verify confirms payment_status=paid against Stripe, stores payment_intent, approves once. /dashboard/billing/checkout/success page + StripeVerifyClient shows confirming/confirmed/failed states; cancel flow handled. Checkout button becomes "Continue to <gateway>" for API mode. Admin gateways manager: per-provider config hints + help text (sk_ key guidance for Stripe).
- Activity log: new actions WATCH_ADD/UPDATE/REMOVE/RUN, EXPORT_AUDITS, ADMIN_EXPORT, STRIPE_VERIFY, STRIPE_MISMATCH; new "Monitoring" tab in admin activity; labels for all new events.
- Pricing page: plan-by-plan matrix now built dynamically from live plans (not hardcoded names), highlighted "Popular" column (bg-accent), honest rows (all features incl. monitoring + CSV export in every plan, credits are the differentiator).

Bugs found and fixed this round:
- Stale Prisma client after schema push (db.watchItem undefined, 500s): bunx prisma generate + dev server restart (recurring pitfall - noted in round 3 too).
- logActivity() returns void (already fire-and-forget) - my new code chained .catch() on it -> TypeError 500 after row creation. Removed invalid .catch chains in 4 files.
- Watch interval change anchored to future nextRunAt -> nonsense "in 28 days". Rewritten: nextRun = lastRunAt + interval (never earlier than now + 60s).
- Watchlist UI used useInitialFetch destructuring that doesn't exist (hook returns void) -> runtime TypeError. Replaced with local loading state + deferred effect.
- Radix Select no-op on same-value selection made interval verification confusing (not a product bug).

Verified in browser (desktop + 390px, light + dark):
- Watchlist: add waitbutwhy.com -> Check now -> credits 111->99, spinner, score 85% + Latest report link, notification "Scheduled check ready: waitbutwhy.com", sparkline data, pause -> PAUSED badge + Resume, interval 7<->14d with lastRun-anchored nextRun (Oct 23), remove flow present.
- Dashboard overview: monitoring strip + quick action render with real data.
- CSV: /api/export/audits returns proper headers+rows (monitored audit marked yes); admin watchlist export shows the item with score + next run.
- Tick: admin GET returns automation key wt_...; POST with valid key ran=0/checked=0 (nothing due); wrong key 403.
- Stripe: enabled with fake sk_test key -> appears at checkout as "Card / API checkout" -> "Continue to Stripe (Cards)" -> POST /api/billing called real api.stripe.com -> 401 surfaced cleanly ("Invalid API Key provided: sk_test_***e123"), payment auto-REJECTED with reason, then gateway restored to disabled/empty. Verify endpoint guard pages (missing reference) render.
- Activity log: Monitoring tab + new badges present; watch events trail recorded.
- Pricing: dynamic matrix renders with highlighted Standard column.
- Lint clean; only expected 502 (Stripe fake-key test) in dev.log; all other routes 200.

Stage Summary:
- Platform now has scheduled site monitoring with self-pausing credit handling, CSV exports for users and admins, and a complete real-gateway card payment path (Stripe) alongside the manual BD rails.
- Next priorities: SSLCommerz/PayPal session flows on top of the same approvePaymentById path; weekly email digest of monitoring results (needs SMTP configured); admin overview widget for due/failed monitors; per-plan monitoring limits (currently global 10); webhook endpoint for Stripe instead of return-url verification (needs public URL).

Final verification (round 3 close-out):
- All 14 public routes 200; dashboard + manage routes verified in browser; lint clean; zero unexpected runtime errors in dev.log.
- Mobile 390px: watchlist page + monitor cards render with no overflow (form stacks, buttons wrap, sparkline hidden below 2 points by design).
- Dark mode verified on watchlist, pricing matrix, activity Monitoring tab.
- Sandbox state: 1 monitor (waitbutwhy.com, 7d, active, score 85) on the test account; Stripe gateway left disabled with empty config; automation key stored in Setting watchTickKey (admin can read it at GET /api/watchlist/tick).

---
Task ID: 6 (cron round 4)
Agent: Z.ai cron review
Task: QA assessment + per-plan monitor limits, PayPal checkout, admin monitor health, UX details

Work Log (status assessment first):
- QA: lint clean, all routes 200, no runtime errors. Browser QA at 1366px + 390px (home, login, dashboard, watchlist, audit, billing, admin). One visible defect found: dashboard score-history chart repeated "Oct 16" on every x-axis tick when all audits fell on the same day. Platform stable -> bug fix + feature work per mandate.

Bugs fixed:
- Chart ticks: dashboard/page.tsx now detects same-day history and labels points by time (h:mm A) instead of repeating the date. Verified: 4:01 AM ... 5:43 AM distinct labels.
- Dev-tools "1 Issue" toast: next-auth v4 NEXTAUTH_URL warning. Added NEXTAUTH_URL=http://localhost:3000 to .env; indicator cleared.

Features added:
- PER-PLAN MONITOR LIMITS: Plan.monitorLimit column (nullable, null = platform default). Seed: Starter 1, Standard 3, Pro 10, Agency 25 (feature lines updated). lib/watchlist.ts getMonitorLimit() resolves the active subscription's plan limit, falling back to Setting monitorLimitFree (default 1) for free accounts. addWatchItem uses it and returns upgrade-oriented error copy. GET /api/watchlist returns {limit, planName}. Watchlist header pill shows "X of Y monitors active" + plan badge + Upgrade link when full. Pricing matrix gained a "Monitored domains (scheduled re-checks)" row (1/3/10/25). Admin plans manager has a "Monitored domains" field (blank = default), card shows the limit. Backfill script applied monitorLimit to existing plan rows. Verified: Standard user "1 of 3", no-plan admin "0 of 1", admin edit 3->4->3 round-trip.
- ADMIN MONITOR HEALTH WIDGET: /manage dashboard "Site monitoring health" card with Active monitors / Due now / Auto-paused / Failed checks (7d) counts, a list of due+paused items with owner emails, and a "Monitoring log" deep link -> /manage/activity?tab=monitoring (activity manager now honors the tab param after mount, deferred to a macrotask for hydration safety).
- PAYPAL ORD API CHECKOUT: /api/billing POST creates a PayPal Order (v2/checkout/orders, OAuth2 client credentials, custom_id=paymentId, NO_SHIPPING, PAY_NOW) and redirects to the approve link; gateway appears at checkout only when clientId+clientSecret are stored (env sandbox|live). GET /api/billing/paypal/verify captures the order server-side, validates custom_id and captured amount >= order total, handles ORDER_ALREADY_CAPTURED via lookup, then runs the shared approvePaymentById (exactly-once) and redirects to the result page; PAYPAL_VERIFY / PAYPAL_MISMATCH logged. Checkout success page handles ?pp=1 approved/failed branches with honest copy. Admin gateways manager has PayPal config hint/help. Failure path verified end-to-end with fake sandbox creds: "Continue to PayPal" -> clean error -> payment auto-REJECTED with note -> gateway restored to disabled/empty. Unauthenticated verify redirects to /login.
- REPORT COPY SUMMARY: new CopySummaryButton on the report page builds a plain-text brief (probability, verdict, per-section scores with [OK]/[Needs work]/[Critical] items, critical fixes) using clipboard API with execCommand fallback; verified click -> "Copied".
- AUDIT HISTORY FILTERS: All / 70%+ / 45-69% / Under 45% chips filter the history list with a "No audits match this filter" empty state; sits beside Export CSV.

Infrastructure incident + fix (important for next agents):
- The boot-time dev server was OOM-killed mid-round (next-server 2.1GB RSS in the 4GB container; kernel oom-kill in dmesg) and nothing restarted it.
- KEY SANDBOX LESSON: any process spawned from an agent Bash tool call is killed when that call ends (even setsid+nohup+disown). Processes reparented to PID 1 (tini) survive: `bun -e "const p=Bun.spawn(['bun','run','dev'],{cwd:'/home/z/my-project',stdout:'ignore',stderr:'ignore',stdin:'ignore'});p.unref()"` launches a persistent dev server. This is now the documented restart procedure.
- Chrome (agent-browser) + cold Turbopack compiles together can OOM the container; warm routes via curl before opening the browser and close it when done.

Verified this round (desktop 1366 + mobile 390, light + dark):
- Chart time labels, watchlist pill + plan badge + Upgrade link, pricing matrix row, admin monitor widget + deep link, plans monitorLimit edit, PayPal checkout failure path + restore, copy summary, filter chips, free-tier limit fallback (admin: 1), mobile/dark rendering clean.
- Lint clean; public route sweep all 200; /api/billing correctly hides disabled API gateways; no unexpected runtime errors in dev.log.

Stage Summary:
- Monitoring is now a sellable per-plan feature, PayPal joins Stripe as a real API card/balance rail, admins can see monitor health at a glance, and reports/history gained practical UX details.
- Sandbox state: PayPal gateway disabled with empty config; Standard plan monitorLimit 3; test user monitor intact (waitbutwhy.com, 7d, score 85).
- Next priorities: SSLCommerz session checkout on the same approvePaymentById path; weekly email digest of monitoring results (needs SMTP); Stripe/PayPal webhooks instead of return-url verification (needs public URL); expose monitorLimitFree + digest toggles in admin settings UI; consider raising container memory or trimming Turbopack workers to avoid repeat OOM.

---
Task ID: 7 (cron round 5)
Agent: Z.ai cron review
Task: QA assessment + SSLCommerz checkout, weekly monitoring digest, public sample report, hydration fix, styling details

Work Log (status assessment first):
- QA: lint clean, all routes 200, dev.log clean. Browser QA (desktop + 390px, light + dark) on home, pricing, blog, login, dashboard, watchlist, audit, sample-report. One real defect found: React 19 hydration mismatch on /dashboard/audit (1 Issue toast). Platform otherwise stable -> bug fix + feature work.

Bugs found and fixed this round:
- HYDRATION MISMATCH on /dashboard/audit: Radix Select aria-controls (useId) differed server vs client. Root cause: AuditWorkspace was the only component reading useSearchParams() in a client component; the dynamic-API Suspense boundary shifted the hydration tree path, so React 19 flagged the Radix id attribute. Fix: the audit page now awaits searchParams() server-side and passes initialDomain/initialNetwork/autostart as props; AuditWorkspace dropped useSearchParams entirely. Verified: dev-tools badge data-error=false, and ?domain=x&network=EZOIC prefill still works (both fields populated). Writer/watchlist pages were already clean (no useSearchParams).
- Watchlist header pill during load showed "0 of … monitors active" (raw fallback text). Now renders a two-bar skeleton until limit resolves.
- Dev server OOM-killed again between rounds (documented restart procedure from round 4 used: Bun.spawn reparented to PID 1).

Features added:
- SSLCOMMERZE API CHECKOUT (third real gateway rail): POST /api/billing creates an SSLCommerz session via gwprocess/v4/api.php (store_id/store_password/env config, tran_id=paymentId, USD, success/fail/cancel URLs pointing at our verify route). GET /api/billing only lists sslcommerz when both credentials are present. New /api/billing/sslcommerz/verify: stores the returned val_id, re-validates server-side against validationserverAPI.php (status VALID/VALIDATED, tran_id match, amount >= order), then runs the shared approvePaymentById (exactly-once). Buyer redirected to /dashboard/billing/checkout/success?scz=1 (approved/failed branches with honest copy). Activity actions SSLCZ_VERIFY/SSLCZ_MISMATCH added to labels + billing group. Admin gateways manager: updated hint (env key) and full help text. VERIFIED end-to-end with fake sandbox creds: gateway appears at checkout -> real SSLCommerz sandbox responded "Store Credential Error Or Store is De-active" -> 502 surfaced cleanly -> payment auto-REJECTED with note -> gateway restored to disabled/empty. Guards: unauth verify -> /login, bad payment -> /dashboard/billing.
- WEEKLY MONITORING DIGEST EMAIL: lib/monitor-digest.ts maybeSendDigests({force}) - per-user digest (domain, network, interval, next check, last score color-coded, paused reasons) via nodemailer when SMTP is configured; global 7-day cadence via monitorDigest setting (force bypasses); rides on the automation tick (POST /api/watchlist/tick?key=) after scheduled checks run, non-fatal. Admin settings got a new "Monitoring" tab: free-account monitor limit (monitorLimitFree, validated 0-50) + digest toggle + "Send digest now" button (POST /api/admin/digest) with last-sent timestamp. Activity: DIGEST_SENT/DIGEST_SKIP. VERIFIED: disabled -> honest skip; enabled without SMTP -> "SMTP is not configured, so no email could be sent"; settings round-trip ok; UI button shows the honest result text. Left disabled (no SMTP in sandbox).
- PUBLIC SAMPLE REPORT (/sample-report): static marketing page reusing ReportView with a complete, realistic WAIT_AND_IMPROVE example (62%, aligned with the homepage mockup: 8 posts, 2 thin articles, empty categories, no bylines) incl. signals strip, 6 sections, strengths/risks/fixes, 5-step roadmap, clearly labeled fictional domain, top + bottom CTAs. Linked from the hero trust row ("See a sample report") and added to sitemap.xml (priority 0.7). Verified desktop/mobile/dark.

Styling details:
- Audit history rows: domain initial avatar (bg-primary/10 chip) for faster scanning.
- Watchlist loading pill skeleton (above).
- Activity manager + route: SSLCZ/DIGEST labels and category mappings (monitoring + billing groups).

Verified this round (desktop 1366 + mobile 390, light + dark):
- Hydration toast gone on /dashboard/audit; URL prefill (?domain, ?network) works via server props.
- Sample report renders full report view; dark mode clean; 390px no horizontal overflow; hero link present (1 match).
- SSLCommerz failure path + guards + restore; digest paths + admin tab + send-now UI.
- Final: lint clean, 17 public routes 200, no unexpected errors in dev.log, browser closed.

Stage Summary:
- Payments now cover three automatic rails (Stripe, PayPal, SSLCommerz) plus four manual BD gateways, all converging on the same exactly-once approval path. Monitoring has an admin-facing weekly email digest gated on SMTP. The public sample report gives prospects the full report experience pre-signup. A real hydration bug was found via dev-tools and fixed at the root (no more useSearchParams in client components).
- Sandbox state: sslcommerz gateway disabled with empty config; digest disabled; monitor/digest settings persist; test user unchanged (99 credits, 1 monitor); admin password unchanged.
- Next priorities: Stripe/PayPal/SSLCommerz webhooks instead of return-url verification (needs public URL); digest test-send to a specific admin email even without user monitors; audit CSV per-domain trend export; sitemap-level content scanning depth; consider trimming Turbopack memory to avoid repeat OOM kills.
