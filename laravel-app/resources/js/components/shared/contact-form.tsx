import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2 } from "lucide-react";

const REASONS = [
  "Pre-sales question",
  "Technical support",
  "Billing and payments",
  "Feature request",
  "Partnership and media",
  "Report a problem",
  "Other",
];

export function ContactForm() {
  const [reason, setReason] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!reason) { setError("Please choose a reason."); return; }
    setSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, reason, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not send the message. Please try again.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-ok" />
        <h2 className="mt-3 text-lg font-bold text-foreground">Message received</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Thank you. We reply to every message, usually within one business day.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-border bg-card p-5 sm:p-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="c-name" className="mb-1.5 block text-sm font-semibold text-foreground">Your name</label>
          <input
            id="c-name" type="text" required value={name} onChange={(e) => setName(e.target.value)}
            className="h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Full name" maxLength={80}
          />
        </div>
        <div>
          <label htmlFor="c-email" className="mb-1.5 block text-sm font-semibold text-foreground">Email</label>
          <input
            id="c-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="you@example.com" maxLength={120}
          />
        </div>
      </div>
      <div className="mt-4">
        <label className="mb-1.5 block text-sm font-semibold text-foreground">Reason for contact</label>
        <Select value={reason} onValueChange={setReason}>
          <SelectTrigger className="h-11 w-full rounded-md text-[15px]" aria-label="Reason for contact">
            <SelectValue placeholder="Choose a reason" />
          </SelectTrigger>
          <SelectContent>
            {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="mt-4">
        <label htmlFor="c-msg" className="mb-1.5 block text-sm font-semibold text-foreground">Message</label>
        <textarea
          id="c-msg" required value={message} onChange={(e) => setMessage(e.target.value)}
          rows={5} maxLength={2000}
          className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="How can we help?"
        />
      </div>
      {error && <p className="mt-3 text-sm font-medium text-risk" role="alert">{error}</p>}
      <Button type="submit" disabled={sending} className="mt-5 h-11 w-full rounded-md font-semibold sm:w-auto sm:px-8">
        {sending ? "Sending..." : "Send message"}
      </Button>
    </form>
  );
}
