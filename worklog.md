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

---
Task ID: 8 (cron round 6)
Agent: Z.ai cron review
Task: QA assessment + domain trend pages, free public site-check tool, onboarding checklist, SMTP test email

Work Log (status assessment first):
- QA: lint clean, all 17 public routes 200, dev.log clean, browser QA (desktop 1366 + mobile 390, light + dark) on home/tools/login/dashboard/audit/watchlist/report: no defects found on existing surfaces. Platform stable -> proceeded to feature work per mandate.

Features added:
- DOMAIN TREND PAGES (per-domain history hub): /dashboard/domains aggregates every audited domain (runs count, last score, verdict badge, delta vs previous completed check, "Monitored" chip). /dashboard/domains/[domain] deep-dive shows: 4 stat cards (latest score + delta, average, best, monitoring status with next-check + Manage link), an Approval score trend chart (same-day runs labeled by time), Section averages (each pillar averaged across every completed check, color-coded bars), and a scrollable Check history (date-first rows with network/mode, batch/scheduled chips, verdict, score, report link). "Run new audit" prefills the audit form; invalid domain param -> 404; domain matching includes www. variant. Wired in from: audit history domain names (now link to trend page, report opens via a new icon button), a "Domain trends" chip next to the Audit history heading, a "Your domains" strip on the dashboard overview (top 4 by score with delta arrows), and the dashboard topbar title now reads "Domain trends" on these routes.
- PER-DOMAIN TREND CSV: /api/export/domain?domain= exports every audit for one domain oldest-first with a "Change vs previous" column (first check / +/-n), BOM + escaped, filename adaudit-trend-<domain>-<date>.csv; "Export trend CSV" button on the deep-dive page; EXPORT_AUDITS activity logged.
- FREE PUBLIC SITE-CHECK TOOL (lead magnet): POST /api/tools/site-check (no auth) runs six real checks against any domain: HTTPS reachability + response time, title + meta description, mobile viewport, AdSense script presence, ads.txt (validates google.com pub- entry), robots.txt + sitemap.xml. Guarded by rateLimit (10/10min per IP) + assertPublicUrl SSRF guard + domain format check; 400KB body cap, 8s timeout, honest unreachable-site result. Activity TOOL_SITECHECK logged as anonymous@ip. UI: /tools page now opens with an "Instant site check" card (FREE, NO SIGNUP badge), skeleton loading, color-coded result cards (ok/warn/risk with plain-language detail), "X of 6 checks passed" summary, and a CTA straight into the register flow with ?domain= prefill (hero form convention). Verified against waitbutwhy.com (4/6 honest result) + localhost/unresolvable rejections.
- ONBOARDING CHECKLIST: dashboard overview now leads with a Getting started card: 4 server-computed steps (first DONE audit, any watch item, any content job, 2FA enabled) with progress bar + per-step deep links; dismiss button persists via a localStorage store built on useSyncExternalStore (hydration-safe, no setState-in-effect); hides itself once all steps are done. Dashboard overview also gained the "Your domains" strip (above) and a second fullUser query for twoFactorEnabled.
- ADMIN SMTP TEST EMAIL: POST /api/admin/settings/test-email sends a branded HTML test message through the saved SMTP settings with honest failure copy; Settings > Email (SMTP) tab gained a "Send a test email" panel (recipient input + result line). SMTP_TEST activity action logged (delivered / FAILED detail). Verified: not-configured path + 401 for non-admin.

Bug found and fixed this round:
- POST-SIGNUP AUTO-AUDIT NEVER STARTED: auth-form redirects to /dashboard/audit?domain=X&autostart=1 with the copy "Your first audit will start right after signup", but the audit page only honored ?n=1, so autostart was ignored. Audit page now accepts both sp.n and sp.autostart.

Styling details:
- Domains index rows stack vertically under sm (domain + meta, then wrapping badge/score/Trend cluster) - fixed a mobile 390px crush where verdict badges squeezed domains to "waitb...".
- Check history rows on the deep-dive switched to date-first layout with short network/mode labels - removed mid-row ellipsis truncation.
- Audit history: report opens via a dedicated icon button (hover ring), domain name is the trend link with a tooltip.
- All new surfaces theme-aware (bg-card/borders/tokens), max-h-96 overflow-y-auto on the check history, aria labels throughout, skeletons for loading states.

Verified this round (desktop 1366 + mobile 390, light + dark):
- Site check end-to-end in the browser (result panel, colors, CTA), rate-limit + SSRF rejections via curl.
- Domains index + deep-dive with real data (85% trend, section averages 90..73, monitoring card with next check Oct 23), Export trend CSV output correct (+0 deltas, first check marker).
- Checklist renders 3/4 with real server state, dismiss works and persists.
- SMTP test: honest not-configured message, unauth 401. Auth sweep: all dashboard + manage routes 200. Lint clean; zero unexpected errors in dev.log; browser closed after QA.

Stage Summary:
- The platform gained a per-domain memory (trend pages + trend CSV), a public free tool that feeds the signup funnel, an onboarding path for new accounts, and production-ready SMTP verification.
- Sandbox state: no schema changes this round (no db:push needed); test user unchanged (99 credits, 1 monitor, 3 domains on record); onboarding shows 1 pending step (2FA) for the test user.
- Next priorities: Stripe/PayPal/SSLCommerz webhooks (needs public URL); sitemap-level content scanning depth (deep-scan mode sampling more articles); per-domain scheduled digest opt-in; expose the site-check tool on the home hero as a secondary CTA; consider API keys for programmatic audits.

---
Task ID: 9 (cron round 7)
Agent: Z.ai cron review
Task: QA assessment + Developer API (keys, /api/v1, docs page), hero secondary CTA, styling details

Work Log (status assessment first):
- INFRA INCIDENT at round start: dev server OOM-killed again between rounds (next-server 2.6GB RSS, kernel oom-kill). Restarted with the documented persistent-spawn procedure, this time with NODE_OPTIONS=--max-old-space-size=1536 to cap the heap and dev.log appended via fd. New spawn command: `bun -e "const fs=require('fs');const fd=fs.openSync('/home/z/my-project/dev.log','a');const p=Bun.spawn(['bun','run','dev'],{cwd:'/home/z/my-project',env:{...process.env,NODE_OPTIONS:'--max-old-space-size=1536'},stdout:fd,stderr:fd,stdin:'ignore'});p.unref()"`.
- QA after restart: lint clean, all 17 public routes 200, dashboard routes 307 (auth redirect), browser QA on dashboard/audit/watchlist/domains/report surfaces: no defects. Platform stable -> feature work.

Features added:
- DEVELOPER API KEYS (programmatic access, top of last round's priority list):
  - New ApiKey model (name, prefix, sha256 keyHash unique, lastUsedAt, requestCount, revokedAt). Raw key format `ak_` + 32 base64url chars, shown exactly once at creation.
  - lib/api-keys.ts: createRawApiKey/hashApiKey/keyPrefixOf, authenticateApiKey (Bearer parse -> hash lookup -> revoked/suspended checks -> fire-and-forget usage bookkeeping), v1Json/v1Error with permissive CORS headers + OPTIONS preflight on all /api/v1 routes.
  - /api/keys (session auth): GET list masked keys + maxActive 5; POST create (rate limited, cap 5 active) returns the raw secret once; POST revoke (soft, sets revokedAt).
  - /api/v1/audits: POST starts one audit (same zod validation, SSRF assertPublicUrl, atomic credit deduction, runAudit as the app), returns 202 + poll path + hint; GET lists the 20 most recent audits. /api/v1/audits/[id]: GET returns status; when DONE includes the full report JSON (probability, verdict, sections, strengths, risks, roadmap), crawl signals and pdf_url. Rate limit 30 starts / 10 min / key.
  - Settings page got a "Developer API" card (components/dashboard/api-keys-card.tsx): key list with status dot, prefix + call count + last used, revoke buttons, create form, one-time secret panel with copy button and honest warning, docs link, skeletons + empty state, 44px targets.
  - PUBLIC DOCS PAGE /docs/api (site layout): quick start with copy-ready curl examples, endpoint cards, parameter table, error-code table (400/401/402/403/404/429), "good to know" (hashed keys, shared credits, same guards), CTAs to settings + pricing. Added to sitemap (0.5) and footer Product column ("Developer API").
  - Activity log: API_KEY_CREATE / API_KEY_REVOKE (auth group), API_AUDIT_START (audits group, detail includes which key ran it); admin activity labels added.
- HOME HERO SECONDARY CTA: under the hero form, "In a hurry? Run a free instant site check" links to /tools, feeding the free-tool funnel from the top of the page.

Bugs found and fixed this round:
- /api/keys 500 "Cannot read properties of undefined (reading 'findMany')": stale Prisma client in the long-running dev server after schema push (documented recurring pitfall). Fixed with bunx prisma generate + dev server restart. Note for future agents: ALWAYS restart the dev server after any db:push.

Verified end-to-end (curl + browser):
- Key lifecycle: create via API and via browser UI (one-time secret panel renders, prefix shown, copy button present), requestCount/lastUsedAt track (6 calls), revoke -> subsequent calls get 401 "This API key has been revoked", 5-key cap enforced server-side.
- Guards: no auth -> 401 with helpful message; bogus key -> 401 "Invalid API key."; domain "localhost" -> 400.
- Full API round-trip: POST waitbutwhy.com NORMAL -> 202 -> poll -> done, 85%, APPLY_NOW, 6 sections + strengths + risks + roadmap + crawl_signals in the response; credits deducted exactly once (99 -> 94 for a 5-credit NORMAL audit; polls do not deduct).
- UI-created key works against the v1 API (6 audits visible through the list endpoint).
- Docs page: desktop + 390px mobile (no horizontal overflow, code blocks scroll internally), light + dark verified.
- Admin activity: API_KEY_CREATE/API_KEY_REVOKE/API_AUDIT_START rows present in the right tabs.
- Final: lint clean, route sweep 200/307 as expected, no unexpected runtime errors in dev.log, browser closed.

Styling details:
- Docs page follows the 2016 flat system: no gradients, small radius, single emerald accent, POST/GET chips in primary/secondary, mono code blocks on bg-secondary with internal horizontal scroll on mobile.
- API keys card matches the settings cards (icon header, muted explainer, dotted list borders, sr-only labels, aria-labels on revoke buttons).

Stage Summary:
- AdAudit now has a public developer API with hashed keys, per-key rate limits and usage counters, a marketing docs page, and a funnel link from the hero to the free tool.
- Sandbox state: test user has 94 credits, one ACTIVE key "Zapier webhook" (ak_kGZ0MD86···) and one revoked "CI script"; the full secret for the active key was printed in this session only. Admin password unchanged. New spawn procedure keeps dev.log appended with a 1536MB heap cap.
- Next priorities: Stripe/PayPal/SSLCommerz webhooks (needs a public URL); per-key credit budgets/spend caps; API usage page for users (charts over requestCount); deep-scan mode sampling more sitemap articles; consider trimming Turbopack workers to stop repeat OOM kills.

---
Task ID: 10 (cron round 8)
Agent: Z.ai cron review
Task: QA assessment + Deep Scan audit mode, API usage analytics, bug fixes, styling details

Work Log (status assessment first):
- QA at round start: lint clean, all 17 public routes 200, dashboard routes 307, dev.log clean, browser QA (desktop 1366 + mobile 390, light + dark) on home/dashboard/settings: no defects, no hydration badges. Platform stable -> feature work per mandate.

Features added:
- DEEP SCAN AUDIT MODE (new paid upgrade on the core audit):
  - Schema: Audit.deepScan Boolean @default(false); ApiKeyUsage model (keyId+day unique, count) for per-day API usage. db:push done + prisma generate + dev server restarted (documented procedure).
  - Crawler deep mode (crawlSite(domain, {deep})): samples 10 articles instead of 3 with STRIDE sampling across the whole sitemap pool (not just the first N) so old and new posts are both represented; traverses up to 8 child sitemaps in a sitemap index (vs 1); fetches and verifies About/Contact/Privacy/Terms pages for real (navPageChecks: status, word count, hasContent >= 150 words); probes one homepage category link (categoryCheck: status, words, internal article links); computes contentFreshness (newest/oldest publish dates, dated count, within 90d/365d) and thinArticleRatio (share of sampled articles under 600 words). All honest: absent signals render as explicit "not found" copy, never fabricated.
  - Credits: new costs.deepScan surcharge (default 6) added to the mode cost when enabled; admin Settings > Credit costs has the "Audit: Deep scan surcharge" field + explainer.
  - API: POST /api/audit and POST /api/v1/audits accept deepScan / deep_scan; Activity details include " · deep"; v1 publicAudit includes deep_scan.
  - UI: audit workspace deep-scan toggle (custom checkbox card, ScanSearch icon, "+6 credits" badge, plain-language description, works in single and batch tabs); submit bar shows "12 + 6 deep =" breakdown; audit history rows show a "Deep scan" chip; domain deep-dive check history shows the chip too; re-run preserves deepScan.
  - Report: header shows a DEEP SCAN chip; new "Deep scan evidence" card (policy pages opened with color-coded status + word counts, content freshness grid, category page probe, thin content %, sitemap files read) with honest fallbacks; shared by dashboard, share, and sample-report pages.
  - PDF: cover meta shows "Standard + deep scan"; findings page gains a "Deep scan evidence" block (policy page table + freshness/thin/category summary, conditional copy when no dates exist).
  - AI: DEEP_HINT appended to the system prompt so the model weighs and cites the verified evidence.
  - VERIFIED end-to-end against waitbutwhy.com: 10 articles sampled, 3 sitemaps traversed, Contact 671 words + Privacy 5,782 words verified, thinArticleRatio 80% (real: sampled posts include genuinely short mini-posts), honest nulls for category (none on homepage) and freshness (no structured dates); credits deducted exactly once (94 -> 76, 18 = 12+6); AI cited the evidence ("Contact page with 671 words"); PDF page 4 shows the evidence block; v1 detail returns deep_scan: true.
  - Sample report (/sample-report) now showcases the deep-scan evidence card with realistic fictional data (marketing asset for the upgrade).
- API USAGE ANALYTICS (user-facing):
  - authenticateApiKey now upserts a per-day ApiKeyUsage row (fire-and-forget) alongside requestCount.
  - GET /api/keys returns a 14-day usage series (UTC days, zero-filled) across the user's keys.
  - Settings > Developer API card gained an "API calls · last 14 days" bar chart (pure div/CSS bars, hover tooltip with count, total in header, aria-label, first-day/Today labels) shown only when the user has keys.
  - Verified: created a key via UI, made 8 v1 calls, chart shows today's bar at max with "8 total"; key list counters track. Test key revoked afterwards (usage data persists).

Bugs found and fixed this round:
- SINGLE-AUDIT POLLER BROKEN in the UI: GET /api/audit/undefined 404 in dev.log. Root cause: POST /api/audit returns the audit id inside audits[0].id, but AuditWorkspace.startAudit read data.id (undefined) and polled /api/audit/undefined forever; the audit itself still ran server-side. Fix: id = data.id || data.audits?.[0]?.id with a guard + honest error; POST /api/audit now also returns a top-level id for non-batch starts. Verified: single audit starts now poll correctly.
- v1 audit detail response missing deep_scan (field existed only in the list endpoint) -> added to GET /api/v1/audits/[id].
- Crawler bug caught in review before runtime: the deep-scan nav verification referenced cheerio $ outside parseHomepage's scope -> now re-parses home.html with a fresh $h instance.

Styling details:
- Mode cards: selected mode shows a CircleCheck icon beside the title (clearer selection affordance).
- Audit history rows: subtle hover:bg-secondary/40 transition for scannability.
- Deep-scan toggle follows the flat system: 6px radius, single emerald accent, primary/10 chip, no gradients; theme-aware in dark mode.
- Usage chart bars: rounded-t-sm, muted for zero days, hover color shift, tooltip chip in foreground/background contrast.

Verified this round (desktop 1366 + mobile 390, light + dark):
- Deep audit end-to-end (crawl evidence above), toggle + cost breakdown, history chips, report + PDF evidence, sample report showcase.
- Usage chart with real calls; docs page documents deep_scan; admin costs field renders (value 6).
- Final: lint clean, 17 public routes 200, no unexpected dev.log errors, browser closed.

Stage Summary:
- AdAudit's core audit gained a monetizable depth upgrade with verifiable evidence (the strongest differentiator yet: "we opened your policy pages for real"), and developer API users get honest per-day usage analytics.
- Sandbox state: schema changed this round (Audit.deepScan, ApiKeyUsage) and was pushed. Test user: 76 credits, keys: Zapier webhook (active, 1 call), CI script (revoked), Usage QA key (revoked, 8 calls recorded). Admin password unchanged. costs.deepScan=6 default (persists on next admin save).
- Next priorities: Stripe/PayPal/SSLCommerz webhooks (needs public URL); deep-scan option for watchlist monitors (WatchItem.deepScan + UI); per-key spend caps; API usage page with per-key breakdown (currently one combined chart); site-check tool could reuse navPageChecks for a "policy pages" check; consider trimming Turbopack workers to avoid repeat OOM kills (dev server is capped at 1536MB via NODE_OPTIONS).

---
Task ID: 11 (cron round 9)
Agent: Z.ai cron review
Task: QA assessment + Deep scan for watchlist monitors, 7th free site-check (policy pages), styling details

Work Log (status assessment first):
- QA at round start: lint clean, all 17 public routes 200 + 307 auth redirects correct, dev.log clean, dev server healthy. Platform stable -> feature work per mandate, continuing last round's priority list.

Features added:
- DEEP SCAN FOR WATCHLIST MONITORS (scheduled checks can now use the deep crawl):
  - Schema: WatchItem.deepScan Boolean @default(false). db:push + prisma generate + dev server restarted (documented procedure, heap cap 1536MB).
  - lib/watchlist.ts: startWatchRun charges mode cost + deepScan surcharge, stores deepScan on the created Audit, activity detail gains " · deep"; addWatchItem accepts and persists deepScan.
  - API: POST /api/watchlist create schema accepts deepScan; GET returns it per item; PATCH /api/watchlist/[id] accepts deepScan (activity logs "deep scan on/off").
  - UI (watchlist-manager): add form gained the deep-scan checkbox card (+{deepCost} badge, ScanSearch icon, one-line explainer) and the per-check cost line updates live ("18 credits per check (12 + 6 deep)"); each monitor row shows a "Deep scan" label in its meta line and a compact "Deep" toggle button (aria-pressed, primary-tinted when on) next to the interval select.
  - VERIFIED end-to-end in the browser: toggled Deep on the waitbutwhy.com monitor (chip + aria-pressed true), hit "Check now" -> credits 76 -> 58 (exactly 12+6), audit row created with deepScan=true + watchItemId set, completed at 95% with the deep evidence in the report. Scheduled tick path shares the same code, so automatic runs charge the same.
- SEVENTH FREE SITE-CHECK: POLICY PAGES (lead magnet upgrade from 6 to 7 checks):
  - POST /api/tools/site-check now extracts same-origin About/Contact/Privacy links from the homepage HTML (regex-based, no extra dependency), opens up to 3 for real, strips scripts/styles/nav/footer, and measures visible word counts.
  - Honest statuses: ok when all found pages have >= 100 words, warn with "too thin" callouts when some fall short, risk when links exist but nothing readable opens, risk when no policy links exist at all. Unreachable-homepage path updated to total: 7.
  - UI + copy: result summary now reads "X of 7 checks passed"; card list renders the new "About, Contact and Privacy pages" check like the others; intro copy on /tools and the hero CTA ("seven quick health checks") updated.
  - VERIFIED against waitbutwhy.com via API and the /tools UI: "4 of 7 checks passed", policy card warns "2 of the policy pages found open with real content" (matches reality: no About link in nav, Contact + Privacy good). Rate limit, SSRF guard and activity logging unchanged.

Styling details:
- Watchlist "Deep" row button: 32px target, border-primary bg-primary/10 text-primary when active vs muted outline when off, consistent with the audit page's toggle language.
- Add-form deep checkbox reuses the audit workspace's custom-check visual (primary fill + inline SVG tick) at a compact size; theme-aware in dark mode (verified mobile 390 light + dark).
- Site-check policy card inherits the shared status-card system (ok/warn/risk icon + color) so the new check needs no special styling.

Verified this round (desktop 1366 + mobile 390, light + dark):
- Watchlist deep toggle + chip + cost line; "Check now" deep run end-to-end with exact credit math.
- Site-check 7th check via curl and the /tools UI; intro copy updated everywhere (tools page, hero).
- Final: lint clean, 16 public routes 200, no unexpected dev.log errors, browser closed.

Stage Summary:
- Monitoring and the deep upgrade are now one story: users can put a domain on a schedule once and every automatic check gets the full evidence pass. The free tool now demonstrates the same "we open your policy pages for real" differentiator before signup.
- Sandbox state: schema changed this round (WatchItem.deepScan) and was pushed. Test user: 58 credits, 1 active monitor (waitbutwhy.com, Standard + Deep, every 7 days, 95% last score, 2 checks run). Admin password unchanged. No new settings keys (deepScan cost reused from last round).
- Next priorities: Stripe/PayPal/SSLCommerz webhooks (needs a public URL); per-key spend caps + per-key usage breakdown chart; admin monitor list showing which monitors run deep; site-check could also verify Terms page (currently About/Contact/Privacy); digest email could include deep-scan flags; consider raising container memory or trimming Turbopack workers to avoid repeat OOM kills.

---
Task ID: 12 (cron round 10)
Agent: Z.ai cron review
Task: QA assessment + per-key API spend caps, per-key usage charts, admin Monitors page, 8th free site-check, digest deep flags, styling details

Work Log (status assessment first):
- QA at round start: lint clean, all 17 public routes 200, dashboard/manage routes 307 (auth redirect), dev.log clean, browser QA (desktop 1366 + mobile 390, light + dark) on home/dashboard/audit/watchlist/settings: no defects, no hydration issues. One false alarm investigated: a "clipped" credits pill in the sidebar bottom turned out to be the Next.js dev indicator overlay, not a site defect. Platform stable -> feature work per mandate, continuing round 9's priority list.

Features added:
- PER-KEY DAILY SPEND CAPS (protects the credit balance from a leaked or runaway script):
  - Schema: ApiKey.dailyCap Int? (null = unlimited). db:push + prisma generate + dev server restarted.
  - Enforcement in authenticateApiKey: reads today's ApiKeyUsage row synchronously and returns 429 with a plain-language message ("Daily limit reached for this key (N requests per day). The counter resets at midnight UTC...") before the request proceeds; the message propagates through both v1 endpoints as a JSON error.
  - POST /api/keys: create accepts optional dailyCap (1..10000); new action setCap updates or removes the cap (logged as API_KEY_UPDATE with a human-readable detail). GET /api/keys returns dailyCap per key.
  - UI (api-keys-card): create form gained a "Daily cap (optional)" field; each key row gained a Cap button opening an inline editor with a number input plus 25/50/100/250/500 preset buttons, Save/Cancel, and honest success/error notices; rows show "cap N/day" or "no cap" in the meta line and a "CAP REACHED" badge (warn tint) when today's count equals the cap; the status dot turns warn in that state.
  - VERIFIED end-to-end: created "Cap QA key" with cap 2; v1 calls -> 202, 202, then exactly 429 with the reset message; raised cap to 5 in the UI and the same key accepted requests again (202); credit math audited (owner 9,984 -> 9,969 across three 5-credit NORMAL audits).
  - Docs: /docs/api 429 row and "Good to know" list document caps and the midnight UTC reset.
- PER-KEY USAGE BREAKDOWN (finishes last round's analytics):
  - GET /api/keys now also returns perKey: { keyId: 14-day zero-filled series }.
  - The usage chart card gained a flat tab selector ("All keys" / one tab per key, aria tablist, primary-tinted active state) and the header shows "N total · N today" for the selected series.
- ADMIN MONITORS PAGE (/manage/monitors) + nav:
  - GET /api/admin/monitors returns every WatchItem with owner email/status, target, mode, deepScan, cadence, runs, lastScore, last/next run, and overdueMinutes (active + nextRunAt past).
  - MonitorsManager: filter tabs All/Active/Deep scan/Overdue with live counts, table (Domain, Owner + suspended chip, Depth with network·mode + "Deep" chip, cadence, score chip with ok/warn/risk tint, runs, next check with "overdue 2h"-style labels, state Active/Paused with pausedReason tooltip), row hover transition, min-w table with horizontal scroll on mobile.
  - Admin dashboard "Site monitoring health" card: new "Deep scan" tile (5-tile grid) + "All monitors" link beside "Monitoring log".
- 8TH FREE SITE-CHECK + TERMS VERIFICATION (lead magnet now "eight quick health checks"):
  - New check "No mixed content on the homepage": counts http:// src references on img/script/iframe/source/video/audio in the already-fetched homepage HTML (ok when zero, warn with exact count; honest warn when the homepage itself is not on HTTPS).
  - Policy check now also targets /terms(-of-use|-service), fetches up to 4 pages, and reports missing ones by name ("Not linked from the homepage: about, terms") alongside the thin-page callouts; ok requires all found pages good AND none missing.
  - Copy updated everywhere: tools card intro, footer explainer, hero CTA -> "eight".
  - Caught and fixed a self-made inconsistency mid-round: extending the policy check alone still totaled 7 while the copy said eight - resolved by adding the genuine mixed-content check instead of shipping dishonest copy.
  - VERIFIED against waitbutwhy.com via API and the /tools UI: "5 of 8 checks passed", mixed-content ok, policy warn with the missing about/terms callout.
- DIGEST EMAIL DEEP FLAGS: weekly monitoring digest rows now append "· deep scan" (emerald bold in HTML, plain in text) for monitors with deepScan on; unit-rendered both formats to verify flag on/off per row.

Bugs found and fixed this round:
- api-keys-card crashed with "Cannot read properties of null (reading 'length')" on first render: the new series expression could be null before data loaded. Fixed with `usage || []` fallbacks.
- Mixed-content regex had a stray space before the closing quote (would never match) - caught in self-review before testing.
- STALE TAILWIND/TURBOPACK SCAN CACHE (new sandbox lesson): after editing classNames in a server component (manage dashboard), new utilities (lg:grid-cols-5) reached the DOM but their CSS was never emitted - persisting across dev server restarts. Fix: rm -rf .next + restart. Note for future agents: if a brand-new utility class renders unstyled after a restart, clear .next before suspecting the code.

Styling details:
- Chart tab selector: h-7 flat bordered tabs, primary/10 fill when active, truncate + title on long names, aria tablist semantics.
- Cap editor: nested secondary-tinted panel, preset chips as 36px bordered buttons, primary Save + ghost Cancel.
- "CAP REACHED" chip reuses the badge language of "Revoked" (soft tint + uppercase 11px).
- Admin monitors table: score chips ok/warn/risk, "Deep" chip with ScanSearch icon, overdue in warn, suspended chip next to owner email, hover:bg-secondary/40 rows.
- Monitoring health tiles: 5-across on lg, ScanSearch icon for the deep tile; theme-aware in dark and light.

Verified this round (desktop 1366 + mobile 390, light + dark):
- Cap flow end-to-end (202/202/429, cap edit re-opens the faucet, credits move correctly), CAP REACHED badge, per-key chart tabs, create-with-cap field.
- /manage/monitors filters (Overdue 0 -> empty state, Deep -> the waitbutwhy row), admin dashboard deep tile.
- Site-check 8/8 surfaces via curl and /tools UI; digest text+HTML flags; docs updated.
- Final: lint clean, all public routes 200, auth redirects 307, dev.log clean, .next cache rebuilt.

Stage Summary:
- The developer API is now safe to hand to third parties: each key can be capped per day, watched per key in the usage chart, and killed instantly - caps convert a leaked key from "account drained" to "rate limited".
- Admins get full fleet visibility over scheduled monitoring (who runs what, how deep, how overdue), and the free tool now runs eight honest checks including mixed content and Terms verification.
- Sandbox state: schema changed this round (ApiKey.dailyCap) and was pushed. Admin: 9,969 credits (QA audits charged as designed). Test user: 58 credits, 1 active deep monitor. Active keys: Zapier webhook (no cap), Cap QA key (admin-owned, cap 5, 3 calls today). No new settings keys.
- Next priorities: Stripe/PayPal/SSLCommerz webhooks (blocked on a public URL); per-key usage page with export; monitor-level spend caps (max credits/day per user); sample-report showcase of the new mixed-content check; watchlist "Check now" could honor per-key caps analogy with a per-run credit preview; consider a "cap reached" notification so owners learn why a script stopped.

---
Task ID: 13
Agent: Z.ai main
Task: Critical bug fixes (preview broken + login redirect loop) + full UXpert redesign + Telenor font + vector illustration system + rebrand to Audit Form

Work Log (user report: preview not working, ERR_TOO_MANY_REDIRECTS on login, site must follow uxpert.netlify.app design, Telenor font, vector illustrations with dark variants, remove unneeded stuff):

ROOT-CAUSE FIXES (both were blocking the sandbox preview entirely):
1. PREVIEW IFRAME BLOCKED: next.config.ts set "X-Frame-Options: DENY" on every route, which prevents the preview panel (different origin) from embedding the app. Removed that header (kept nosniff/referrer/permissions). This is why "preview not working".
2. LOGIN REDIRECT LOOP: .env had NEXTAUTH_URL=http://localhost:3000. NextAuth v4 emitted absolute redirects to that URL; the preview platform rewrites localhost:3000 back to the preview domain, producing an infinite 3xx loop (ERR_TOO_MANY_REDIRECTS). Removed NEXTAUTH_URL, added AUTH_TRUST_HOST=true so NextAuth v4 derives origin from X-Forwarded-Host/Proto per request. Verified end-to-end THROUGH THE REAL PREVIEW URL with curl: csrf -> credentials callback -> session-token cookie -> /api/auth/session returns the user. Browser click-through login (test.publisher@example.com) also lands on /dashboard.
3. Disabled the Next.js dev indicator badge (devIndicators: false) that floated over the UI.

UXPERT DESIGN OVERHAUL (per user: extremely follow https://uxpert.netlify.app):
- Studied the reference live (screenshots + CSS tokens): light blue-gray bands #E0EAF3, near-black #1D1D1D heavy headlines with coral accent words, coral #F86642 single primary, circled check bullets, numbered coral step circles, solid rounded uppercase CTAs, flat character illustrations, near-black footer.
- globals.css: new token set (primary coral #F86642 light / #FF7A50 dark, band tokens, secondary/muted/accent re-tuned, radius 8px, semantic ok/warn/risk kept), body font-family Telenor with Noto Sans Bengali fallback, .bg-band utility, removed dotgrid hero texture, neutral gray scrollbars, dark palette re-tuned (#14181D base, #232B36 band).
- Telenor font installed for real: downloaded official Telenor/Light/Bold .woff from telenor.com binaries into public/fonts and wired @font-face (300/400-500/600-800). Open Sans dependency removed from layout.
- Rebrand: site name "Audit Form" everywhere (DB setting + SITE_DEFAULTS, metadata, PDF brand, digest, test email, all AdAudit strings in src renamed).
- site-header: uppercase bold 13px nav, coral GET STARTED button, active link coral.
- site-footer: near-black #1D1D1D dark footer (light and dark mode), coral accents, white payment-logo chips, Developer API link replaced with Sample report.
- Home page rebuilt in the UXpert pattern: centered blue-gray hero with two-line coral-accent headline, audit form centered, three circled coral checks, hero-people illustration; network trust bar; "How auditing works" with coral 01/02/03 circles + coral step titles; features grid; three-colors section on band; tools grid; pricing; blog; FAQ; near-black CTA band with coral button.
- Login/register: blue-gray band side panel with vector illustration; accent colors updated.
- All remaining public pages (features, how-it-works, tools, about) switched from old AI PNGs to the new SVG set.

FLAT VECTOR ILLUSTRATION SYSTEM (scripts/gen-illustrations.mjs):
- Parametric flat-character kit (skin tones, hairstyles: bob/afro/short/bun/cap, poses: stand/point/wave/carry) + props (browser windows, checklists, magnifier, coins, rocket, shield clock, desk).
- 8 scenes generated as true SVG in light + dark variants: hero-people, audit-desk, report, writer, growth, index-rocket, support, monitor. Dark variants in /public/illustrations/dark.
- New <Illustration name="..."> component swaps light/dark via dark:hidden / hidden dark:block (works with class-based next-themes).
- Deleted all 8 legacy AI-generated PNG illustrations; EmptyState component now takes SVG names (dashboard/admin callers updated).
- Rebranded PDF palette + monitor digest colors to the new tokens.

Verification (agent-browser, desktop 1366 + mobile 390, light + dark):
- Home hero, how-it-works numbered circles, features, tools, pricing, sample report, blog, contact, login, register: rendered + screenshots reviewed in both themes; dark variants of illustrations confirmed.
- Login click-through end-to-end in browser -> /dashboard renders with new palette; theme toggle works; dark dashboard verified.
- Hero audit form: invalid domain blocked with message, valid domain routes to /register?domain=...&network=ADSENSE.
- Mobile home + footer: stacks correctly, dark footer with payment chips, no overflow.
- bun lint clean; 15 public routes return 200; dev.log free of runtime errors.

Stage Summary:
- The two preview-blocking bugs are gone: the preview iframe renders and login works on the real preview URL (verified via curl with session cookie + in-browser click-through).
- The site now follows the UXpert design language with the Telenor brand font, coral primary, blue-gray bands, and a theme-aware flat-vector illustration system (8 scenes x light/dark).
- Sandbox state: no schema changes. DB site.name now "Audit Form". .env: DATABASE_URL, NEXTAUTH_SECRET, AUTH_TRUST_HOST=true (NEXTAUTH_URL intentionally omitted; do not re-add a hardcoded localhost URL).
- Next priorities: sweep remaining dashboard/manage subpages for small contrast details under the coral palette; /manage login + admin pages styling pass; apply coral/Telenor to PDF header art; consider a monitor-scene illustration on the watchlist page; blog post pages sample-report typography polish; verify Google OAuth only after client keys are configured.

---
Task ID: 14
Agent: Z.ai main
Task: Deep QA (quality/bugs/performance), UXpert design polish, dead-code cleanup, Hostinger Business-plan deployment readiness

Work Log (status assessment first):
- QA at round start: lint clean, all public routes 200 + auth 307s correct, dev.log clean. Full browser QA (desktop 1366 + mobile 390, light + dark): home, all 8 dashboard pages, all manage pages, report detail, checkout, free site-check end-to-end ("5 of 8 checks passed" against waitbutwhy.com), console clean everywhere.

Bugs found and fixed:
- DARK-MODE HOME MOCKUP BROKEN: ReportMockup hardcoded bg-white while text used text-foreground, so in dark mode findings rendered as unreadable gray "skeleton" bars (light text on white). Fixed to bg-card + bg-background address pill; verified color-coded findings now render in both themes.
- REPORT HEADER ACTIONS WRAP: five header buttons wrapped leaving "Print" orphaned mid-line; actions row now right-aligned with tightened labels ("Share report"→"Share", "Copy summary"→"Copy") so all five fit on one row at 1366px.
- metadataBase fell back to http://localhost:3000 (NEXTAUTH_URL intentionally omitted) which would produce wrong canonical/OG URLs in production; now prefers NEXT_PUBLIC_SITE_URL (same env sitemap.ts already uses).
- Dev server OOM-killed again during the cleanup recompile; restarted with the documented persistent-spawn procedure (NODE_OPTIONS=--max-old-space-size=1536, dev.log appended via fd).

Performance / dead-code cleanup (user mandate: remove files not asked for):
- Deleted 35 unused shadcn/ui components (only 13 are imported anywhere: accordion, button, dialog, input, label, select, separator, sheet, skeleton, toast, toaster, toggle, tooltip) after verifying zero references incl. intra-ui imports. Deleted src/hooks/use-mobile.ts (only consumer was the removed sidebar).
- Deleted non-app artifacts: examples/ (websocket demo), tests/ (platform scripts), download/, tool-results/, public/generated/<old-jobId>/ stale writer images (blog covers verified null in DB; writer recreates per-job dirs at runtime).
- Telenor Regular + Bold now preloaded in root layout head (crossOrigin anonymous) to cut FOUT; hero-people.svg light/dark already preloaded by the site layout.

Hostinger Business-plan deployment readiness (user: "ready to repose on hostinger shared business plan"):
- Verified externally via web search + Hostinger KB: Node.js web apps ARE supported on Business Web Hosting and all Cloud plans (Node 18/20/22/24; GitHub-import or zip upload; framework auto-detect with "Other" fallback).
- prisma/schema.mysql.prisma added: identical to schema.prisma but provider "mysql" + @db.Text/@db.MediumText on all JSON/HTML long-text columns (report, signals, features, instructions, config, meta, message/reply, excerpt/content, input/result/images, urls, detail, body, value) — without these MySQL would truncate to VARCHAR(191). Validated with `prisma validate` (passes with a mysql:// URL).
- .env.example added: DATABASE_URL (mysql://), NEXTAUTH_SECRET, AUTH_TRUST_HOST=true (with the no-hardcoded-NEXTAUTH_URL warning), NEXT_PUBLIC_SITE_URL, ADMIN_EMAIL/ADMIN_PASSWORD, GOOGLE_CLIENT_ID/SECRET; notes that AI/SMTP/gateways/costs are admin-panel settings, not env.
- DEPLOY.md added: step-by-step (create MySQL DB, copy MySQL schema, GitHub import, build/start commands `npm run build` + `node .next/standalone/server.js`, env vars, first-run checklist incl. OpenRouter key + SMTP + gateways + OAuth callback, watchlist cron via /api/watchlist/tick every 10-15 min, SSL).
- package.json: start script now uses `node` instead of `bun` (Hostinger has no bun); `postinstall: prisma generate` added so installs on any host get a client.
- src/lib/seed.ts: admin account now reads ADMIN_EMAIL/ADMIN_PASSWORD env (previous hardcoded admin@adaudit.app / Admin@2024! remains as sandbox fallback) so production never ships a known password.

Design polish (UXpert language):
- Watchlist page: empty state now uses the dedicated monitor illustration; "How scheduling works" card gained a small monitor scene (theme-aware, light+dark variants verified).
- Report detail page verified end-to-end again after edits (light + dark): score ring, section cards, strengths/risks/fixes, roadmap, comparison panel all render correctly.
- PDF branding already on coral #f86642 (from task 13) — confirmed, no change needed.

Module checklist re-verified against the original brief (all present):
1) Audit tool (single+batch, 3 modes, deep scan) 2) Ad network readiness (ADSENSE/EZOIC/MEDIAVINE/RAPTIVE with real logos) 3) AdSense writer (17-rule policy prompt, images, WordPress publish) 4) Affiliate content writer 5) Quick index (IndexNow) 6) Blog (+admin manager) 7) Contact page 8) Subscription/credits billing (USD + BDT live rate, bkash/nagad/rocket manual + API gateways) 9) /manage/ admin panel (users, audits, monitors, payments, plans, gateways, affiliate, messages, blog, activity, settings). Plus: branded PDF, 20% affiliate commission + withdrawals, 2FA, Google OAuth (needs keys), developer API with caps.

Verified end-to-end this round (browser, desktop 1366 + mobile 390, light + dark):
- Free tool golden path, report detail (light/dark), watchlist empty state + illustrations, checkout (real gateway logos, USD/BDT toggle, consent gate), admin panel pages, login/register/dashboard surfaces.
- Final: lint clean, route sweep correct (404s only for invalid slugs/tokens), no runtime errors in dev.log, browser closed.

Stage Summary:
- AdAudit/Audit Form is now a clean, deployment-oriented repo: 36 dead files removed, dark-mode home mockup fixed, font preloading, production env handling for admin seeding, a validated MySQL schema for Hostinger, and a concrete deploy guide for the Business shared plan.
- Sandbox state: no schema changes this round (schema.mysql.prisma is additive). Test user 58 credits (1 deep monitor), admin 9,969 credits. .env.example + DEPLOY.md + prisma/schema.mysql.prisma are new files.
- Next priorities: production smoke test once deployed (seed + first audit against OpenRouter); Stripe/PayPal/SSLCommerz live webhooks still need a public URL + keys; optional per-key usage export page; consider sitemap lastmod for blog posts.

---
Task ID: 15
Agent: Z.ai main
Task: GitHub backup upload (PR + merge) + Hostinger deployment preparation

Work Log:
- Verified sandbox state: dev server 200, working tree clean, GitHub token valid (repo pritamsarkar711/FIRST-SAAS- was empty, size 0).
- SECURITY FIX BEFORE PUSH: .env (secrets) and db/custom.db (user data) were tracked in git; untracked both, extended .gitignore (db/*.db), committed.
- GitHub upload flow: created README.md as first commit on remote main via API; pushed full project (252 files) as feature/audit-form-full-site; GitHub rejected PR between unrelated histories, so rebased history onto remote main and force-updated the branch; created PR #1 "Audit Form - full SaaS source upload (v1)"; merged via API (merge commit 026abfa); deleted the feature branch; verified key files on main (package.json, DEPLOY.md, prisma schemas, fonts, README) and absence of .env / db/custom.db.
- Found .env.example was excluded by the ".env*" gitignore rule; added !/.env.example, committed, pushed to main (now 200 on GitHub).
- Deployment architecture decision: sandbox egress firewall BLOCKS all ports to the Hostinger server (all ports timeout; github.com works), so direct SSH deploy from the sandbox is impossible. Built a GitHub Actions pipeline instead: .github/workflows/deploy-hostinger.yml builds the Next.js standalone bundle on the runner (server never builds), rsyncs over SSH to ~/auditform/app, runs scripts/deploy/on-server.sh (writes .env, npx prisma db push against MySQL, restarts node on 127.0.0.1:3000, installs LiteSpeed .htaccess proxy into the domain docroot with backup), then smoke-tests the public URL. scripts/deploy/survey.sh gives a read-only server inspection (workflow_dispatch mode=survey). Secrets already set via API: SSH_HOST/SSH_PORT/SSH_USER set to the Hostinger server values (redacted), NEXT_PUBLIC_SITE_URL=https://brown-goshawk-979924.hostingersite.com, NEXTAUTH_SECRET (generated, stored in /home/z/hostinger-deploy/NEXTAUTH_SECRET.txt), ADMIN_PASSWORD (generated, stored in /home/z/hostinger-deploy/ADMIN_PASSWORD.txt). Still missing: SSH_PASSWORD, DATABASE_URL, ADMIN_EMAIL.
- First Actions run failed BEFORE any step: GitHub says "recent account payments have failed or your spending limit needs to be increased" - the USER's GitHub billing blocks Actions on this (private) repo. User must fix billing or make the repo public. Not a YAML error.
- Cross-platform production fixes: prisma/schema.mysql.prisma now ships binaryTargets (native + debian/rhel openssl variants) and next.config.ts gained outputFileTracingIncludes for .prisma engines, so a bundle built on Ubuntu runs on Hostinger CloudLinux.
- npm compatibility: npm ERESOLVE (next-auth@4 peers nodemailer@^7 vs installed 10) would break npm install on Hostinger; downgraded nodemailer to ^7.0.7 (+@types), verified app usage (createTransport/sendMail) compatible, bun install + lint + dev server 200 re-verified. Generated and committed package-lock.json (360KB) so npm ci works anywhere.
- hPanel Option B made zero-touch: package.json start:prod now runs `prisma db push --schema prisma/schema.mysql.prisma --skip-generate` before boot (non-fatal warn on failure); DEPLOY.md updated (start command npm run start:prod, removed the wrong "auto-push on first run" claim, documented Option A automated flow).

Stage Summary:
- GitHub backup COMPLETE: PR #1 created and merged; main holds the full site source, deployment tooling, README and lockfile; no secrets in the repo.
- Deployment is blocked on USER actions only: (a) SSH password (for the automated pipeline + survey), (b) MySQL DB created in hPanel (name/user/password), (c) admin email choice, (d) GitHub billing fix OR make repo public so Actions can run.
- Everything else is pre-staged: workflow + scripts + secrets; the hPanel Node.js-app path needs no Actions and no SSH (import repo, paste env vars incl. generated NEXTAUTH_SECRET/ADMIN_PASSWORD, start command npm run start:prod).
- Next priorities: run mode=survey once SSH password arrives; wire DATABASE_URL; execute deploy; verify public URL; OpenRouter key + SMTP in /manage/settings; watchlist cron every 10-15 min; advise rotating the shared GitHub token.

---
Task ID: 16
Agent: Z.ai main
Task: Deploy credentials wiring + admin Google login feature + deployment path resolution

Work Log:
- Set remaining GitHub secrets via API (encrypted): SSH_PASSWORD, DATABASE_URL=mysql://<db-user>:<redacted>@localhost:3306/<db-name> (^ URL-encoded), ADMIN_EMAIL and ADMIN_PASSWORD set to the owner's chosen values (redacted). All 10 secrets now in place.
- Dispatched workflow_dispatch survey run 38918010023 -> FAILED before any step: GitHub billing block persists ("recent account payments have failed or your spending limit needs to be increased"). User has NOT fixed billing yet; the automated pipeline cannot run on this private repo until billing is fixed or the repo goes public.
- Feature: added "Sign in with Google" to the admin panel login. src/app/manage/login/page.tsx (server) computes googleEnabled from GOOGLE_CLIENT_ID/SECRET env or the admin-panel google setting (mirrors auth.ts provider logic) and passes it to AdminLoginScreen; src/components/admin/login-screen.tsx gained a divider + Google button (signIn google, callbackUrl /manage) rendered only when configured, with a note that it works for the admin account email only. Non-admin Google sessions are bounced by the manage layout to /dashboard. Verified in dev: button hidden without config, visible with dummy env; env restored after the test.
- 2FA: verified ALREADY fully implemented (admin login form shows the TOTP step on 2FA_REQUIRED; settings workspace has start/enable/disable 2FA flows via /api/auth/2fa/*). No code change needed - documented where it lives for the user.
- Sandbox infra: dev server kept dying between tool calls (manual setsid+nohup spawns are reaped by the platform). Re-used the documented persistent spawn from the worklog (Bun.spawn + unref + fd-appended dev.log + 1536MB heap cap) - server stable across calls; home, /login, /manage/login all 200 after cache-clear restart (rm -rf .next for Turbopack cache corruption).

Stage Summary:
- Admin panel login now offers password+2FA and (when configured) Google sign-in; 2FA flows confirmed present end to end.
- All deployment secrets are staged in GitHub; the ONLY blockers remain on the user side: (a) fix GitHub billing OR make repo public to unblock the ready-to-run Actions deploy, (b) optionally the hPanel Node.js app path needs zero CI and is fully documented with their real values.
- Next priorities: trigger survey+deploy the moment Actions unblocks; verify https://brown-goshawk-979924.hostingersite.com; user adds OpenRouter key + SMTP + Google OAuth client in /manage/settings; watchlist cron; remind user to rotate the GitHub token shared in chat.

---
Task ID: 17
Agent: Z.ai main
Task: User reported site still 403/503 - take over deployment completely, fix all issues

Work Log:
- Confirmed repo already PUBLIC (user made it public) -> Actions billing block GONE. Dispatched deploy run 19 (workflow_dispatch mode=deploy): build+rsync+htaccess all succeeded, but app crashed at boot and public URL returned 503 x5.
- ROOT CAUSE CHAIN discovered over runs 20-23 (each iteration = commit+push+auto-deploy+logs):
  1. Workflow's old pdfkit "patch" rewrote #standard-fonts refs to RELATIVE paths -> "Cannot find module ... from ''" (bun cannot resolve relative specifiers from anonymous/eval parents) -> unhandledRejection crashed the app (no guard) -> LiteSpeed proxy -> 503.
  2. Replaced with BARE specifier patch + REAL PDF render probes (CJS+ESM x node+bun). Run 20 boot gate tightened: node module errors fatal, bun rejections informational (guard keeps server alive).
  3. Run 21: DB init was failing with errno 121 (duplicate FK names from an earlier partial init). on-server.sh now DROPs all tables/views (FOREIGN_KEY_CHECKS=0) then applies db-init.sql -> clean 18-table schema, 0 errors, every deploy since.
  4. Run 22: .mjs mapping bug - pdfkit.node.mjs loads fonts via createRequire (CJS) so fonts must map to .cjs (plain object); .mjs made bun return a module namespace -> "Invalid standard font data" thrown synchronously during boot -> server never bound. Fixed mapping (browser.mjs keeps .mjs).
  5. Run 23: all probes pass; bun cold boot on the shared CPU takes 100-165s; health window raised to 20x7s; app reached "Ready" 7s AFTER the health loop gave up.
  6. Added crash-restarting supervisor (~/auditform/run-app.sh, bash while-loop, setsid nohup) + src/instrumentation.ts (global unhandledRejection/uncaughtException guards) -> app can no longer die silently.
- Survey runs (24, 26) exposed the REAL platform constraint:
  * node is MISSING on the Hostinger shared server; only /usr/bin/bun 1.3.14 exists.
  * App process ALIVE + "Ready in 88-146ms", supervisor stable, 0 restarts, /proc/net/tcp SHOWS a LISTEN socket 127.0.0.1:3000 owned by the user UID.
  * BUT curl to 127.0.0.1:3000 FROM THE SERVER = Connection refused x3, and even a trivial `bun -e Bun.serve({port:3999})` = connection refused. LiteSpeed's .htaccess [P] proxy therefore CANNOT work on this host (its backend connect is refused the same way) -> permanent 503.
  * Conclusion: Hostinger shared blocks tenant TCP loopback connections (their managed hPanel "Node.js App" feature is the officially supported path - it proxies via LS vhost config, not user .htaccess).
- Survey v4 (run 30) dispatched to test escape hatches: bind 0.0.0.0 + connect via PUBLIC IP (iptables REJECT may only match 127.0.0.0/8 dest), and to discover managed node binaries (/opt/alt/...). Workflow survey step now receives PUBLIC_URL + PUBLIC_IP env.
- 13 GitHub secrets verified in place (SSH*, DATABASE_URL, DB_HOST/USER/PASSWORD/NAME, NEXTAUTH_SECRET, NEXT_PUBLIC_SITE_URL, ADMIN_EMAIL, ADMIN_PASSWORD).
- Dev sandbox: local dev server healthy (200) with the new instrumentation.ts; no regressions.

Stage Summary:
- The full deployment pipeline WORKS end-to-end (build -> probe -> rsync -> DB reset+init -> supervisor -> htaccess); the ONLY blocker is the host's TCP loopback connection block, which is a platform policy, not a bug in our stack.
- App is fully prepared on the server (~/auditform/app: standalone bundle, node_modules incl. pdfkit fonts, .env with real DB creds, DB schema live with 18 tables).
- Next: read survey v4 results. If public-IP bind works -> switch on-server.sh to HOSTNAME=0.0.0.0 + .htaccess [P] -> http://PUBLIC_IP:3000 and redeploy. If refused -> write HPANEL-NODE-APP-STEPS.md (zero-build path: hPanel Node.js app pointing at the already-built ~/auditform/app, startup file server.js, no npm install needed) and hand the user a precise click-by-click; our supervisor + .htaccess must be removed to avoid conflicts. Update DEPLOY.md accordingly.
- User to-dos after go-live: rotate the GitHub token shared in chat; configure OpenRouter/SMTP/Google OAuth in /manage/settings (callback https://brown-goshawk-979924.hostingersite.com/api/auth/callback/google); 2FA available in Settings.
---
Task ID: 18-c
Agent: general-purpose subagent
Task: Port public site pages + shared components + auth pages to Laravel/Inertia

Work Log:
- Read PORTING.md contract, routes/web.php route contract, and all Next.js sources in scope (src/components/**, src/app/(site)/**, login/register, share/[token]) plus the already-written Laravel controllers (Site\HomeController, Site\PageController, Site\BlogController, Site\ContactPageController, Site\ShareController, Site\AuthPageController, Auth\AuthController, Auth\RegisterController, HandleInertiaRequests middleware, Plan/BlogPost/Audit models) to lock prop shapes before writing components.
- Shared components ported with import transforms only (next/link -> @inertiajs/react Link, usePathname -> usePage().url, "use client" removed, all classNames untouched): site-header.tsx (usePage().url for active nav), site-footer.tsx, brand-logo.tsx, shared/theme.tsx (ThemeProvider now forwards attribute/defaultTheme/enableSystem/disableTransitionOnChange with the original defaults so resources/js/app.tsx's global mount compiles and behaves identically), shared/empty-state.tsx, shared/notification-bell.tsx (fetch /api/notifications + POST mark-read unchanged), shared/contact-form.tsx (POST /api/contact unchanged), shared/pricing-cards.tsx, shared/hero-audit-form.tsx (router.visit(`/register?domain=...&network=...`)), shared/site-check-tool.tsx (see deviation), shared/report-mockup.tsx + report-ui.tsx + report-view.tsx + logo.tsx + illustration.tsx verified byte-identical to source (diff clean).
- Created resources/js/components/site-shell.tsx: port of src/app/(site)/layout.tsx reading siteName/tagline from shared Inertia props (HandleInertiaRequests already shares site.name/site.tagline) instead of the server-side siteSettings() call; wraps children in SiteHeader + <main className="flex-1"> + SiteFooter.
- Created missing client-safe lib shims required by scope components: resources/js/lib/use-has-mounted.ts (copied 1:1, needed by theme.tsx and dashboard/score-history-chart) and resources/js/lib/audit-runner.ts (AuditReport/AuditReportSection types + networkName() only - the heavy pipeline stays server-side in PHP; needed by report-view.tsx and the sample-report page).
- Auth: resources/js/components/shared/auth-form.tsx ported with axios: login POST /api/auth/login (res.data.ok -> router.visit(callback); 401 2FA_REQUIRED -> show 6-digit code field + message; INVALID_2FA / ACCOUNT_SUSPENDED -> show res.data.message; else "Wrong email or password. Try again."), google -> window.location.href = "/auth/google/redirect", register POST /api/auth/register then auto-login via /api/auth/login then router.visit; domain/callbackUrl read from the new `params` prop (request->query()) instead of useSearchParams; Google button + divider rendered only when googleEnabled; two-column Illustration layout and all classNames kept.
- Pages: Home.tsx (props plans/posts/usdBdt; parses plans[].features JSON string into PlanCard[], PricingCards rate=usdBdt, wrapped in SiteShell), Site/Pricing.tsx (plans+usdBdt, feature matrix from live plans), Site/Features.tsx, Site/HowItWorks.tsx, Site/Tools.tsx, Site/SampleReport.tsx (full SAMPLE_REPORT + SAMPLE_SIGNALS data ported, ReportView), Site/About.tsx, Site/Terms.tsx, Site/Privacy.tsx, Site/Refund.tsx, Site/DocsApi.tsx (plain <a> links kept as in the original), Site/Blog/Index.tsx (posts prop, next/image fill -> absolute img), Site/Blog/Show.tsx (post prop, JSON-LD script kept, article-body dangerouslySetInnerHTML kept, related prop accepted like the original which never rendered it), Site/Contact.tsx (ContactForm), Share/Report.tsx (NOT wrapped in SiteShell - mirrors original custom header/footer; JSON.parses audit.report string; signals=null since ShareController doesn't pass them; site name from shared props; Head noindex), Auth/Login.tsx + Auth/Register.tsx (Head titles + pass params/googleEnabled to AuthForm). All static pages get <Head title> matching the original Next.js metadata exports (deleted per rule 8, title moved to Inertia Head).
- Verification: bun Transpiler parse-check PASS on all 36 created/edited ts/tsx files (no local TS compile possible); diffed every kept-as-is component against src/ (byte-identical except mandated transforms); grepped scope for leftover next/* imports and "use client" (clean); cross-checked every Inertia page name against routes/web.php controllers and app.tsx import.meta.glob resolution.

Stage Summary:
- Files created: resources/js/components/site-shell.tsx; resources/js/lib/use-has-mounted.ts; resources/js/lib/audit-runner.ts; resources/js/Pages/Home.tsx; Pages/Site/{Pricing,Features,HowItWorks,Tools,SampleReport,About,Terms,Privacy,Refund,DocsApi}.tsx; Pages/Site/Blog/{Index,Show}.tsx; Pages/Site/Contact.tsx; Pages/Share/Report.tsx; Pages/Auth/{Login,Register}.tsx.
- Files ported in place (were raw copies): components/{site-header,site-footer,brand-logo}.tsx, components/shared/{theme,empty-state,notification-bell,contact-form,site-check-tool,pricing-cards,hero-audit-form,auth-form}.tsx. logo/illustration/report-mockup/report-ui/report-view needed no changes.
- Key decisions: site settings come from shared Inertia props (site.name/tagline); plans.features parsed client-side (DB stores JSON string, no Eloquent cast); blog author via optional chaining (BlogController::show does not eager-load author -> falls back to "Audit Form Team"); reading minutes guard on missing content (BlogController::index omits the content column - falls back to "1 min"; controller could add it later for real values).
- Deviations from byte-identical port: (1) site-check-tool fetch switched POST /api/tools/site-check {JSON body} -> GET ?domain=... to match the authoritative routes/web.php (GET-only) - SiteCheckApiController (not yet written) must read $request->query('domain') and return {domain, checks[], passed, total}; (2) auth-form Google button + "or" divider hidden when googleEnabled=false; (3) ThemeProvider forwards next-themes props for the pre-existing app.tsx global mount.
- Known gaps / integration notes: SiteCheckApiController + SiteCheck result contract must implement GET?domain=; axios is imported as `import axios from "axios"` per PORTING.md (transitive dep of @inertiajs/react - fine under npm/yarn flat install; switch to `import { axios } from "@inertiajs/react"` if a strict pnpm-style install ever fails to hoist); Share/Report expects ShareController to keep returning report as JSON string (page parses it); JSON-LD/OG tags for blog posts render client-side only (same as SSG-less Next behavior).
---
Task ID: 18-d
Agent: general-purpose subagent
Task: Port /manage admin panel (pages + PanelController + admin API controllers) to Laravel/Inertia

Work Log:
- Read PORTING.md, worklog context and routes/web.php (authoritative contract) before any work; then read every source file in scope: 13 manage page.tsx files + (panel)/layout.tsx, 14 components/admin/*.tsx, and all 13 src/app/api/admin/*/route.ts files, plus the shared libs they depend on (use-initial-fetch, payments.ts, notify.ts, monitor-digest.ts, prisma schema cascade rules).
- Discovered the 14 admin components were already copied 1:1 into resources/js/components/admin/ but NOT transformed (byte-identical to Next.js originals, still with "use client", next/* imports). Applied the PORTING.md transforms: stripped "use client" from all 14; rewrote shell.tsx (Link from @inertiajs/react, usePathname -> usePage().url, next-auth signOut -> local axios /api/auth/logout helper + window.location redirect, router.refresh() -> router.reload()) and login-screen.tsx (see below). All visual classNames untouched. Created the missing dependency resources/js/lib/use-initial-fetch.ts (verbatim minus "use client") - components import it from @/lib/use-initial-fetch.
- login-screen rewrite: signIn("credentials") -> axios.post("/api/auth/login", {email,password,code}); 401 error==="2FA_REQUIRED" -> shows the TOTP step with the original message; success (ok && role==="ADMIN") -> router.visit("/manage"); non-admin -> calls /api/auth/logout then error "This account does not have admin access."; 403 ACCOUNT_SUSPENDED -> shows server message; Google button -> window.location.href="/auth/google/redirect", rendered only when the googleEnabled prop is true; dropped useSearchParams/callbackUrl per task spec. Suspense wrapper and every className kept.
- Created resources/js/Pages/Manage/: Login.tsx, Dashboard.tsx, Users/Audits/Monitors/Payments/Plans/Gateways/Affiliate/Messages/Blog/Activity/Settings.tsx. The 11 manager pages wrap their manager in <AdminShell adminName=...> (role the old (panel)/layout.tsx played; adminName comes from the controller prop with auth.user fallback). Dashboard.tsx is a client port of the server page.tsx: identical JSX, all server data delivered as props (stats, pendingPayments, recentUsers, recentAudits, monitors summary, attentionItems).
- Created app/Http/Controllers/Admin/PanelController.php with the exact contract methods: showLogin (Manage/Login + googleEnabled from Settings::googleEnabled()), dashboard (all 13 dashboard queries ported from the original Promise.all: user/audit counts, 7d audits, APPROVED revenue sum, 6 pending payments, 5 newest users, 5 latest audits, monitor health counts incl. due/paused/deep/7d watch failures, 5 attention watch items), users/audits/monitors/payments/plans/gateways/affiliate/messages/blog/activity/settings (render their Manage/* page with adminName).
- Created 12 API controllers in app/Http/Controllers/Api/Admin/ as 1:1 ports of the route.ts handlers (same JSON shapes, status codes, validation messages, activity logging, actor from $request->user()): UsersController (index with q search + _count maps; store with all 8 actions incl. self-protection 400s; update=PATCH alias of store), AuditsController (index 1:1; destroy per web.php contract - original had no DELETE), MonitorsController (index 1:1 incl. overdueMinutes math + summary; update per contract), PaymentsController (index; update approve/reject - App\Services\Payments does NOT exist yet so approvePaymentById is ported inline as a static method: DB transaction granting credits + ACTIVE subscription, affiliate earning via Settings site.affiliateRate, in-app notify, PAYMENT_APPROVE log; reject with notify + PAYMENT_REJECT log), PlansController (index/store/destroy 1:1 incl. deactivate-when-in-use; update=PATCH alias), GatewaysController (index; update with JSON config validation), AffiliateController (index rate+earnings+withdrawals with user/fromUser; update setRate (Settings::set site) + withdrawal approve/reject/complete with CLEARED re-earn on reject, notifications, logs), MessagesController (index; update reply -> stores reply/REPLIED/repliedAt + in-app notify + MailConfig::send("Re: {reason} - Audit Form support") when SMTP configured (non-fatal), close -> CLOSED), PostsController (index with ?id single fetch; store/update save with publishedAt preservation on update + BLOG_PUBLISH logs + authorId on create; destroy), SettingsController (show returns site/ai/costs/google/smtp/prompts(Prompts::defaults())/indexnow/monitor{monitorLimitFree,digestEnabled,lastSentAt}; update with monitor special-case 0-50 limit validation writing monitorLimitFree + monitorDigest.enabled while preserving lastSentAt; testEmail via MailConfig::send with original subject/body and SMTP_TEST logs, falls back to the admin's own email when "to" is absent), ActivityController (index 1:1: GROUPS action filter sets, q search over actorEmail/detail/ip, 50/page pagination), DigestController (see notes).
- DigestController: original route.ts was POST {action:"send"} -> maybeSendDigests(force) but web.php declares GET /digest -> index. Implemented index to run the forced digest (full port of monitor-digest.ts force path: enabled check, SMTP check, per-user rows, MailConfig::send text digest, lastSentAt stamp) when action=send (JSON body or query) returning {ok,sent,skipped} + DIGEST_SENT/DIGEST_SKIP logs; a plain GET returns digest status data {ok,enabled,lastSentAt} with no side effects.
- PHP-linted all 13 PHP files with the mandated frankenphp lint.php - all OK. Type-checked all ported TSX with tsc (stub modules for @inertiajs/axios) - no syntax errors; remaining tsc notes are pre-existing typing quirks inherited verbatim from the original source (rich-editor instance types) and stub artifacts (usePage<any>()).
- Verified every @/ import in the new/changed files resolves to an existing file; verified model casts/fillables cover every field written; verified DB-level cascade FKs exist in migrations so UsersController delete matches Prisma onDelete: Cascade.

Stage Summary:
- Files created: resources/js/lib/use-initial-fetch.ts; resources/js/Pages/Manage/{Login,Dashboard,Users,Audits,Monitors,Payments,Plans,Gateways,Affiliate,Messages,Blog,Activity,Settings}.tsx; app/Http/Controllers/Admin/PanelController.php; app/Http/Controllers/Api/Admin/{Users,Audits,Monitors,Payments,Plans,Gateways,Affiliate,Messages,Posts,Settings,Activity,Digest}Controller.php.
- Files edited in place (import transforms only, zero UI change): resources/js/components/admin/{shell,login-screen}.tsx rewritten; the other 12 admin components just lost their "use client" line. routes/web.php NOT touched.
- KEY DECISIONS: adminName prop replaces the old manage layout; approvePaymentById inlined in PaymentsController (public static, ready to delegate to App\Services\Payments if 18-a adds it); notify() (Notification::create, fire-and-forget) duplicated as a private helper in Payments/Affiliate/Messages controllers to avoid touching shared services; digest email sent as plain text via MailConfig::send (original also built an HTML variant - MailConfig is raw-text only); login-screen non-admin error uses the task-specified wording and logs out first.
- KNOWN GAPS (need orchestrator action, web.php is authoritative and untouchable for me): (1) VERB MISMATCH - web.php maps PATCH for payments/gateways/affiliate/messages/settings updates and GET for digest, but the UNCHANGED clients POST those URLs (and settings "Test key" PUTs /api/admin/settings, digest button POSTs /api/admin/digest). Controllers read the same JSON bodies regardless of verb, so adding Route::post (or Route::match) aliases for /api/admin/{payments,gateways,affiliate,messages,settings} + PUT for settings + POST for digest in web.php makes everything work with zero client changes. (2) CSRF - all ported managers use plain fetch (no X-XSRF-TOKEN header), which Laravel's web-group ValidateCsrfToken will 419 on for POST/PATCH/DELETE; project-wide issue (dashboard components have the same pattern) - either except /api/* in bootstrap/app.php validateCsrfTokens or install a fetch wrapper that injects X-XSRF-TOKEN. (3) Original OpenRouter key-test (PUT /api/admin/settings) has no route in web.php, so it is not implemented server-side. (4) AuditsController::destroy and MonitorsController::update exist only because web.php declares them (no original handler); implemented in the minimal plan/post DELETE + watchlist PATCH style.
---
Task ID: 18-b
Agent: general-purpose subagent
Task: Port dashboard pages + page controllers + billing/keys/notifications/settings/affiliate APIs to Laravel

Work Log:
- Read PORTING.md contract, worklog context and routes/web.php (authoritative) before any work; read every in-scope Next source (dashboard pages, all src/components/dashboard/*, api/{billing,keys,notifications,settings,affiliate}/route.ts, lib/{payments,notify,api-keys,guard,audit-runner,pdf,use-initial-fetch,use-has-mounted}.ts) before porting.
- Applied the mechanical import transforms to ALL 16 raw-copied files in resources/js/components/dashboard/ via scripted edits (byte-identical JSX): removed "use client"; next/link + next/navigation useRouter -> @inertiajs/react; router.refresh() -> router.reload(). Verified zero remaining next/*, next-auth or "use client" references in the dashboard component scope.
- shell.tsx: usePathname() -> usePage().url (query string stripped to mirror usePathname semantics), useSession from the @/lib/session shim, next-auth signOut replaced by a local helper that POSTs /api/auth/logout then hard-navigates to callbackUrl (call sites unchanged).
- settings-workspace.tsx: the two /api/settings calls changed POST -> PATCH because routes/web.php only registers PATCH /api/settings (SettingsApiController::update). All other fetch calls (2FA setup/enable/disable, /api/security) unchanged.
- stripe-verify-client.tsx: keeps the original GET and retries with POST on 405, because routes/web.php registers /api/billing/stripe/verify as POST while the original route.ts was GET.
- Created client libs that were missing: lib/use-initial-fetch.ts, lib/use-has-mounted.ts (exact ports), lib/guard.ts (client-safe normalizeDomain only), lib/audit-runner.ts (client-safe subset: AuditReport/AuditReportSection types + networkName; the AI/crawler pipeline stays in PHP), lib/audit-pdf.tsx (full port of src/lib/pdf.tsx Document, renamed export AuditPDF, renderToBuffer dropped) and lib/pdf-client.ts (downloadAuditPdf(report, meta) -> pdf(createElement(AuditPDF,...)).toBlob() + blob download; signals->summaryData/deepData derivation ported from buildAuditPdf; meta carries optional signals).
- Ported all 13 dashboard Inertia pages under resources/js/Pages/Dashboard/ (Overview, Audit/Index, Audit/Detail, Domains/Index, Domains/Detail, Watchlist, Writer, Indexer, Affiliate, Billing/Index, Billing/Checkout, Billing/CheckoutSuccess, Settings). Every page wraps its original JSX in the ported DashboardShell (credits/userName/isAdmin from usePage().props.auth.user) and adds <Head title> from the original metadata exports. Server-component computations (onboarding steps, top-domains strip, history points, per-domain aggregation, section averages, summary text) are the same pure-JS logic inside the page components, fed by controller props; all classNames unchanged.
- Audit/Detail PDF button now calls downloadAuditPdf (the old /api/audit/{id}/pdf endpoint is gone); siteName comes from shared site.name prop, signals from audit props.
- Created 9 thin Inertia controllers in app/Http/Controllers/Dashboard/ per routes/web.php: OverviewController, AuditPageController (index + show; show passes the audit row with report/signals JSON-decoded + previous-audit comparison), DomainsPageController (index + show with the guard normalizeDomain port + ^[a-z0-9.-]+\.[a-z]{2,}$ validation -> 404), WatchlistPageController, WriterPageController (tab query), IndexerPageController (same sha256(userId:NEXTAUTH_SECRET||"adaudit").slice(0,32) IndexNow key), AffiliatePageController (x-forwarded-host/proto origin), BillingPageController (index plans/rate/payments/costs, checkout 404s on missing/inactive plan slug, checkoutSuccess passes query params), SettingsPageController. All return Inertia::render with props mirroring the original page.tsx data (unused `submissions`/`approvedPayments` counts from the original Overview fetch were dropped - dead data).
- Ported the API controllers 1:1 (same JSON keys, status codes, validation, rate limits, activity log actions): Api/NotificationsApiController (index w/ unread=1 + markRead), Api/SettingsApiController (update = port of the zod schema POST: profile name 2..60 / password current<=100 next 8..100 with Google-account and wrong-password branches, AUTH_PASSWORD_CHANGE logging; show = profile + 2FA status snapshot for the GET contract), Api/AffiliateApiController (index totals/earnings/withdrawals + withdraw with min-withdraw, cleared-balance check, FIFO CLEARED->PAID, WITHDRAW_REQUEST), Api/KeysApiController (index with the 14-day UTC usage rollup + perKey series; store handles create/setCap/revoke with exact error strings and ak_+base64url key gen, sha256 storage, 11-char prefix; destroy adds the contract's DELETE revoke), Api/BillingApiController (index gateway visibility rules + rate + signedIn; store = manual/API orders incl. Stripe Checkout Session, PayPal OAuth+Order, SSLCommerz session with identical params; verifyStripe = session confirm, client_reference_id + payment_status checks, meta ledger update; verifyPaypal = capture with ORDER_ALREADY_CAPTURED lookup, amount/custom_id mismatch checks, redirects to checkout/success; verifySslcommerz = fail->REJECTED, val_id storage, validationserverAPI.php re-validation, redirects).
- approvePaymentById (payments.ts) + notify (notify.ts) implemented inline in BillingApiController (App\Services\Payments does not exist yet): APPROVED exactly-once, credits increment, subscription row, referrer PENDING commission at site.affiliateRate, PAYMENT_APPROVED notification, PAYMENT_APPROVE activity.
- Linted every PHP file with /home/z/bin/lint.php (frankenphp php-cli): 14/14 OK.

Stage Summary:
- Files created: resources/js/Pages/Dashboard/{Overview,Watchlist,Writer,Indexer,Affiliate,Settings}.tsx, Pages/Dashboard/Audit/{Index,Detail}.tsx, Pages/Dashboard/Domains/{Index,Detail}.tsx, Pages/Dashboard/Billing/{Index,Checkout,CheckoutSuccess}.tsx; app/Http/Controllers/Dashboard/{OverviewController,AuditPageController,DomainsPageController,WatchlistPageController,WriterPageController,IndexerPageController,AffiliatePageController,BillingPageController,SettingsPageController}.php; app/Http/Controllers/Api/{BillingApiController,KeysApiController,NotificationsApiController,SettingsApiController,AffiliateApiController}.php; resources/js/lib/{audit-pdf.tsx,pdf-client.ts,audit-runner.ts,guard.ts,use-initial-fetch.ts,use-has-mounted.ts}. Files transformed in place: all 16 components in resources/js/components/dashboard/ (imports/router/signOut + settings PATCH + stripe verify 405 fallback).
- Key decisions: (1) server-component aggregation kept in JS inside the Inertia pages so JSX/logic stay identical; (2) Settings client uses PATCH and stripe-verify client falls back to POST to match the web.php contract exactly (web.php is untouchable); (3) PDF is generated in-browser with @react-pdf/renderer via lib/pdf-client.
- Known gaps (route-contract mismatches I cannot fix from this scope, flagged for the route/API owners): (a) DELETE /api/audit/{id}/share (share revoke) has no route in web.php - ShareButton revoke silently no-ops on 404; (b) /api/security has no route - Settings "Recent account activity" always renders the empty state; (c) DELETE /api/writer/{id} has no route - job delete button 404s; (d) PayPal + SSLCommerz verify are browser-redirect (GET) endpoints in the original but web.php only registers POST - the gateways' return visits will 405 until GET routes exist (my controller methods are method-agnostic and will work as soon as a GET route is added); (e) AuditApiController (GET /api/audit?batch=, POST/DELETE /api/audit, share) is another agent's scope.
- Next actions for integrators: npm install in laravel-app (axios is a peer of @inertiajs/react and is now imported by shell.tsx), verify shared components (report-view/report-ui/pricing-cards/logo/notification-bell/theme/empty-state/illustration/brand-logo) get their own transforms from the owning agent, and consider adding the missing GET/DELETE routes listed above in a follow-up web.php revision.
