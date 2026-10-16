import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CircleAlert, CircleX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StripeVerifyClient } from "@/components/dashboard/stripe-verify-client";

export const metadata = { title: "Payment result" };
export const dynamic = "force-dynamic";

/** Landing page Stripe returns the buyer to after card checkout. */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string; session_id?: string; canceled?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const sp = await searchParams;

  if (sp.canceled) {
    return (
      <Shell
        icon={<CircleAlert className="mx-auto h-11 w-11 text-warn" />}
        title="Payment canceled"
        body="You canceled the card payment, so nothing was charged. You can start again whenever you are ready."
      />
    );
  }

  if (!sp.payment || !sp.session_id) {
    return (
      <Shell
        icon={<CircleX className="mx-auto h-11 w-11 text-risk" />}
        title="Missing payment reference"
        body="We could not match this page to an order. Open your billing page to see the current state of your payments."
      />
    );
  }

  return <StripeVerifyClient paymentId={sp.payment} sessionId={sp.session_id} />;
}

function Shell({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-border bg-card p-8 text-center">
      {icon}
      <h1 className="mt-3 text-xl font-bold text-foreground">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
        <Button asChild className="rounded-md font-semibold"><Link href="/dashboard/billing">Open billing</Link></Button>
        <Button asChild variant="outline" className="rounded-md font-semibold"><Link href="/dashboard">Back to dashboard</Link></Button>
      </div>
    </div>
  );
}
