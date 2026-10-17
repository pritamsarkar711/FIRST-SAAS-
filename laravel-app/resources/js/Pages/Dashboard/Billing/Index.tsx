import { Head, usePage } from "@inertiajs/react";
import { Coins, Receipt, Wallet } from "lucide-react";
import { PricingCards } from "@/components/shared/pricing-cards";
import { DashboardShell } from "@/components/dashboard/shell";
import { cn } from "@/lib/utils";

const STATUS_CLS: Record<string, string> = {
  APPROVED: "bg-ok-soft text-ok",
  PENDING: "bg-warn-soft text-warn",
  REJECTED: "bg-risk-soft text-risk",
};

/**
 * Port of src/app/dashboard/billing/page.tsx. The controller passes the
 * active plans (features decoded), the USD→BDT rate, the user's latest
 * payments and the credit costs.
 */
export default function BillingIndex({ user, plans, rate, payments, costs }: {
  user: { credits: number };
  plans: { id: string; name: string; slug: string; description: string | null; priceUsd: number; credits: number; monitorLimit: number; features: string[]; badge: string | null; active: boolean; sortOrder: number }[];
  rate: number;
  payments: { id: string; planName: string; amount: number; amountBdt: number | null; gateway: string; status: string; createdAt: string }[];
  costs: { audit: { normal: number; standard: number; premium: number }; writer: { standard: number; premium: number }; index: number };
}) {
  const { auth } = usePage<any>().props;

  return (
    <DashboardShell credits={auth.user.credits} userName={auth.user.name || auth.user.email} isAdmin={auth.user.role === "ADMIN"}>
      <Head title="Billing and plans" />
      <div className="space-y-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Billing and plans</h1>
            <p className="mt-1 text-sm text-muted-foreground">One-time credit packs. Credits never expire.</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
            <Coins className="h-5 w-5 text-primary" />
            <span className="text-xl font-bold text-foreground">{user.credits.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">credits</span>
          </div>
        </div>

        <section>
          <h2 className="mb-4 text-lg font-bold text-foreground">Credit costs per action</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { t: "Site audit", rows: [["Normal", costs.audit.normal], ["Standard", costs.audit.standard], ["Premium", costs.audit.premium]] },
              { t: "Article", rows: [["Standard", costs.writer.standard], ["Premium", costs.writer.premium], ["Images", "included"]] },
              { t: "Indexing", rows: [["IndexNow batch (20 URLs)", costs.index], ["Re-submission", costs.index], ["History", "included"]] },
            ].map((c) => (
              <div key={c.t} className="rounded-lg border border-border bg-card p-4">
                <p className="font-bold text-foreground">{c.t}</p>
                <ul className="mt-2 space-y-1.5">
                  {c.rows.map(([label, v]) => (
                    <li key={String(label)} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-semibold text-foreground">{typeof v === "number" ? `${v} credits` : v}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-bold text-foreground">Plans</h2>
          <PricingCards plans={plans} rate={rate} />
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground"><Receipt className="h-5 w-5 text-primary" /> Payment history</h2>
          {payments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-secondary/40 p-8 text-center">
              <Wallet className="mx-auto h-7 w-7 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">No payments yet. Pick a plan above when you need more credits.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/60 text-left">
                    <th className="px-4 py-2.5 font-bold">Date</th>
                    <th className="px-4 py-2.5 font-bold">Plan</th>
                    <th className="px-4 py-2.5 font-bold">Amount</th>
                    <th className="px-4 py-2.5 font-bold">Method</th>
                    <th className="px-4 py-2.5 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 text-muted-foreground">{new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                      <td className="px-4 py-3 font-semibold text-foreground">{p.planName}</td>
                      <td className="px-4 py-3 text-foreground">${p.amount.toFixed(2)}{p.amountBdt ? <span className="text-muted-foreground"> / ৳{Math.round(p.amountBdt).toLocaleString()}</span> : null}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.gateway}</td>
                      <td className="px-4 py-3"><span className={cn("rounded-sm px-2 py-1 text-xs font-bold", STATUS_CLS[p.status] || "bg-muted text-muted-foreground")}>{p.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
