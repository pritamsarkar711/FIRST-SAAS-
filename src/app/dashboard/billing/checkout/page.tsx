import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CheckoutClient } from "@/components/dashboard/checkout-client";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan: slug } = await searchParams;
  if (!slug) notFound();
  const plan = await db.plan.findUnique({ where: { slug } });
  if (!plan || !plan.active) notFound();

  return (
    <div className="space-y-5">
      <Link href="/dashboard/billing" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to billing
      </Link>
      <CheckoutClient plan={{ id: plan.id, name: plan.name, slug: plan.slug, description: plan.description, priceUsd: plan.priceUsd, credits: plan.credits }} />
    </div>
  );
}
