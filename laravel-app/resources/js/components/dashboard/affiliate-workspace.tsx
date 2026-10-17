import { useCallback, useEffect, useState } from "react";
import { Link } from "@inertiajs/react";
import { Users, Coins, Wallet, Copy, CircleCheck, HandCoins, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface AffiliateData {
  referralCode: string;
  rate: number;
  minWithdraw: number;
  referred: number;
  totals: { pending: number; cleared: number; paid: number };
  earnings: { id: string; amount: number; status: string; createdAt: string }[];
  withdrawals: { id: string; amount: number; method: string; status: string; createdAt: string }[];
}

const METHODS = [
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "rocket", label: "Rocket" },
  { value: "payoneer", label: "Payoneer" },
];

export function AffiliateWorkspace({ origin }: { origin: string }) {
  const [data, setData] = useState<AffiliateData | null>(null);
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bkash");
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    fetch("/api/affiliate").then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const link = data ? `${origin}/?ref=${data.referralCode}` : "";

  function copyLink() {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  }

  async function withdraw(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/affiliate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), method, account }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ ok: false, text: d.error || "Could not request the withdrawal." }); return; }
      setMsg({ ok: true, text: d.message });
      setAmount(""); setAccount("");
      load();
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return <div className="h-64 animate-pulse rounded-lg bg-muted" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Affiliate program</h1>
        <p className="mt-1 text-sm text-muted-foreground">Earn {data.rate}% of every payment from customers you refer, for the life of their account.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Referred users", value: data.referred, icon: Users },
          { label: "Pending earnings", value: `$${data.totals.pending.toFixed(2)}`, icon: Coins },
          { label: "Cleared balance", value: `$${data.totals.cleared.toFixed(2)}`, icon: Wallet },
          { label: "Paid out", value: `$${data.totals.paid.toFixed(2)}`, icon: HandCoins },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-card p-5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-accent text-primary">
              <c.icon className="h-4.5 w-4.5" />
            </span>
            <p className="mt-3 text-xl font-bold text-foreground">{c.value}</p>
            <p className="text-sm text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Referral link */}
      <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-bold text-foreground"><Link2 className="h-4.5 w-4.5 text-primary" /> Your referral link</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-secondary px-3.5 py-2.5 text-sm text-foreground">{link}</code>
          <Button onClick={copyLink} className="h-11 rounded-md px-5 font-semibold">
            <Copy className="mr-2 h-4 w-4" /> {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
        <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
          Anyone visiting this link gets a 30 day cookie. When they buy any plan, your commission is recorded automatically.
        </p>
      </div>

      {/* Withdraw */}
      <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-bold text-foreground"><Wallet className="h-4.5 w-4.5 text-primary" /> Request withdrawal</h2>
        <p className="mt-1 text-sm text-muted-foreground">Minimum ${data.minWithdraw}. Paid from your cleared balance within 3 business days.</p>
        <form onSubmit={withdraw} className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="af-amount" className="mb-1.5 block text-sm font-semibold text-foreground">Amount (USD)</label>
            <input id="af-amount" type="number" min={data.minWithdraw} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder={String(data.minWithdraw)}
              className="h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-foreground">Method</label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="h-11 w-full rounded-md text-[15px]"><SelectValue /></SelectTrigger>
              <SelectContent>{METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="af-acc" className="mb-1.5 block text-sm font-semibold text-foreground">Account / number</label>
            <input id="af-acc" type="text" value={account} onChange={(e) => setAccount(e.target.value)} maxLength={120} placeholder="01XXXXXXXXX or Payoneer email"
              className="h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          {msg && <p className={cn("rounded-md px-3.5 py-2.5 text-sm font-medium sm:col-span-3", msg.ok ? "bg-ok-soft text-ok" : "bg-risk-soft text-risk")} role="alert">{msg.text}</p>}
          <div className="sm:col-span-3">
            <Button type="submit" disabled={busy || data.totals.cleared < data.minWithdraw} className="h-11 rounded-md px-6 font-semibold">
              Request withdrawal
            </Button>
            {data.totals.cleared < data.minWithdraw && (
              <span className="ml-3 text-sm text-muted-foreground">Clear at least ${data.minWithdraw} to withdraw. Earnings clear when their payment is verified.</span>
            )}
          </div>
        </form>
      </div>

      {/* Earnings + withdrawals */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-bold text-foreground">Earnings</h2>
          {data.earnings.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No earnings yet. Share your link to get started.</p>
          ) : (
            <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {data.earnings.map((e) => (
                <li key={e.id} className="flex items-center justify-between rounded-md border border-border px-3.5 py-2.5 text-sm">
                  <span className="text-muted-foreground">{new Date(e.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  <span className="flex items-center gap-2.5">
                    <span className="font-bold text-foreground">${e.amount.toFixed(2)}</span>
                    <span className={cn("rounded-sm px-2 py-0.5 text-xs font-bold",
                      e.status === "CLEARED" ? "bg-ok-soft text-ok" : e.status === "PAID" ? "bg-accent text-primary" : "bg-warn-soft text-warn")}>
                      {e.status.toLowerCase()}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-bold text-foreground">Withdrawals</h2>
          {data.withdrawals.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No withdrawals requested yet.</p>
          ) : (
            <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {data.withdrawals.map((w) => (
                <li key={w.id} className="flex items-center justify-between rounded-md border border-border px-3.5 py-2.5 text-sm">
                  <span className="text-muted-foreground">{new Date(w.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {w.method}</span>
                  <span className="flex items-center gap-2.5">
                    <span className="font-bold text-foreground">${w.amount.toFixed(2)}</span>
                    <span className={cn("rounded-sm px-2 py-0.5 text-xs font-bold",
                      w.status === "COMPLETED" ? "bg-ok-soft text-ok" : w.status === "REJECTED" ? "bg-risk-soft text-risk" : "bg-warn-soft text-warn")}>
                      {w.status.toLowerCase()}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
