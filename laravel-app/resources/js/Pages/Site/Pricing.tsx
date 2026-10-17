import { Head, Link } from "@inertiajs/react";
import { PricingCards, type PlanCard } from "@/components/shared/pricing-cards";
import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import SiteShell from "@/components/site-shell";

interface PlanRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceUsd: number;
  credits: number;
  monitorLimit?: number | null;
  features: string;
  badge: string | null;
}

type Cell = string | { check: true };
const CHECK: Cell = { check: true };

export default function Pricing({ plans: plansRaw, usdBdt: rate }: { plans: PlanRow[]; usdBdt: number }) {
  const plans: PlanCard[] = (plansRaw || []).map((p) => ({
    ...p,
    features: JSON.parse(p.features || "[]") as string[],
  }));

  const recommendedSlug = "standard";
  const recommendedIdx = Math.max(plans.findIndex((p) => p.slug === recommendedSlug), 0);

  // Feature matrix rows built from the live plan list.
  const rows: [string, ...Cell[]][] = [
    ["Audit credits", ...plans.map((p) => `${p.credits.toLocaleString()} credits`)],
    ["Monitored domains (scheduled re-checks)", ...plans.map((p) => `${p.monitorLimit ?? 1} ${p.monitorLimit === 1 ? "domain" : "domains"}`)],
    ["Audit modes (Normal, Standard, Premium)", ...plans.map(() => CHECK)],
    ["All four ad networks (AdSense, Ezoic, Mediavine, Raptive)", ...plans.map(() => CHECK)],
    ["Branded PDF report", ...plans.map(() => CHECK)],
    ["Content writer (Standard and Premium)", ...plans.map(() => CHECK)],
    ["Quick index tool", ...plans.map(() => CHECK)],
    ["Bulk batch auditing (up to 10 sites)", ...plans.map(() => CHECK)],
    ["Affiliate program access", ...plans.map(() => CHECK)],
    ["CSV export of your audit history", ...plans.map(() => CHECK)],
    ["Support", ...(["Email", "Priority email", "Priority email", "Priority + chat"].slice(0, plans.length))],
  ];

  return (
    <SiteShell>
      <Head title="Pricing" />
      <section className="border-b border-border bg-secondary/50">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Pay once. Credits never expire.</h1>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Every plan unlocks all tools. The only difference is how much analysis you can run.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <PricingCards plans={plans} rate={rate} />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          BDT rates use live mid-market exchange rates. bKash, Nagad and Rocket accepted. See the{" "}
          <Link href="/refund" className="font-semibold text-primary hover:underline">refund policy</Link>.
        </p>
      </section>

      <section className="border-t border-border bg-secondary/50">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-xl font-bold tracking-tight text-foreground">What is the same in every plan</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "All four ad network readiness checks",
              "Green, orange, red findings with explanations",
              "Branded PDF download",
              "Fix-first roadmap and verdict",
              "Audit history, CSV export and re-checks",
              "WordPress publishing from the writer",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2.5 rounded-md border border-border bg-card px-4 py-3 text-sm font-medium text-foreground">
                <CircleCheck className="h-4.5 w-4.5 shrink-0 text-ok" /> {f}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Plan by plan</h2>
        <div className="mt-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/60 text-left">
                <th className="px-4 py-3 font-bold">Feature</th>
                {plans.map((p, i) => (
                  <th key={p.id} className={cn("px-4 py-3 font-bold", i === recommendedIdx && "bg-accent")}>
                    {p.name}
                    {i === recommendedIdx && (
                      <span className="ml-2 rounded-sm bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">Popular</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-semibold text-foreground">{row[0]}</td>
                  {row.slice(1).map((cell, ci) => (
                    <td key={ci} className={cn("px-4 py-3", ci === recommendedIdx && "bg-accent/50", typeof cell === "string" ? "text-muted-foreground" : "")}>
                      {typeof cell === "string" ? (
                        cell
                      ) : (
                        <CircleCheck className="h-4.5 w-4.5 text-ok" aria-label="Included" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-primary">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-12 text-center sm:px-6">
          <h2 className="text-xl font-bold text-white sm:text-2xl">Still deciding? Start with the free credits.</h2>
          <Button asChild size="lg" variant="secondary" className="h-12 rounded-md px-8 font-semibold">
            <Link href="/register">Create free account</Link>
          </Button>
        </div>
      </section>
    </SiteShell>
  );
}
