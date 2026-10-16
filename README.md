# Audit Form

AI-powered website audit SaaS built with **Next.js 16 (App Router) + TypeScript + Prisma**.

Enter a domain, get a deep AI audit with an **AdSense approval probability score**, color-coded findings (green / orange / red), a prioritized fix roadmap, and a **branded downloadable PDF report**.

## Modules

1. **Audit tool** — single & batch audits, 3 AI modes (Normal / Standard / Premium), deep scan
2. **Ad network readiness** — AdSense / Ezoic / Mediavine / Raptive readiness detection
3. **AdSense content writer** — 17-policy-rule prompt engine, AI images, WordPress publishing
4. **Affiliate content writer**
5. **Quick index** — IndexNow fast indexing
6. **Blog** — public blog + admin manager
7. **Contact page**
8. **Subscriptions & credits** — USD pricing + live BDT conversion, bKash / Nagad / Rocket / Stripe / PayPal / SSLCommerz
9. **/manage/ admin panel** — users, audits, monitors, payments, plans, gateways, affiliate (20% commission), messages, blog, activity, settings

Extras: branded PDF reports, scheduled watchlist re-audits, developer REST API with daily key caps, 2FA + Google OAuth, email digests.

## Tech stack

- Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui
- Prisma ORM — SQLite (dev) / **MySQL (production)** via `prisma/schema.mysql.prisma`
- NextAuth v4 (credentials + Google + TOTP 2FA) · OpenRouter AI · Nodemailer

## Local development

```bash
npm install
cp .env.example .env   # fill DATABASE_URL (SQLite) + NEXTAUTH_SECRET
npx prisma db push
npm run dev
```

## Deployment

Full step-by-step guide for **Hostinger Business shared plan** (MySQL + Node.js app): see [DEPLOY.md](./DEPLOY.md).
