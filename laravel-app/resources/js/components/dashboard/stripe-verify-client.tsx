import { useEffect, useRef, useState } from "react";
import { Link } from "@inertiajs/react";
import { CircleCheck, CircleX } from "lucide-react";
import { Button } from "@/components/ui/button";

type Phase = "pending" | "ok" | "fail";

/** Confirms a Stripe Checkout session against our verify API and shows the outcome. */
export function StripeVerifyClient({ paymentId, sessionId }: { paymentId: string; sessionId: string }) {
  const [phase, setPhase] = useState<Phase>("pending");
  const [failBody, setFailBody] = useState("Stripe reports the payment did not finish. No charge was made. You can retry the checkout or use a manual gateway.");
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    const search = `payment=${encodeURIComponent(paymentId)}&session_id=${encodeURIComponent(sessionId)}`;
    // Original call was GET; routes/web.php registers the verify endpoint as
    // POST, so retry with POST when the router answers 405.
    fetch(`/api/billing/stripe/verify?${search}`, { cache: "no-store" })
      .then((r) => (r.status === 405
        ? fetch(`/api/billing/stripe/verify?${search}`, { method: "POST", cache: "no-store" })
        : Promise.resolve(r)))
      .then((r) => r.json().then((d) => ({ status: r.status, data: d })))
      .then((res) => {
        if (res.status === 200 && res.data.status === "APPROVED") {
          setPhase("ok");
        } else {
          setFailBody(res.data?.error || failBody);
          setPhase("fail");
        }
      })
      .catch(() => setPhase("fail"));
  }, [paymentId, sessionId]);

  if (phase === "pending") {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-border bg-card p-8 text-center">
        <span className="mx-auto block h-11 w-11 animate-spin rounded-full border-[3px] border-border border-t-primary" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-bold text-foreground">Confirming your payment</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Checking with Stripe that the card payment completed. This takes a few seconds.
        </p>
      </div>
    );
  }

  if (phase === "ok") {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-border bg-card p-8 text-center">
        <CircleCheck className="mx-auto h-11 w-11 text-ok" />
        <h1 className="mt-3 text-xl font-bold text-foreground">Payment confirmed</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Your card payment went through and your credits have been added to the balance. A receipt from Stripe is on its way to your inbox.
        </p>
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild className="rounded-md font-semibold"><Link href="/dashboard/audit">Run an audit</Link></Button>
          <Button asChild variant="outline" className="rounded-md font-semibold"><Link href="/dashboard/billing">Open billing</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl rounded-lg border border-border bg-card p-8 text-center">
      <CircleX className="mx-auto h-11 w-11 text-risk" />
      <h1 className="mt-3 text-xl font-bold text-foreground">Payment not completed</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{failBody}</p>
      <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
        <Button asChild className="rounded-md font-semibold"><Link href="/dashboard/billing">Try again</Link></Button>
        <Button asChild variant="outline" className="rounded-md font-semibold"><Link href="/dashboard">Back to dashboard</Link></Button>
      </div>
    </div>
  );
}
