import { Head } from "@inertiajs/react";
import { ContactForm } from "@/components/shared/contact-form";
import SiteShell from "@/components/site-shell";

export default function Contact({ supportEmail }: { supportEmail?: string }) {
  return (
    <SiteShell>
      <Head title="Contact" />
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
    </SiteShell>
  );
}
