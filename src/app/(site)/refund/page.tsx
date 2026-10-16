export const metadata = { title: "Refund Policy" };

export default function RefundPage() {
  return (
    <>
      <section className="border-b border-border bg-secondary/50">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Refund Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">Straightforward and fair.</p>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="space-y-8">
          <div>
            <h2 className="text-lg font-bold text-foreground">14 day refund window</h2>
            <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
              If you have used less than 25% of your purchased credits, you can request a full refund within 14 days
              of payment. Refunds go back through the original payment method.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Manual gateway payments</h2>
            <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
              For bKash, Nagad and Rocket payments, refunds are sent to the same wallet number used for the payment
              within 5 business days of approval of the request.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">When refunds are not available</h2>
            <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
              If more than 25% of credits are consumed, or the 14 day window has passed, credits remain valid
              forever instead. Chargeback fraud leads to permanent account suspension.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">How to request</h2>
            <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
              Use the contact page, choose &ldquo;Billing and payments&rdquo;, and include your transaction ID.
              No explanation required, no questions asked within the rules above.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
