import { ContactForm } from "@/components/shared/contact-form";

export const metadata = {
  title: "Contact",
  description: "Questions about audits, billing, partnerships or anything else. We reply to every message.",
};

export default function ContactPage() {
  return (
    <>
      <section className="border-b border-border bg-secondary/50">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Contact us</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Pick a reason so your message reaches the right person faster.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
        <ContactForm />
      </section>
    </>
  );
}
