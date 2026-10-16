# Deploying Audit Form on Hostinger (Business shared plan)

Hostinger supports Node.js web apps on **Business Web Hosting** and all Cloud
plans (Node 18/20/22/24), deployed from a GitHub repository or a zip upload.
This project is configured for that: `output: "standalone"` is already set in
`next.config.ts`, and the MySQL schema variant ships in
`prisma/schema.mysql.prisma`.

## Option A (automated): GitHub Actions deploy — recommended

The repo ships `.github/workflows/deploy-hostinger.yml`. It builds the
Next.js standalone bundle on GitHub's runner, rsyncs it over SSH to
`~/auditform/app`, pushes the Prisma schema to MySQL, restarts the Node
process and wires the domain. Every push to `main` auto-deploys.

Set these repository **Secrets** (Settings → Secrets and variables → Actions):

| Secret                 | Value                                                |
| ---------------------- | ---------------------------------------------------- |
| `SSH_HOST`             | `your.server.ip`                                      |
| `SSH_PORT`             | your SSH port                                              |
| `SSH_USER`             | your Hostinger SSH username                          |
| `SSH_PASSWORD`         | your Hostinger SSH password                          |
| `DATABASE_URL`         | `mysql://USER:PASS@HOST:3306/DBNAME` (URL-encode special chars in the password) |
| `NEXTAUTH_SECRET`      | `openssl rand -base64 32`                            |
| `NEXT_PUBLIC_SITE_URL` | `https://yourdomain.com`                             |
| `ADMIN_EMAIL`          | your admin login email                               |
| `ADMIN_PASSWORD`       | strong admin password                                |

Then either push to `main`, or run **Actions → Deploy to Hostinger → Run
workflow**. Use `mode: survey` first for a read-only server inspection; the
output appears in the Actions log. If the server-side health check passes but
the public URL does not respond, LiteSpeed on your server does not allow
`.htaccess` proxying — then create the app through hPanel (Option B) and point
it at the same repo.

## Option B: hPanel Node.js app (manual)

## 1. Prepare the database

1. hPanel → **Databases → MySQL databases**. Create a database and user.
2. Note the full connection details. The remote host is usually
   `mysql-<xyz>.hostinger.com` or `localhost` from inside the app.

## 2. Prepare the repository

```bash
# one-time: switch the Prisma schema to the MySQL variant
cp prisma/schema.mysql.prisma prisma/schema.prisma
```

Copy `.env.example` to `.env` and fill in (do not commit the real `.env`):

| Variable             | Value                                                        |
| -------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`       | `mysql://USER:PASSWORD@HOST:3306/DBNAME`                     |
| `NEXTAUTH_SECRET`    | `openssl rand -base64 32`                                    |
| `AUTH_TRUST_HOST`    | `true` (never hardcode `NEXTAUTH_URL` — it caused redirect loops behind proxies) |
| `NEXT_PUBLIC_SITE_URL` | `https://yourdomain.com`                                   |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | your real admin login (seeded on first request)  |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional, enables "Sign in with Google" |

Push the repository to GitHub (public or private via the GitHub integration).

## 3. Create the Node.js app in hPanel

1. **Websites → Create Website → Web App** (Business plan).
2. Choose **Import Git Repository**, authorize GitHub, pick the repo.
3. Hostinger auto-detects Next.js. If asked, set:
   - **Node.js version:** 20.x or 22.x
   - **Install command:** `npm install` (runs `prisma generate` via postinstall)
   - **Build command:** `npm run build` (creates `.next/standalone` and copies `static` + `public` into it)
   - **Start command:** `npm run start:prod` (first pushes the Prisma schema
     to MySQL, then boots the standalone server — no manual terminal step)
4. Add the environment variables from step 2 in the app's **Environment** settings.
5. Deploy. The start command pushes the schema automatically; check the app
   logs for `[start] WARN` if the DATABASE_URL is wrong.

## 4. First-run checklist

- Open the site — plans, gateways and settings seed automatically.
- Log in at `/manage/login` with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- **/manage/settings**: add your OpenRouter API key (AI calls use it on
  Hostinger; the sandbox z-ai fallback does not exist there), set SMTP for
  emails, review credit costs, enable payment gateways and add their keys.
- **/manage/settings → Google**: paste OAuth client id/secret; add
  `https://yourdomain.com/api/auth/callback/google` as the redirect URI in
  Google Cloud Console.
- Change the admin password (or rely on `ADMIN_PASSWORD`).
- Create the SSL certificate (hPanel → Security → SSL) and force HTTPS.

## 5. Site monitoring (scheduled re-audits)

Monitors normally tick when someone opens the dashboard. To keep them running
without visitors, add a Hostinger **cron job** (hPanel → Advanced → Cron jobs)
every 10–15 minutes:

```bash
curl -s https://yourdomain.com/api/watchlist/tick >/dev/null
```

## 6. Notes & limits

- **SQLite vs MySQL:** sandbox development uses SQLite
  (`file:./db/custom.db`); production uses the MySQL variant. Both files stay
  in sync — when you change `schema.prisma`, mirror the change in
  `schema.mysql.prisma`.
- **Generated images:** the content writer saves AI images under
  `public/generated/<jobId>/` at runtime. On the standalone server this writes
  inside the app directory — fine on Hostinger's managed Node.js hosting.
- **Payments:** bKash/Nagad/Rocket work in manual-verification mode with no
  API keys; SSLCommerz/ShurjoPay/AamarPay/Stripe/PayPal/Paddle activate once
  keys are added in /manage/gateways.
- **Email:** set SMTP in /manage/settings (Hostinger offers free email
  accounts; use those SMTP credentials).
