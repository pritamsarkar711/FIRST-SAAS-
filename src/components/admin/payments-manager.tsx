"use client";

import { useInitialFetch } from "@/lib/use-initial-fetch";
import { useCallback, useEffect, useState } from "react";
import { CircleCheck, CircleX, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";

interface PaymentRow {
  id: string;
  planName: string;
  amount: number;
  amountBdt: number | null;
  gateway: string;
  txId: string | null;
  senderInfo: string | null;
  status: string;
  note: string | null;
  createdAt: string;
  user: { email: string; name: string | null };
}

const STATUS_CLS: Record<string, string> = {
  APPROVED: "bg-ok-soft text-ok",
  PENDING: "bg-warn-soft text-warn",
  REJECTED: "bg-risk-soft text-risk",
};

export function PaymentsManager() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [filter, setFilter] = useState<"PENDING" | "ALL">("PENDING");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/payments");
    const d = await res.json().catch(() => ({}));
    setPayments(d.payments || []);
  }, []);
  useInitialFetch(load);

  async function act(id: string, action: "approve" | "reject") {
    setBusy(id);
    setMsg("");
    const res = await fetch("/api/admin/payments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy("");
    setMsg(d.message || d.error || "");
    setTimeout(() => setMsg(""), 2500);
    void load();
  }

  const rows = payments.filter((p) => (filter === "PENDING" ? p.status === "PENDING" : true));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Payments</h1>
          <p className="mt-1 text-sm text-muted-foreground">Verify manual transactions. Approving adds credits instantly and records affiliate commission.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-md border border-border bg-secondary p-1">
            {(["PENDING", "ALL"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn("rounded-sm px-3.5 py-1.5 text-sm font-bold", filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                {f === "PENDING" ? "Awaiting review" : "All"}
              </button>
            ))}
          </div>
          <a href="/api/export/admin?type=payments" download
            className="inline-flex h-10 items-center rounded-md border border-border bg-card px-3.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">
            Export CSV
          </a>
        </div>
      </div>

      {msg && <p className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-primary">{msg}</p>}

      {rows.length === 0 ? (
        <EmptyState
          image="/illustrations/monetize.png"
          title="No payments in this view"
          body={filter === "PENDING" ? "Manual payment orders waiting for verification will appear here." : "Payments show up here as soon as customers order plans."}
          size="sm"
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/60 text-left">
                <th className="px-4 py-2.5 font-bold">Customer</th>
                <th className="px-4 py-2.5 font-bold">Plan</th>
                <th className="px-4 py-2.5 font-bold">Amount</th>
                <th className="px-4 py-2.5 font-bold">Method / TrxID</th>
                <th className="px-4 py-2.5 font-bold">Status</th>
                <th className="px-4 py-2.5 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">{p.user.name || p.user.email}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleString()}</p>
                    {p.senderInfo && <p className="text-xs text-muted-foreground">Sender: {p.senderInfo}</p>}
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">{p.planName}</td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-foreground">${p.amount.toFixed(2)}</p>
                    {p.amountBdt ? <p className="text-xs text-muted-foreground">৳{Math.round(p.amountBdt).toLocaleString()}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-foreground">{p.gateway}</p>
                    {p.txId && <code className="text-xs text-muted-foreground">{p.txId}</code>}
                  </td>
                  <td className="px-4 py-3"><span className={cn("rounded-sm px-2 py-1 text-xs font-bold", STATUS_CLS[p.status])}>{p.status.toLowerCase()}</span></td>
                  <td className="px-4 py-3">
                    {p.status === "PENDING" ? (
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" onClick={() => void act(p.id, "approve")} disabled={busy === p.id} className="rounded-md font-semibold">
                          <CircleCheck className="mr-1 h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void act(p.id, "reject")} disabled={busy === p.id} className="rounded-md font-semibold text-risk">
                          <CircleX className="mr-1 h-3.5 w-3.5" /> Reject
                        </Button>
                      </div>
                    ) : (
                      <p className="text-right text-xs text-muted-foreground">{p.note || "Reviewed"}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
