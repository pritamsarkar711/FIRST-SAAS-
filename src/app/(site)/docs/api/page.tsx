import type { Metadata } from "next";
import { Terminal, KeyRound, Gauge, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Developer API | AdAudit",
  description: "Run AdSense readiness audits programmatically. Create a key, POST a domain, poll for the report. Same engine as the dashboard.",
};

const ENDPOINTS = [
  {
    method: "POST",
    path: "/api/v1/audits",
    body: `{ "domain": "myblog.com", "network": "ADSENSE", "mode": "STANDARD", "deep_scan": false }`,
    desc: "Starts one audit and deducts credits from your account balance. Returns 202 with the audit id. Poll the audit endpoint until status is done or failed.",
  },
  {
    method: "GET",
    path: "/api/v1/audits",
    body: null,
    desc: "Lists the 20 most recent audits on the account that owns the key, newest first. Useful for syncing your own dashboard.",
  },
  {
    method: "GET",
    path: "/api/v1/audits/{id}",
    body: null,
    desc: "Returns one audit. While it runs you get the status; when it is done you also get the full report JSON: probability, verdict, six section scores, strengths, risks, fixes and the roadmap.",
  },
];

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md bg-secondary px-4 py-3.5 font-mono text-[13px] leading-relaxed text-foreground">
      <code>{children}</code>
    </pre>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="border-b border-border px-3 py-2.5 text-left font-bold text-foreground">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="border-b border-border px-3 py-2.5 align-top text-muted-foreground">{children}</td>;
}

export default function ApiDocsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Developers</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">AdAudit API</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Run the same audit engine the dashboard uses, from your own code. Create a key in{" "}
          <a href="/dashboard/settings" className="font-semibold text-primary underline underline-offset-2">Settings</a>,
          POST a domain, poll for the report. Credits are deducted from your normal balance, one credit set per audit,
          exactly like in the app.
        </p>
      </header>

      {/* Quick start */}
      <section className="mt-10" aria-labelledby="quickstart">
        <h2 id="quickstart" className="flex items-center gap-2 text-xl font-bold text-foreground">
          <Terminal className="h-5 w-5 text-primary" aria-hidden="true" /> Quick start
        </h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>Sign in and open Settings, then Developer API, and create a key. The value is shown once, copy it.</li>
          <li>Send it as a bearer token on every request.</li>
          <li>Poll the audit endpoint every few seconds until the status is <code className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-xs">done</code>.</li>
        </ol>
        <div className="mt-5 space-y-3">
          <p className="text-sm font-bold text-foreground">1. Start an audit</p>
          <Code>{`curl -X POST https://your-domain.com/api/v1/audits \\
  -H "Authorization: Bearer ak_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"domain":"myblog.com","network":"ADSENSE","mode":"STANDARD"}'`}</Code>
          <p className="text-sm font-bold text-foreground">2. Poll for the report</p>
          <Code>{`curl https://your-domain.com/api/v1/audits/audit_id \\
  -H "Authorization: Bearer ak_YOUR_KEY"`}</Code>
          <p className="text-sm font-bold text-foreground">Example response, once finished</p>
          <Code>{`{
  "ok": true,
  "audit": {
    "id": "d2xk29fj3m",
    "domain": "myblog.com",
    "network": "ADSENSE",
    "mode": "standard",
    "status": "done",
    "probability": 78,
    "verdict": "WAIT_AND_IMPROVE"
  },
  "report": { "sections": [ /* six scored sections */ ],
              "fixes": [ /* prioritized fixes */ ] }
}`}</Code>
        </div>
      </section>

      {/* Endpoints */}
      <section className="mt-12" aria-labelledby="endpoints">
        <h2 id="endpoints" className="text-xl font-bold text-foreground">Endpoints</h2>
        <div className="mt-4 space-y-5">
          {ENDPOINTS.map((e) => (
            <div key={e.method + e.path} className="rounded-lg border border-border bg-card p-5">
              <p className="flex flex-wrap items-center gap-2">
                <span className={`rounded-sm px-2 py-0.5 font-mono text-xs font-bold ${e.method === "POST" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                  {e.method}
                </span>
                <code className="font-mono text-sm font-semibold text-foreground">{e.path}</code>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{e.desc}</p>
              {e.body && <div className="mt-3"><Code>{e.body}</Code></div>}
            </div>
          ))}
        </div>
      </section>

      {/* Parameters */}
      <section className="mt-12" aria-labelledby="params">
        <h2 id="params" className="text-xl font-bold text-foreground">Request parameters</h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr>
                <Th>Field</Th><Th>Required</Th><Th>Values</Th>
              </tr>
            </thead>
            <tbody>
              <tr><Td><code className="font-mono text-xs text-foreground">domain</code></Td><Td>Yes</Td><Td>The site to audit, e.g. myblog.com. No http, no path.</Td></tr>
              <tr><Td><code className="font-mono text-xs text-foreground">network</code></Td><Td>No</Td><Td>ADSENSE (default), EZOIC, MEDIAVINE, RAPTIVE.</Td></tr>
              <tr><Td><code className="font-mono text-xs text-foreground">mode</code></Td><Td>No</Td><Td>NORMAL, STANDARD (default), PREMIUM. Deeper modes cost more credits and review policy more closely.</Td></tr>
              <tr><Td><code className="font-mono text-xs text-foreground">deep_scan</code></Td><Td>No</Td><Td>true or false (default). Samples 10 articles instead of 3, reads every sitemap in the index, verifies the About, Contact, Privacy and Terms pages with real requests, and measures content freshness. Costs a surcharge on top of the mode price.</Td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Errors */}
      <section className="mt-12" aria-labelledby="errors">
        <h2 id="errors" className="text-xl font-bold text-foreground">Errors</h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr><Th>Status</Th><Th>Meaning</Th></tr>
            </thead>
            <tbody>
              <tr><Td><code className="font-mono text-xs text-foreground">400</code></Td><Td>Invalid domain or body. The error message says which field failed.</Td></tr>
              <tr><Td><code className="font-mono text-xs text-foreground">401</code></Td><Td>Missing, malformed, invalid or revoked key.</Td></tr>
              <tr><Td><code className="font-mono text-xs text-foreground">402</code></Td><Td>Not enough credits. Top up from the billing page.</Td></tr>
              <tr><Td><code className="font-mono text-xs text-foreground">403</code></Td><Td>The account that owns the key is suspended.</Td></tr>
              <tr><Td><code className="font-mono text-xs text-foreground">404</code></Td><Td>Audit id not found, or it belongs to another account.</Td></tr>
              <tr><Td><code className="font-mono text-xs text-foreground">429</code></Td><Td>Rate limit exceeded: 30 audit starts per 10 minutes per key.</Td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Notes */}
      <section className="mt-12" aria-labelledby="notes">
        <h2 id="notes" className="text-xl font-bold text-foreground">Good to know</h2>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <li className="flex gap-2.5">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span><strong className="text-foreground">Keys are hashed.</strong> We store only a sha256 hash, so a lost key cannot be recovered. Revoke it and create a new one. Up to five active keys per account.</span>
          </li>
          <li className="flex gap-2.5">
            <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span><strong className="text-foreground">Credits are shared.</strong> API calls spend the same balance as the dashboard, at the same per-mode rates shown before you run an audit.</span>
          </li>
          <li className="flex gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span><strong className="text-foreground">Same guards as the app.</strong> Domain validation, private-network protection and rate limits apply to API runs exactly as they do in the dashboard.</span>
          </li>
        </ul>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href="/dashboard/settings"
            className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 text-[15px] font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Create an API key
          </a>
          <a
            href="/pricing"
            className="inline-flex h-12 items-center justify-center rounded-md border border-border bg-card px-6 text-[15px] font-semibold text-foreground hover:bg-secondary"
          >
            See credit pricing
          </a>
        </div>
      </section>
    </div>
  );
}
