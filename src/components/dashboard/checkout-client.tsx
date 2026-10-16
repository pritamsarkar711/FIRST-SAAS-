"use client";

import { useInitialFetch } from "@/lib/use-initial-fetch";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleCheck, Coins, Wallet, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

interface Plan { id: string; name: string; slug: string; description: string | null; priceUsd: number; credits: number }
interface Gateway { code: string; name: string; logo: string | null; mode: string; instructions: string | null }

export function CheckoutClient({ plan }: { plan: Plan }) {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [rate, setRate] = useState(122);
  const [selected, setSelected] = useState<string | null>(null);
  const [txId, setTxId] = useState("");
  const [sender, setSender] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [currency, setCurrency] = useState<"USD" | "BDT">("USD");

  useEffect(() => {
    fetch("/api/billing").then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (d) { setGateways(d.gateways || []); setRate(d.rate || 122); }
    }).catch(() => {});
  }, []);

  const gw = gateways.find((g) => g.code === selected);
  const priceBdt = Math.round(plan.priceUsd * rate);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!gw) { setError("Choose a payment method first."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, gateway: gw.code, senderInfo: sender, txId, agreeTerms: agree }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Could not place the order."); return; }
      // API gateways (Stripe etc.) hand back a provider checkout URL.
      if (data.redirectUrl) {
        setDone("__redirect__");
        window.location.href = data.redirectUrl;
        return;
      }
      setDone(data.message || "Order received.");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done === "__redirect__") {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <span className="mx-auto block h-11 w-11 animate-spin rounded-full border-[3px] border-border border-t-primary" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-bold text-foreground">Taking you to {gw?.name}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Complete the card payment on the secure {gw?.name} page. You will come straight back here when it is done.
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <CircleCheck className="mx-auto h-11 w-11 text-ok" />
        <h1 className="mt-3 text-xl font-bold text-foreground">Order placed</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{done}</p>
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild className="rounded-md font-semibold"><Link href="/dashboard/billing">View payment status</Link></Button>
          <Button asChild variant="outline" className="rounded-md font-semibold"><Link href="/dashboard">Back to dashboard</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <h1 className="text-lg font-bold text-foreground">Choose payment method</h1>
        {gateways.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading available methods...</p>
        ) : (
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {gateways.map((g) => (
              <button key={g.code} type="button" onClick={() => setSelected(g.code)}
                className={cn("flex items-center gap-3 rounded-md border p-3.5 text-left transition-colors",
                  selected === g.code ? "border-primary bg-accent" : "border-border bg-card hover:border-input")}
                aria-pressed={selected === g.code}>
                <BrandLogo name={g.name} src={g.logo} size={24} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-foreground">{g.name}</span>
                  <span className="block text-xs text-muted-foreground">{g.mode === "MANUAL" ? "Send money + TrxID" : "Card / API checkout"}</span>
                </span>
                {selected === g.code && <CircleCheck className="h-4.5 w-4.5 shrink-0 text-primary" />}
              </button>
            ))}
          </div>
        )}

        {gw?.instructions && gw.mode === "MANUAL" && (
          <div className="mt-4 rounded-md border border-border bg-secondary/60 p-4">
            <p className="text-sm font-bold text-foreground">How to pay with {gw.name}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{gw.instructions}</p>
            <p className="mt-2 rounded-sm border border-dashed border-primary/40 bg-accent/60 px-3 py-2 text-center text-sm font-bold tracking-wide text-primary">
              0{gw.code === "bkash" ? "1" : gw.code === "nagad" ? "2" : "3"}7-XXXXXXX
              <span className="ml-2 font-normal text-muted-foreground">(configured by the admin in the manage panel)</span>
            </p>
          </div>
        )}

        <form onSubmit={submit} className="mt-4">
          {gw?.mode === "MANUAL" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="p-sender" className="mb-1.5 block text-sm font-semibold text-foreground">Sender number / name</label>
                <input id="p-sender" type="text" value={sender} onChange={(e) => setSender(e.target.value)} maxLength={80}
                  placeholder="01XXXXXXXXX" className="h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <div>
                <label htmlFor="p-txid" className="mb-1.5 block text-sm font-semibold text-foreground">Transaction ID (TrxID)</label>
                <input id="p-txid" type="text" value={txId} onChange={(e) => setTxId(e.target.value)} maxLength={80}
                  placeholder="From your payment receipt" className="h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
            </div>
          )}

          <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm text-muted-foreground">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0d6b4d]" />
            <span>I agree to the <Link href="/terms" target="_blank" className="font-semibold text-primary hover:underline">Terms</Link> and the{" "}
              <Link href="/refund" target="_blank" className="font-semibold text-primary hover:underline">Refund Policy</Link>.</span>
          </label>

          {error && <p className="mt-3 rounded-md bg-risk-soft px-3 py-2.5 text-sm font-medium text-risk" role="alert">{error}</p>}

          <Button type="submit" disabled={busy || !gw || !agree} className="mt-4 h-11 w-full rounded-md font-semibold">
            <Wallet className="mr-2 h-4.5 w-4.5" /> {busy ? "Placing order..." : gw?.mode === "API" ? `Continue to ${gw.name}` : `Place order (${currency === "USD" ? `$${plan.priceUsd.toFixed(2)}` : `৳${priceBdt.toLocaleString()}`})`}
          </Button>
        </form>
      </div>

      {/* Summary */}
      <div className="h-fit rounded-lg border border-border bg-card p-5 sm:p-6">
        <h2 className="font-bold text-foreground">Order summary</h2>
        <div className="mt-4 rounded-md border border-border bg-secondary/50 p-4">
          <p className="text-lg font-bold text-foreground">{plan.name} plan</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{plan.description}</p>
          <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-primary"><Coins className="h-4 w-4" /> {plan.credits.toLocaleString()} credits</p>
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">Price (USD)</dt><dd className="font-bold text-foreground">${plan.priceUsd.toFixed(2)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Price (BDT)</dt><dd className="font-bold text-foreground">৳{priceBdt.toLocaleString()}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Rate used</dt><dd className="text-foreground">1 USD = ৳{Math.round(rate).toLocaleString()}</dd></div>
        </dl>
        <div className="mt-4 flex gap-1 rounded-md border border-border bg-secondary p-1" role="tablist" aria-label="Currency">
          {(["USD", "BDT"] as const).map((c) => (
            <button key={c} role="tab" aria-selected={currency === c} onClick={() => setCurrency(c)}
              className={cn("flex-1 rounded-sm px-3 py-1.5 text-sm font-bold", currency === c ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              {c}
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-md bg-accent/60 p-3.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Manual payments are verified after the transaction is confirmed on the gateway. Credits appear automatically once approved.
          </p>
        </div>
      </div>
    </div>
  );
}
