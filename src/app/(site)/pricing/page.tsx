import { db } from "@/lib/db";
import { getUsdBdt } from "@/lib/settings";
import { PricingCards, type PlanCard } from "@/components/shared/pricing-cards";
import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Pricing" };
export const dynamic = "force-dynamic";

const COMPARE: [string, string, string, string, string][] = [
  ["Site audit", "Normal, Standard, Premium modes", "Same", "Same", "Same"],
  ["PDF report", "Included", "Included", "Included", "Included"],
  ["Ad networks", "AdSense, Ezoic, Mediavine, Raptive", "Same", "Same", "Same"],
  ["Content writer", "Standard mode", "Standard mode", "Standard + Premium", "Standard + Premium"],
  ["Quick index tool", "Included", "Included", "Included", "Included"],
  ["Affiliate program", "Included", "Included", "Included", "Included"],
  ["Report history", "Last 10 audits", "Unlimited", "Unlimited", "Unlimited"],
  ["Support", "Email", "Priority email", "Priority email", "Priority + chat"],
];

export default async function PricingPage() {
  const [plansRaw, rate] = await Promise.all([
    db.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    getUsdBdt(),
  ]);
  const plans: PlanCard[] = plansRaw.map((p) => ({ ...p, features: JSON.parse(p.features || "[]") as string[] }));

  return (
    <>
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
              "Audit history and re-checks",
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
        <h2 className="text-xl font-bold tracking-tight text-foreground">Plan differences</h2>
        <div className="mt-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/60 text-left">
                <th className="px-4 py-3 font-bold">Feature</th>
                <th className="px-4 py-3 font-bold">Starter</th>
                <th className="px-4 py-3 font-bold">Standard</th>
                <th className="px-4 py-3 font-bold">Pro</th>
                <th className="px-4 py-3 font-bold">Agency</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row, i) => (
                <tr key={i} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-semibold text-foreground">{row[0]}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row[1]}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row[2]}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row[3]}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row[4]}</td>
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
    </>
  );
}
