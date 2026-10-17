# PORTING.md — Next.js → Laravel 12 + Inertia 2 + React conventions

This document is the CONTRACT for porting the Next.js AdAudit app
(`/home/z/my-project/src/**`) into the Laravel app
(`/home/z/my-project/laravel-app/**`).

The Laravel app renders the SAME React components through Inertia. The
backend is PHP (Eloquent + controllers) with the SAME `/api/*` JSON
contracts, so most client code keeps working with only import changes.

## Directory mapping

| Next.js | Laravel app |
|---|---|
| `src/app/(site)/**/page.tsx` | `resources/js/Pages/Site/*.tsx` (Home is `Pages/Home.tsx`) |
| `src/app/login/page.tsx` | `resources/js/Pages/Auth/Login.tsx` |
| `src/app/register/page.tsx` | `resources/js/Pages/Auth/Register.tsx` |
| `src/app/dashboard/**/page.tsx` | `resources/js/Pages/Dashboard/*.tsx` |
| `src/app/manage/(panel)/**/page.tsx` | `resources/js/Pages/Manage/*.tsx` |
| `src/app/manage/login/page.tsx` | `resources/js/Pages/Manage/Login.tsx` |
| `src/app/share/[token]/page.tsx` | `resources/js/Pages/Share/Report.tsx` |
| `src/components/**` | `resources/js/components/**` (already copied 1:1, ui/ + shared/ included) |
| `src/hooks/**`, `src/lib/utils.ts` | `resources/js/hooks/**`, `resources/js/lib/utils.ts` (copied) |
| `src/lib/*.ts` (server libs) | `app/Services/*.php` |
| `src/app/api/**/route.ts` | controllers in `app/Http/Controllers/Api/**` (see `routes/web.php` for the FULL route contract) |

## Page → route mapping (Inertia names)

Inertia page name = the argument of `Inertia::render()` in the controller.
The `routes/web.php` file lists every route + controller + method — the
contract is authoritative. Page components:

- `/` → `Home`
- `/login` → `Auth/Login`, `/register` → `Auth/Register`
- `/pricing` → `Site/Pricing`, `/features` → `Site/Features`, `/how-it-works` → `Site/HowItWorks`, `/tools` → `Site/Tools`, `/sample-report` → `Site/SampleReport`, `/about` → `Site/About`, `/terms` → `Site/Terms`, `/privacy` → `Site/Privacy`, `/refund` → `Site/Refund`, `/docs/api` → `Site/DocsApi`
- `/blog` → `Site/Blog/Index`, `/blog/{slug}` → `Site/Blog/Show`
- `/contact` → `Site/Contact`
- `/share/{token}` → `Share/Report`
- `/dashboard` → `Dashboard/Overview`, `/dashboard/audit` → `Dashboard/Audit/Index`, `/dashboard/audit/{id}` → `Dashboard/Audit/Detail`, `/dashboard/domains` → `Dashboard/Domains/Index`, `/dashboard/domains/{domain}` → `Dashboard/Domains/Detail`, `/dashboard/watchlist` → `Dashboard/Watchlist`, `/dashboard/writer` → `Dashboard/Writer`, `/dashboard/indexer` → `Dashboard/Indexer`, `/dashboard/affiliate` → `Dashboard/Affiliate`, `/dashboard/billing` → `Dashboard/Billing/Index`, `/dashboard/billing/checkout` → `Dashboard/Billing/Checkout`, `/dashboard/billing/checkout/success` → `Dashboard/Billing/CheckoutSuccess`, `/dashboard/settings` → `Dashboard/Settings`
- `/manage` → `Manage/Dashboard`, `/manage/users` → `Manage/Users`, `/manage/audits` → `Manage/Audits`, `/manage/monitors` → `Manage/Monitors`, `/manage/payments` → `Manage/Payments`, `/manage/plans` → `Manage/Plans`, `/manage/gateways` → `Manage/Gateways`, `/manage/affiliate` → `Manage/Affiliate`, `/manage/messages` → `Manage/Messages`, `/manage/blog` → `Manage/Blog`, `/manage/activity` → `Manage/Activity`, `/manage/settings` → `Manage/Settings`, `/manage/login` → `Manage/Login`

## Import transforms (mechanical)

1. `import Link from "next/link"` → `import { Link } from "@inertiajs/react"`
2. `import { useRouter } from "next/navigation"` → `import { useRouter } from "@inertiajs/react"`
   - `router.push(url)` → `router.visit(url)`
   - `router.replace(url)` → `router.replace(url)` (exists)
   - `router.refresh()` → `router.reload()`
   - `router.back()` → unchanged
3. `usePathname()` from next/navigation → `usePage().url`
4. `useSearchParams()` from next/navigation → the page controller passes
   `params` prop (`request->query()`); read from props instead. When the
   value is also needed for navigation links build it from
   `usePage().url` or the `params` prop.
5. `import Image from "next/image"` → plain `<img>` (copy width/height;
   `className` unchanged).
6. `import { useSession, signIn, signOut } from "next-auth/react"`:
   - `useSession()` → `import { useSession } from "@/lib/session"` (shim
     exists, same shape: `{ data: { user } | null, status }`).
   - `signIn("credentials", {...})` → `axios.post("/api/auth/login", {...})`
     (`import axios from "axios"` — available via @inertiajs/react).
     Response 401 with `error === "2FA_REQUIRED"` → show code field (same
     logic as before). Response `403 error === "ACCOUNT_SUSPENDED"` →
     show `message`.
   - `signIn("google", { callbackUrl })` → `window.location.href = "/auth/google/redirect"`
   - `signOut({ callbackUrl })` → `axios.post("/api/auth/logout").then(() => window.location.href = callbackUrl || "/")`
7. `"use client"` directives → DELETE (everything is a client bundle).
8. `metadata` exports in pages → DELETE (title handled by Inertia `<Head>`
   or blade default).
9. `process.env.NEXT_PUBLIC_X` → `import.meta.env.VITE_X` (rarely used).
10. `redirect()` from `next/navigation` (server) → not needed client-side;
    controllers handle redirects.
11. `next/font` → NOT used (Telenor fonts load via blade preload + CSS
    @font-face already in app.css).
12. Server-only imports (`@/lib/db`, `@/lib/auth`, `ensureSeeded` etc.)
    inside pages → DELETE; the Laravel controller provides the data as
    props.
13. `@/lib/pdf` (react-pdf Document) → keep as client-side component; PDF
    download becomes in-browser: fetch report JSON already in page props /
    state, then `pdf(<AuditPDF .../>).toBlob()` from `@react-pdf/renderer`
    and trigger a download (helper provided in `lib/pdf-client.ts`).

## Data fetching (UNCHANGED)

Client components call the same endpoints with `fetch("/api/...")` and the
Laravel API controllers return the SAME JSON shapes (ports of each
`route.ts`). Do NOT restructure API responses. Dates: Prisma returned ISO
strings; Laravel Eloquent serializes datetimes as ISO too
(`2026-10-17T03:12:45.000000Z`) — `date-fns` parses both, no change needed.
IDs are ULID strings — opaque, same as cuid.

## Inertia page skeleton

Every page keeps its original component tree. Wrap public pages in the
site layout when the original `(site)` layout did:

```tsx
import SiteLayout from "@/components/site-shell"; // ported from (site)/layout.tsx content

export default function Pricing() { return <SiteLayout>{/* original JSX */}</SiteLayout>; }
```

Dashboard pages keep using the ported dashboard shell component inside the
page (same as the original dashboard/layout.tsx). Manage pages use the
ported admin shell.

`usePage()` typing: use `usePage<any>()` or loose types — the project
compiles without strict types.

## Controllers

- Namespace mirrors the route file: see `routes/web.php` — it is the
  authoritative contract. Controller = `app/Http/Controllers/<Namespace>/<Name>.php`.
- Port each `route.ts` handler 1:1: same validation, same status codes,
  same JSON keys, same credit costs (`App\Services\Credits::getCosts()`),
  same settings access (`App\Services\Settings::get/set`), same activity
  logging (`App\Services\Activity::log([...])`).
- Auth: `$request->user()` (401 JSON `['error' => 'Unauthorized']` when
  missing). Admin API controllers rely on the `auth` + `admin` middleware.
- Credits: `Credits::deduct($userId, $amount)` returns bool (atomic).
- Inertia pages return `Inertia::render('Page/Name', [...props])`.
- Services available (already ported, do NOT recreate):
  `Settings`, `Credits`, `Activity`, `Password`, `SafeUrl`, `Prompts`,
  `Totp`, `MailConfig`. `App\Models\*` cover every table.

## Response/status codes must match the original route.ts files exactly.
Read each `src/app/api/**/route.ts` file carefully before writing its
controller.

## Verification (MANDATORY for every agent)

- PHP syntax check EVERY PHP file you create or edit:
  `cd /home/z/my-project/laravel-app && /home/z/bin/frankenphp php-cli /home/z/bin/lint.php <file.php>`
  Exit 0 = OK. Fix all PARSE ERRORs before finishing.
- Do NOT start dev servers, do NOT run `git` commands, do NOT touch files
  outside your assigned scope.
- React/TS files cannot be compiled locally — write carefully and keep
  imports correct (missing imports are the #1 risk).
