"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PlanCard {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceUsd: number;
  credits: number;
  features: string[];
  badge: string | null;
}

export function PricingCards({ plans, rate }: { plans: PlanCard[]; rate: number }) {
  const [currency, setCurrency] = useState<"USD" | "BDT">("USD");

  return (
    <div>
      <div className="mx-auto mb-8 flex w-fit items-center rounded-md border border-border bg-secondary p-1" role="tablist" aria-label="Currency">
        {(["USD", "BDT"] as const).map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={currency === c}
            onClick={() => setCurrency(c)}
            className={cn(
              "rounded-sm px-4 py-1.5 text-sm font-bold transition-colors",
              currency === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {c === "USD" ? "USD $" : `BDT ৳${Math.round(rate)}`}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => {
          const price = currency === "USD" ? `$${p.priceUsd.toFixed(2)}` : `৳${Math.round(p.priceUsd * rate).toLocaleString("en-US")}`;
          return (
            <div
              key={p.id}
              className={cn(
                "relative flex flex-col rounded-lg border bg-white p-5",
                p.badge ? "border-primary shadow-[0_2px_10px_rgba(13,107,77,0.12)]" : "border-border"
              )}
            >
              {p.badge ? (
                <span className="absolute -top-2.5 left-4 rounded-sm bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                  {p.badge}
                </span>
              ) : null}
              <h3 className="text-lg font-bold text-foreground">{p.name}</h3>
              <p className="mt-1 min-h-10 text-sm leading-snug text-muted-foreground">{p.description}</p>
              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="text-[2rem] font-bold leading-none tracking-tight text-foreground">{price}</span>
                <span className="text-sm text-muted-foreground">one-time</span>
              </div>
              <p className="mt-1.5 text-sm font-semibold text-primary">{p.credits.toLocaleString()} credits</p>
              <ul className="mt-4 flex-1 space-y-2.5">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-5 w-full rounded-md font-semibold" variant={p.badge ? "default" : "outline"}>
                <Link href={`/dashboard/billing/checkout?plan=${p.slug}`}>Get {p.name}</Link>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
