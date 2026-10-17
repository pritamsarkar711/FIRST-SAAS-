import { Link } from "@inertiajs/react";
import { ShieldCheck, Lock } from "lucide-react";
import { Logo } from "@/components/logo";

const COLS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/tools", label: "Tools" },
      { href: "/pricing", label: "Pricing" },
      { href: "/sample-report", label: "Sample report" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/blog", label: "Blog" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of Service" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/refund", label: "Refund Policy" },
    ],
  },
];

const PAY_LOGOS = [
  { src: "/logos/bkash.png", alt: "bKash" },
  { src: "/logos/nagad.png", alt: "Nagad" },
  { src: "/logos/rocket.png", alt: "Rocket" },
  { src: "/logos/upay.png", alt: "Upay" },
  { src: "/logos/sslcommerz.png", alt: "SSLCommerz" },
  { src: "/logos/stripe.svg", alt: "Stripe" },
  { src: "/logos/paypal.svg", alt: "PayPal" },
];

export function SiteFooter({ siteName, tagline }: { siteName: string; tagline: string }) {
  return (
    <footer className="mt-auto bg-[#1d1d1d] text-[#d7dbe0] pb-safe dark:bg-[#10141a]">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 [&_span]:text-white">
              <Logo name={siteName} />
            </span>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#9aa4ae]">{tagline}</p>
          </div>
          {COLS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="text-[13px] font-bold uppercase tracking-wide text-white">{col.title}</h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-[#9aa4ae] transition-colors hover:text-[#ff7a50]">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-5 border-t border-white/10 pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9aa4ae]">
                <Lock className="h-3.5 w-3.5 text-[#ff7a50]" /> Payments handled by verified gateways
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9aa4ae]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#ff7a50]" /> Reports stored privately
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2" aria-label="Supported payment methods">
              {PAY_LOGOS.map((p) => (
                <span key={p.alt} className="inline-flex h-7 w-12 items-center justify-center rounded-sm border border-white/10 bg-white px-1.5" title={p.alt}>
                  <img src={`${p.src}?v=3`} alt={`${p.alt} logo`} width={40} height={16} className="h-4 w-auto object-contain" loading="lazy" />
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 text-sm text-[#9aa4ae] sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} {siteName}. All rights reserved.</p>
            <p>Not affiliated with Google. AdSense is a trademark of Google LLC.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
