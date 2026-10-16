import Link from "next/link";
import { Logo } from "@/components/logo";

const COLS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/tools", label: "Tools" },
      { href: "/pricing", label: "Pricing" },
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

export function SiteFooter({ siteName, tagline }: { siteName: string; tagline: string }) {
  return (
    <footer className="mt-auto border-t border-border bg-secondary/60 pb-safe">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo name={siteName} />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">{tagline}</p>
          </div>
          {COLS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="text-sm font-bold text-foreground">{col.title}</h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-primary">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {siteName}. All rights reserved.</p>
          <p>Not affiliated with Google. AdSense is a trademark of Google LLC.</p>
        </div>
      </div>
    </footer>
  );
}
