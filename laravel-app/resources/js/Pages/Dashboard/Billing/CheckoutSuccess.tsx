import { Head, Link, usePage } from "@inertiajs/react";
import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StripeVerifyClient } from "@/components/dashboard/stripe-verify-client";
import { DashboardShell } from "@/components/dashboard/shell";

/**
 * Port of src/app/dashboard/billing/checkout/success/page.tsx. The controller
 * passes the query params; the page branches exactly like the original.
 */

interface SuccessParams {
  payment?: string;
  session_id?: string;
  canceled?: string;
  pp?: string;
  scz?: string;
  approved?: string;
  failed?: string;
  reason?: string;
}

function Shell({ icon, title, body, ok }: { icon: React.ReactNode; title: string; body: string; ok?: boolean }) {
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-border bg-card p-8 text-center">
      {icon}
      <h1 className="mt-3 text-xl font-bold text-foreground">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
        {ok && (
          <Button asChild className="rounded-md font-semibold"><Link href="/dashboard/audit">Run an audit</Link></Button>
        )}
        <Button asChild variant={ok ? "outline" : "default"} className="rounded-md font-semibold"><Link href="/dashboard/billing">Open billing</Link></Button>
        <Button asChild variant="outline" className="rounded-md font-semibold"><Link href="/dashboard">Back to dashboard</Link></Button>
      </div>
    </div>
  );
}

/** Landing page Stripe and PayPal return the buyer to after checkout. */
export default function CheckoutSuccess({ params }: { params: SuccessParams }) {
  const { auth } = usePage<any>().props;
  const sp = params;

  if (sp.canceled) {
    return (
      <DashboardShell credits={auth.user.credits} userName={auth.user.name || auth.user.email} isAdmin={auth.user.role === "ADMIN"}>
        <Head title="Payment result" />
        <Shell
          icon={<CircleAlert className="mx-auto h-11 w-11 text-warn" />}
          title="Payment canceled"
          body="You canceled the payment, so nothing was charged. You can start again whenever you are ready."
        />
      </DashboardShell>
    );
  }

  // PayPal return: the capture already happened server-side at /api/billing/paypal/verify.
  if (sp.pp) {
    if (!sp.payment) {
      return (
        <DashboardShell credits={auth.user.credits} userName={auth.user.name || auth.user.email} isAdmin={auth.user.role === "ADMIN"}>
          <Head title="Payment result" />
          <Shell
            icon={<CircleX className="mx-auto h-11 w-11 text-risk" />}
            title="Missing payment reference"
            body="We could not match this page to an order. Open your billing page to see the current state of your payments."
          />
        </DashboardShell>
      );
    }
    if (sp.approved) {
      return (
        <DashboardShell credits={auth.user.credits} userName={auth.user.name || auth.user.email} isAdmin={auth.user.role === "ADMIN"}>
          <Head title="Payment result" />
          <Shell
            icon={<CircleCheck className="mx-auto h-11 w-11 text-ok" />}
            title="Payment confirmed"
            body="Your PayPal payment went through and your credits have been added to the balance. A receipt from PayPal is available in your account."
            ok
          />
        </DashboardShell>
      );
    }
    return (
      <DashboardShell credits={auth.user.credits} userName={auth.user.name || auth.user.email} isAdmin={auth.user.role === "ADMIN"}>
        <Head title="Payment result" />
        <Shell
          icon={<CircleX className="mx-auto h-11 w-11 text-risk" />}
          title="Payment not completed"
          body={sp.reason ? decodeURIComponent(sp.reason).slice(0, 220) : "PayPal reports the payment did not finish. No charge was made. You can retry the checkout or use a manual gateway."}
        />
      </DashboardShell>
    );
  }

  // SSLCommerz return: validation already happened server-side at /api/billing/sslcommerz/verify.
  if (sp.scz) {
    if (!sp.payment) {
      return (
        <DashboardShell credits={auth.user.credits} userName={auth.user.name || auth.user.email} isAdmin={auth.user.role === "ADMIN"}>
          <Head title="Payment result" />
          <Shell
            icon={<CircleX className="mx-auto h-11 w-11 text-risk" />}
            title="Missing payment reference"
            body="We could not match this page to an order. Open your billing page to see the current state of your payments."
          />
        </DashboardShell>
      );
    }
    if (sp.approved) {
      return (
        <DashboardShell credits={auth.user.credits} userName={auth.user.name || auth.user.email} isAdmin={auth.user.role === "ADMIN"}>
          <Head title="Payment result" />
          <Shell
            icon={<CircleCheck className="mx-auto h-11 w-11 text-ok" />}
            title="Payment confirmed"
            body="Your SSLCommerz payment went through and your credits have been added to the balance. The transaction is recorded in your payment history."
            ok
          />
        </DashboardShell>
      );
    }
    return (
      <DashboardShell credits={auth.user.credits} userName={auth.user.name || auth.user.email} isAdmin={auth.user.role === "ADMIN"}>
        <Head title="Payment result" />
        <Shell
          icon={<CircleX className="mx-auto h-11 w-11 text-risk" />}
          title="Payment not completed"
          body={sp.reason ? decodeURIComponent(sp.reason).slice(0, 220) : "SSLCommerz reports the payment did not finish. No charge was made. You can retry the checkout or use a manual gateway."}
        />
      </DashboardShell>
    );
  }

  if (!sp.payment || !sp.session_id) {
    return (
      <DashboardShell credits={auth.user.credits} userName={auth.user.name || auth.user.email} isAdmin={auth.user.role === "ADMIN"}>
        <Head title="Payment result" />
        <Shell
          icon={<CircleX className="mx-auto h-11 w-11 text-risk" />}
          title="Missing payment reference"
          body="We could not match this page to an order. Open your billing page to see the current state of your payments."
        />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell credits={auth.user.credits} userName={auth.user.name || auth.user.email} isAdmin={auth.user.role === "ADMIN"}>
      <Head title="Payment result" />
      <StripeVerifyClient paymentId={sp.payment} sessionId={sp.session_id} />
    </DashboardShell>
  );
}
