import { Head, Link, usePage } from "@inertiajs/react";
import { CheckoutClient } from "@/components/dashboard/checkout-client";
import { DashboardShell } from "@/components/dashboard/shell";
import { ArrowLeft } from "lucide-react";

/** Port of src/app/dashboard/billing/checkout/page.tsx (404 handled by the controller). */
export default function BillingCheckout({ plan }: {
  plan: { id: string; name: string; slug: string; description: string | null; priceUsd: number; credits: number };
}) {
  const { auth } = usePage<any>().props;

  return (
    <DashboardShell credits={auth.user.credits} userName={auth.user.name || auth.user.email} isAdmin={auth.user.role === "ADMIN"}>
      <Head title="Checkout" />
      <div className="space-y-5">
        <Link href="/dashboard/billing" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to billing
        </Link>
        <CheckoutClient plan={plan} />
      </div>
    </DashboardShell>
  );
}
