"use client";

import { useInitialFetch } from "@/lib/use-initial-fetch";
import { useCallback, useEffect, useState } from "react";
import { CircleCheck, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "site", label: "Site" },
  { key: "ai", label: "AI and models" },
  { key: "prompts", label: "Prompts" },
  { key: "costs", label: "Credit costs" },
  { key: "google", label: "Google sign-in" },
  { key: "smtp", label: "Email (SMTP)" },
  { key: "monitor", label: "Monitoring" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

interface SettingsShape {
  site: { name: string; tagline: string; supportEmail: string; usdBdt: number; usdBdtAuto: boolean; affiliateRate: number; minWithdrawUsd: number };
  ai: { openrouterKey: string; models: { normal: string; standard: string; premium: string }; writerModels: { standard: string; premium: string } };
  prompts: { audit: string; writer: string; affiliate: string };
  costs: { audit: { normal: number; standard: number; premium: number }; writer: { standard: number; premium: number }; index: number; signupBonus: number };
  google: { clientId: string; clientSecret: string };
  smtp: { host: string; port: number; user: string; pass: string; from: string };
  monitor: { monitorLimitFree: number; digestEnabled: boolean; lastSentAt: string };
}

export function SettingsManager() {
  const [tab, setTab] = useState<TabKey>("site");
  const [data, setData] = useState<SettingsShape | null>(null);
  const [msg, setMsg] = useState("");
  const [testResult, setTestResult] = useState("");
  const [digestResult, setDigestResult] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/settings");
    if (res.ok) setData(await res.json());
  }, []);
  useInitialFetch(load);

  async function save(key: TabKey) {
    if (!data) return;
    const res = await fetch("/api/admin/settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: data[key] }),
    });
    const d = await res.json().catch(() => ({}));
    setMsg(res.ok ? "Settings saved." : d.error || "Save failed.");
    setTimeout(() => setMsg(""), 2000);
  }

  async function testKey() {
    if (!data) return;
    setTestResult("Testing...");
    const res = await fetch("/api/admin/settings", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openrouterKey: data.ai.openrouterKey }),
    });
    const d = await res.json().catch(() => ({}));
    setTestResult(res.ok && d.ok ? "Key works." : d.error || "Key failed.");
  }

  async function sendDigest() {
    setDigestResult("Sending...");
    const res = await fetch("/api/admin/digest", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send" }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.sent > 0) {
      setDigestResult(`Sent ${d.sent} digest email${d.sent === 1 ? "" : "s"}.`);
    } else if (res.ok) {
      setDigestResult(d.skipped || "Nothing was sent.");
    } else {
      setDigestResult(d.error || "Send failed.");
    }
  }

  if (!data) return <div className="h-96 animate-pulse rounded-lg bg-muted" />;

  const upd = (key: TabKey, patch: Record<string, unknown>) =>
    setData({ ...data, [key]: { ...(data[key] as object), ...patch } } as SettingsShape);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Platform settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">API keys, models, prompts and pricing live here.</p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-md border border-border bg-secondary p-1" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={cn("rounded-sm px-3.5 py-2 text-sm font-bold", tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      {msg && <p className="flex items-center gap-1.5 rounded-md bg-ok-soft px-3 py-2 text-sm font-semibold text-ok"><CircleCheck className="h-4 w-4" /> {msg}</p>}

      <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
        {tab === "site" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Site name" value={data.site.name} onChange={(v) => upd("site", { name: v })} />
            <Field label="Support email" value={data.site.supportEmail} onChange={(v) => upd("site", { supportEmail: v })} />
            <Field label="Tagline" value={data.site.tagline} onChange={(v) => upd("site", { tagline: v })} wide />
            <Field label="Fallback USD to BDT rate" type="number" value={String(data.site.usdBdt)} onChange={(v) => upd("site", { usdBdt: Number(v) })} />
            <Check label="Fetch live exchange rate automatically" checked={data.site.usdBdtAuto} onChange={(v) => upd("site", { usdBdtAuto: v })} />
            <Field label="Affiliate commission %" type="number" value={String(data.site.affiliateRate)} onChange={(v) => upd("site", { affiliateRate: Number(v) })} />
            <Field label="Minimum withdrawal USD" type="number" value={String(data.site.minWithdrawUsd)} onChange={(v) => upd("site", { minWithdrawUsd: Number(v) })} />
          </div>
        )}

        {tab === "ai" && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">OpenRouter API key</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input type="password" value={data.ai.openrouterKey} onChange={(e) => upd("ai", { openrouterKey: e.target.value })}
                  placeholder="sk-or-v1-..." className="h-11 flex-1 rounded-md border border-input bg-card px-3 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                <Button type="button" variant="outline" onClick={testKey} className="h-11 rounded-md font-semibold">Test key</Button>
              </div>
              {testResult && <p className={cn("mt-2 text-sm font-semibold", testResult === "Key works." ? "text-ok" : "text-risk")}>{testResult}</p>}
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                When a key is set, all audits and articles run through OpenRouter with your chosen models below. Without a key, the built-in provider is used so the site keeps working.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Audit model: Normal" value={data.ai.models.normal} onChange={(v) => upd("ai", { models: { ...data.ai.models, normal: v } })} mono />
              <Field label="Audit model: Standard" value={data.ai.models.standard} onChange={(v) => upd("ai", { models: { ...data.ai.models, standard: v } })} mono />
              <Field label="Audit model: Premium" value={data.ai.models.premium} onChange={(v) => upd("ai", { models: { ...data.ai.models, premium: v } })} mono />
              <Field label="Writer model: Standard" value={data.ai.writerModels.standard} onChange={(v) => upd("ai", { writerModels: { ...data.ai.writerModels, standard: v } })} mono />
              <Field label="Writer model: Premium" value={data.ai.writerModels.premium} onChange={(v) => upd("ai", { writerModels: { ...data.ai.writerModels, premium: v } })} mono />
            </div>
            <p className="rounded-md bg-accent/60 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
              Good picks: google/gemini-2.5-flash (cheap), openai/gpt-4.1 (balanced), anthropic/claude-sonnet-4 (deep). Model IDs must exist on OpenRouter.
            </p>
          </div>
        )}

        {tab === "prompts" && (
          <div className="space-y-5">
            <p className="rounded-md bg-accent/60 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
              These master prompts drive the audit and the writers. The JSON output format at the end of each prompt must stay valid JSON for the parser.
            </p>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">Audit master prompt</label>
              <textarea rows={10} value={data.prompts.audit} onChange={(e) => upd("prompts", { audit: e.target.value })}
                className="w-full rounded-md border border-input bg-card px-3 py-2.5 font-mono text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">Content writer prompt</label>
              <textarea rows={10} value={data.prompts.writer} onChange={(e) => upd("prompts", { writer: e.target.value })}
                className="w-full rounded-md border border-input bg-card px-3 py-2.5 font-mono text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">Affiliate writer prompt</label>
              <textarea rows={10} value={data.prompts.affiliate} onChange={(e) => upd("prompts", { affiliate: e.target.value })}
                className="w-full rounded-md border border-input bg-card px-3 py-2.5 font-mono text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
          </div>
        )}

        {tab === "costs" && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Audit: Normal" type="number" value={String(data.costs.audit.normal)} onChange={(v) => upd("costs", { audit: { ...data.costs.audit, normal: Number(v) } })} />
            <Field label="Audit: Standard" type="number" value={String(data.costs.audit.standard)} onChange={(v) => upd("costs", { audit: { ...data.costs.audit, standard: Number(v) } })} />
            <Field label="Audit: Premium" type="number" value={String(data.costs.audit.premium)} onChange={(v) => upd("costs", { audit: { ...data.costs.audit, premium: Number(v) } })} />
            <Field label="Article: Standard" type="number" value={String(data.costs.writer.standard)} onChange={(v) => upd("costs", { writer: { ...data.costs.writer, standard: Number(v) } })} />
            <Field label="Article: Premium" type="number" value={String(data.costs.writer.premium)} onChange={(v) => upd("costs", { writer: { ...data.costs.writer, premium: Number(v) } })} />
            <Field label="IndexNow batch" type="number" value={String(data.costs.index)} onChange={(v) => upd("costs", { index: Number(v) })} />
            <Field label="Signup bonus credits" type="number" value={String(data.costs.signupBonus)} onChange={(v) => upd("costs", { signupBonus: Number(v) })} />
          </div>
        )}

        {tab === "google" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Google OAuth client ID" value={data.google.clientId} onChange={(v) => upd("google", { clientId: v })} mono wide />
            <Field label="Google OAuth client secret" type="password" value={data.google.clientSecret} onChange={(v) => upd("google", { clientSecret: v })} mono wide />
            <p className="rounded-md bg-accent/60 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground sm:col-span-2">
              In Google Cloud Console create OAuth credentials and add <code className="font-mono font-semibold">{typeof window !== "undefined" ? window.location.origin : ""}/api/auth/callback/google</code> as an authorized redirect URI. The Sign in with Google button appears automatically once both fields are saved.
            </p>
          </div>
        )}

        {tab === "smtp" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SMTP host" value={data.smtp.host} onChange={(v) => upd("smtp", { host: v })} mono />
            <Field label="SMTP port" type="number" value={String(data.smtp.port)} onChange={(v) => upd("smtp", { port: Number(v) })} />
            <Field label="SMTP user" value={data.smtp.user} onChange={(v) => upd("smtp", { user: v })} mono />
            <Field label="SMTP password" type="password" value={data.smtp.pass} onChange={(v) => upd("smtp", { pass: v })} mono />
            <Field label="From address" value={data.smtp.from} onChange={(v) => upd("smtp", { from: v })} mono wide />
            <p className="rounded-md bg-accent/60 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground sm:col-span-2">
              Used for contact form replies. Hostinger Business plans include email accounts: create one, then use smtp.hostinger.com port 465.
            </p>
          </div>
        )}

        {tab === "monitor" && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Free accounts: monitored domains" type="number" value={String(data.monitor.monitorLimitFree)} onChange={(v) => upd("monitor", { monitorLimitFree: Number(v) })} />
              <div className="flex items-end pb-1 text-xs leading-relaxed text-muted-foreground">
                What a user can monitor before buying a plan. Paid plans set their own limit on each plan row.
              </div>
            </div>
            <div className="border-t border-border pt-4">
              <h2 className="text-sm font-bold text-foreground">Weekly digest email</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Once a week, every member with monitored domains receives a summary of last scores and upcoming checks. Requires SMTP above, and it rides on the same automation cron that runs scheduled checks (POST /api/watchlist/tick with the key from Site monitoring log).
              </p>
              <div className="mt-3">
                <Check label="Send the weekly monitoring digest" checked={data.monitor.digestEnabled} onChange={(v) => upd("monitor", { digestEnabled: v })} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={sendDigest} className="rounded-md font-semibold">Send digest now</Button>
                <span className="text-xs text-muted-foreground">
                  {data.monitor.lastSentAt
                    ? `Last sent ${new Date(data.monitor.lastSentAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                    : "Never sent"}
                </span>
              </div>
              {digestResult && <p className="mt-2 text-sm font-semibold text-foreground">{digestResult}</p>}
            </div>
          </div>
        )}

        <div className="mt-6 border-t border-border pt-5">
          <Button onClick={() => void save(tab)} className="rounded-md px-6 font-semibold">
            <Save className="mr-2 h-4 w-4" /> Save {TABS.find((t) => t.key === tab)?.label}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", wide, mono }: { label: string; value: string; onChange: (v: string) => void; type?: string; wide?: boolean; mono?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="mb-1.5 block text-sm font-semibold text-foreground">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className={cn("h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", mono && "font-mono text-sm")} />
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2.5 text-sm font-semibold text-foreground sm:col-span-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[#0d6b4d]" />
      {label}
    </label>
  );
}
