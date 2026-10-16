"use client";

import { useInitialFetch } from "@/lib/use-initial-fetch";
import { useCallback, useEffect, useState } from "react";
import { CreditCard, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

interface GatewayRow {
  id: string;
  code: string;
  name: string;
  logo: string | null;
  enabled: boolean;
  mode: string;
  instructions: string | null;
  config: string;
}

function configHint(code: string): string {
  if (code === "stripe") return '{"secretKey":"sk_live_..."}';
  if (code === "sslcommerz") return '{"store_id":"...","store_password":"...","env":"sandbox"}';
  if (code === "paypal") return '{"clientId":"...","clientSecret":"...","env":"sandbox"}';
  return '{"api_key":"..."}';
}

function configHelp(code: string): string {
  if (code === "stripe") {
    return "Paste your Stripe secret key. When enabled, checkout redirects the buyer to Stripe's hosted card page and credits are granted automatically after verification. Use sk_test_ keys to try it safely first.";
  }
  if (code === "paypal") {
    return 'PayPal REST app credentials from developer.paypal.com. Set "env":"sandbox" while testing and "env":"live" for real money. Checkout redirects the buyer to PayPal and credits are granted automatically after the order is captured.';
  }
  if (code === "sslcommerz") {
    return 'SSLCommerz store credentials from the merchant panel. Set "env":"sandbox" while testing and "env":"live" for real money. Checkout redirects the buyer to SSLCommerz\'s hosted page (cards, bKash, Nagad and more) and credits are granted automatically after the transaction is validated server-side.';
  }
  return "JSON keys for this provider. Checkout switches to automatic API mode as soon as the required keys are present.";
}

export function GatewaysManager() {
  const [gateways, setGateways] = useState<GatewayRow[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ instructions: string; config: string }>({ instructions: "", config: "{}" });
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/gateways");
    const d = await res.json().catch(() => ({}));
    setGateways(d.gateways || []);
  }, []);
  useInitialFetch(load);

  async function toggle(gw: GatewayRow) {
    await fetch("/api/admin/gateways", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: gw.id, enabled: !gw.enabled }),
    });
    void load();
  }

  function startEdit(gw: GatewayRow) {
    setEditing(gw.id);
    setDraft({ instructions: gw.instructions || "", config: gw.config || "{}" });
  }

  async function save(gwId: string) {
    const res = await fetch("/api/admin/gateways", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: gwId, instructions: draft.instructions, config: draft.config }),
    });
    const d = await res.json().catch(() => ({}));
    setMsg(res.ok ? "Gateway saved." : d.error || "Save failed.");
    setEditing(null);
    void load();
    setTimeout(() => setMsg(""), 2000);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Payment gateways</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Manual rails (bKash, Nagad, Rocket) need only your wallet number in the instructions. API gateways accept their keys as JSON.
        </p>
      </div>

      {msg && <p className="flex items-center gap-1.5 rounded-md bg-ok-soft px-3 py-2 text-sm font-semibold text-ok"><CircleCheck className="h-4 w-4" /> {msg}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {gateways.map((gw) => (
          <div key={gw.id} className={cn("rounded-lg border bg-card p-5", gw.enabled ? "border-primary/50" : "border-border")}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <BrandLogo name={gw.name} src={gw.logo} size={26} />
                <div>
                  <p className="font-bold text-foreground">{gw.name}</p>
                  <p className="text-xs text-muted-foreground">{gw.mode === "MANUAL" ? "Manual verification" : "API checkout"} · {gw.code}</p>
                </div>
              </div>
              <button onClick={() => void toggle(gw)} role="switch" aria-checked={gw.enabled}
                className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", gw.enabled ? "bg-primary" : "bg-input")} aria-label={`${gw.enabled ? "Disable" : "Enable"} ${gw.name}`}>
                <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all", gw.enabled ? "left-[22px]" : "left-0.5")} />
              </button>
            </div>

            {editing === gw.id ? (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-foreground">Checkout instructions shown to users</label>
                  <textarea rows={3} value={draft.instructions} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })}
                    className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Send money to 01712-345678, then submit the TrxID here..." />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-foreground">API config (JSON keys for this provider)</label>
                  <textarea rows={4} value={draft.config} onChange={(e) => setDraft({ ...draft, config: e.target.value })}
                    className="w-full rounded-md border border-input bg-card px-3 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder={configHint(gw.code)} />
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{configHelp(gw.code)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void save(gw.id)} className="rounded-md font-semibold">Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)} className="rounded-md font-semibold">Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <p className="line-clamp-2 text-sm text-muted-foreground">{gw.instructions || "No instructions set yet."}</p>
                <button onClick={() => startEdit(gw)} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                  <CreditCard className="h-3.5 w-3.5" /> Configure
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
