import { Head, Link } from "@inertiajs/react";
import { PenLine, Link2, BookOpen, Network, ArrowRight, CircleCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { SiteCheckTool } from "@/components/shared/site-check-tool";
import { Illustration } from "@/components/shared/illustration";
import SiteShell from "@/components/site-shell";

const TOOLS = [
  {
    icon: PenLine,
    title: "AdSense content writer",
    img: "writer",
    body: "Give it a keyword. Get a publish-ready article that meets E-E-A-T expectations: structured headings, natural human tone, internal and external links, 8 to 10 FAQs, SEO title and meta description, plus featured and inline images with alt text. Choose standard or premium depth, article length, and image style: flat vector, realistic, neo-brutalist or diagram. Publish directly to WordPress or copy and download.",
    points: ["Human-sounding, no AI cliches", "Rank Math friendly structure", "WordPress, Blogger, Wix, Shopify ready HTML"],
  },
  {
    icon: Link2,
    title: "Affiliate content writer",
    img: "growth",
    body: "Built for Amazon, ClickBank and direct affiliate reviews. Drop in your keyword and your affiliate links: the writer produces honest reviews and comparisons with a proper affiliate disclosure, a what-you-will-learn opening, pros and cons, comparison tables and clear calls to action. AdSense-safe by design.",
    points: ["Disclosure handled correctly", "Honest pros and cons, no fake claims", "Comparison tables built in"],
  },
  {
    icon: BookOpen,
    title: "Quick index",
    img: "index-rocket",
    body: "New posts should not sit unindexed for weeks. Submit your URLs to IndexNow in one batch, with a guided key setup that takes two minutes on any platform. Bing, Yandex and Seznam get your links the moment you publish.",
    points: ["Bulk URL submission", "Guided IndexNow key setup", "Submission history and status"],
  },
  {
    icon: Network,
    title: "Affiliate program",
    img: "report",
    body: "Share your referral link and earn 20% of every payment from the customers you bring, for the life of the account. Track clicks, signups, earnings and payouts from one dashboard, and withdraw to bKash, Nagad, Rocket or Payoneer once your balance clears.",
    points: ["20% commission, admin adjustable", "Transparent earnings ledger", "Local and international payouts"],
  },
];

export default function Tools() {
  return (
    <SiteShell>
      <Head title="Tools" />
      <section className="border-b border-border bg-secondary/50">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">The audit is step one. These tools finish the job.</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Start with the free instant check below, no account needed. The rest live in your dashboard and run on the same credit balance.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
        <SiteCheckTool />
      </section>

      <section className="mx-auto max-w-6xl space-y-12 px-4 py-14 sm:px-6">
        {TOOLS.map((t, i) => (
          <div key={t.title} className={`grid items-center gap-8 lg:grid-cols-2 ${i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""}`}>
            <div className="overflow-hidden rounded-lg">
              <Illustration name={t.img} alt={t.title} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-accent text-primary">
                  <t.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{t.title}</h2>
              </div>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{t.body}</p>
              <ul className="mt-4 space-y-2">
                {t.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm text-foreground">
                    <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {p}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                Open in dashboard <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </section>

      <section className="border-t border-border bg-secondary/50">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <p className="text-center text-sm text-muted-foreground">
            Publishes cleanly to
            <span className="mx-2 inline-flex translate-y-0.5 items-center gap-1.5 align-middle">
              <BrandLogo name="WordPress" src="/logos/wordpress.svg" size={18} /> WordPress
            </span>
            <span className="mx-2 inline-flex translate-y-0.5 items-center gap-1.5 align-middle">
              <BrandLogo name="Blogger" src="/logos/blogger.svg" size={18} /> Blogger
            </span>
            <span className="mx-2 inline-flex translate-y-0.5 items-center gap-1.5 align-middle">
              <BrandLogo name="Wix" src="/logos/wix.svg" size={18} /> Wix
            </span>
            and
            <span className="mx-2 inline-flex translate-y-0.5 items-center gap-1.5 align-middle">
              <BrandLogo name="Shopify" src="/logos/shopify.svg" size={18} /> Shopify
            </span>
          </p>
        </div>
      </section>
    </SiteShell>
  );
}
