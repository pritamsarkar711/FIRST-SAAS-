"use client";

import { useInitialFetch } from "@/lib/use-initial-fetch";
import { useCallback, useEffect, useState } from "react";
import { HandCoins, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WithdrawalRow {
  id: string;
  amount: number;
  method: string;
  account: string;
  status: string;
  createdAt: string;
  user: { email: string };
}
interface EarningRow {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  user: { email: string } | null;
  fromUser: { email: string } | null;
}

export function AffiliateManager() {
  const [rate, setRate] = useState(20);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [earnings, setEarnings] = useState<EarningRow[]>([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/affiliate");
    const d = await res.json().catch(() => ({}));
    setRate(d.rate ?? 20);
    setWithdrawals(d.withdrawals || []);
    setEarnings(d.earnings || []);
  }, []);
  useInitialFetch(load);

  async function saveRate() {
    await fetch("/api/admin/affiliate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setRate", rate: Number(rate) }),
    });
    setMsg("Commission rate updated.");
    setTimeout(() => setMsg(""), 2000);
  }

  async function act(id: string, decision: "approve" | "reject" | "complete") {
    await fetch("/api/admin/affiliate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "withdrawal", id, decision }),
    });
    void load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Affiliate program</h1>
        <p className="mt-1 text-sm text-muted-foreground">Commission rate and payout requests.</p>
      </div>

      {msg && <p className="flex items-center gap-1.5 rounded-md bg-ok-soft px-3 py-2 text-sm font-semibold text-ok"><CircleCheck className="h-4 w-4" /> {msg}</p>}

      <div className="rounded-lg border border-border bg-white p-5">
        <h2 className="flex items-center gap-2 font-bold text-foreground"><HandCoins className="h-4.5 w-4.5 text-primary" /> Commission rate</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <input type="number" min={0} max={90} value={rate} onChange={(e) => setRate(Number(e.target.value))}
              className="h-11 w-24 rounded-md border border-input bg-white px-3 text-[15px]" aria-label="Commission rate percent" />
            <span className="font-bold text-foreground">%</span>
          </div>
          <Button onClick={saveRate} className="h-11 rounded-md px-5 font-semibold">Save rate</Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-white p-5">
        <h2 className="font-bold text-foreground">Withdrawal requests</h2>
        {withdrawals.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No requests yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-left">
                  <th className="px-3 py-2 font-bold">User</th>
                  <th className="px-3 py-2 font-bold">Amount</th>
                  <th className="px-3 py-2 font-bold">Method / account</th>
                  <th className="px-3 py-2 font-bold">Status</th>
                  <th className="px-3 py-2 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2.5 text-foreground">{w.user.email}</td>
                    <td className="px-3 py-2.5 font-bold text-foreground">${w.amount.toFixed(2)}</td>
                    <td className="px-3 py-2.5"><span className="uppercase text-muted-foreground">{w.method}</span> · {w.account}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn("rounded-sm px-2 py-0.5 text-xs font-bold",
                        w.status === "COMPLETED" ? "bg-ok-soft text-ok" : w.status === "REJECTED" ? "bg-risk-soft text-risk" : "bg-warn-soft text-warn")}>
                        {w.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        {w.status === "PENDING" && (
                          <>
                            <Button size="sm" onClick={() => void act(w.id, "approve")} className="rounded-md font-semibold">Mark processing</Button>
                            <Button size="sm" variant="outline" onClick={() => void act(w.id, "reject")} className="rounded-md font-semibold text-risk">Reject</Button>
                          </>
                        )}
                        {w.status === "PROCESSING" && (
                          <Button size="sm" onClick={() => void act(w.id, "complete")} className="rounded-md font-semibold">Mark paid</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-white p-5">
        <h2 className="font-bold text-foreground">Recent commissions</h2>
        {earnings.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No commissions recorded yet.</p>
        ) : (
          <ul className="mt-3 max-h-80 divide-y divide-border overflow-y-auto">
            {earnings.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-foreground">{e.user?.email || "—"}</span>
                  <span className="block text-xs text-muted-foreground">from {e.fromUser?.email || "unknown"} · {new Date(e.createdAt).toLocaleDateString()}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
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
    </div>
  );
}
