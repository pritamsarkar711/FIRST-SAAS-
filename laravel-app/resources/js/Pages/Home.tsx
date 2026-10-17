import { Link } from "@inertiajs/react";
import {
  FileSearch, Gauge, ShieldCheck, FileDown, PenLine, Network,
  CircleCheck, ArrowRight, BookOpen,
} from "lucide-react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { HeroAuditForm } from "@/components/shared/hero-audit-form";
import { ReportMockup } from "@/components/shared/report-mockup";
import { Illustration } from "@/components/shared/illustration";
import { PricingCards, type PlanCard } from "@/components/shared/pricing-cards";
import { BrandLogo } from "@/components/brand-logo";
import SiteShell from "@/components/site-shell";

const HERO_CHECKS = [
  "No signup for the free check",
  "Green, orange and red findings",
  "Branded PDF report included",
];

const FEATURES = [
  {
    icon: FileSearch,
    title: "Full policy audit",
    body: "Your site is crawled for real: pages, content depth, navigation, policy pages, sitemap, indexing. Findings mapped to actual reviewer rules.",
  },
  {
    icon: Gauge,
    title: "Approval probability",
    body: "A percentage you can trust, with a clear verdict: apply now, wait and improve, or high risk of rejection.",
  },
  {
    icon: ShieldCheck,
    title: "Low value content check",
    body: "Sampled articles are measured for depth, originality signals and AI footprints: the number one reason approvals get rejected.",
  },
  {
    icon: FileDown,
    title: "Branded PDF report",
    body: "Download a clean PDF with every finding, score and fix. Keep it, share it, and re-check after each round of changes.",
  },
  {
    icon: PenLine,
    title: "Content writer",
    body: "Generate AdSense-ready, E-E-A-T aligned articles with images, FAQ and SEO meta. Publish straight to WordPress or download.",
  },
  {
    icon: Network,
    title: "Premium network readiness",
    body: "Beyond AdSense: check readiness for Ezoic, Mediavine and Raptive with their real traffic and content bars in mind.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Point us at your domain",
    body: "Enter your URL and pick the ad network you are targeting. Our crawler reads your homepage, robots.txt, sitemap and sample articles.",
  },
  {
    n: "02",
    title: "The engine reviews everything",
    body: "A frontier AI model reviews the evidence like a human policy reviewer: content depth, trust signals, policy risks and indexing health.",
  },
  {
    n: "03",
    title: "Fix, re-check, apply",
    body: "Work through the green, orange and red findings and the fix-first roadmap. Re-run the audit, then apply with confidence.",
  },
];

const FAQS = [
  {
    q: "How accurate is the approval probability?",
    a: "The score is an evidence-based estimate built from a real crawl of your site combined with published policy rules of each ad network. It reflects what a reviewer is likely to see today. No tool can see your traffic analytics or Google Search Console data, so where that matters, the report tells you exactly what to verify yourself.",
  },
  {
    q: "What is low value content and can this tool detect it?",
    a: "Low value content is Google's most common rejection reason: thin, duplicated, auto-generated or unhelpful pages. We sample real articles from your sitemap and measure depth, structure, originality signals and AI footprints, then flag the specific pages and patterns that put you at risk.",
  },
  {
    q: "My site was rejected before. Can this help?",
    a: "Yes. That is exactly what it is for. Run an audit, read the red and orange findings, fix them, and re-check before you reapply. Most repeat rejections come from issues that are visible on the site itself.",
  },
  {
    q: "Which sites are supported?",
    a: "Any public blog or content site: WordPress, Blogger, Wix, Shopify or custom builds. The site must be reachable without a login.",
  },
  {
    q: "How do credits work?",
    a: "Each audit, article or index batch uses credits based on the mode you pick. Normal mode uses fewer credits, premium mode uses the most powerful model and takes longer. New accounts start with free credits.",
  },
  {
    q: "Do you store my reports?",
    a: "Yes, reports stay in your dashboard so you can compare progress over time and download the PDF whenever you need it. You can delete any audit from your history.",
  },
];

const TOOLS = [
  {
    img: "writer",
    icon: PenLine,
    title: "AdSense content writer",
    body: "Keyword in, publish-ready article out: E-E-A-T aligned, image placement, FAQ, SEO meta, WordPress publishing.",
    href: "/dashboard/writer",
  },
  {
    img: "index-rocket",
    icon: BookOpen,
    title: "Quick index",
    body: "Submit new posts to IndexNow and get your fresh content discovered faster by search engines.",
    href: "/dashboard/indexer",
  },
  {
    img: "growth",
    icon: Network,
    title: "Affiliate program",
    body: "Earn 20% recurring commission for every customer you refer. Withdraw to bKash, Nagad or Payoneer.",
    href: "/dashboard/affiliate",
  },
  {
    img: "support",
    icon: CircleCheck,
    title: "Human support",
    body: "Stuck on a rejection? Send us your report and we will walk you through the fixes, free for customers.",
    href: "/contact",
  },
];

interface PlanRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceUsd: number;
  credits: number;
  monitorLimit?: number | null;
  features: string;
  badge: string | null;
}

interface PostRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: string | null;
}

export default function Home({ plans: plansRaw, posts, usdBdt }: { plans: PlanRow[]; posts: PostRow[]; usdBdt: number }) {
  const plans: PlanCard[] = (plansRaw || []).map((p) => ({
    ...p,
    features: JSON.parse(p.features || "[]") as string[],
  }));

  return (
    <SiteShell>
      {/* Hero: light blue-gray band, centered heavy headline with coral accents */}
      <section className="bg-band border-b border-border">
        <div className="mx-auto max-w-4xl px-4 pt-14 text-center sm:px-6 sm:pt-20">
          <h1 className="fade-up text-[2.15rem] font-extrabold leading-[1.15] tracking-tight text-foreground sm:text-[3rem]">
            Will <span className="text-primary">AdSense</span> approve your site?{" "}
            <span className="text-primary">Know before you apply.</span>
          </h1>
          <p className="fade-up mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground sm:text-[17px]">
            Most rejections say only &ldquo;low value content&rdquo;. Audit Form crawls your site, reviews it like a
            policy reviewer would, and shows your approval odds with every finding explained.
          </p>
          <div className="fade-up mx-auto mt-7 max-w-2xl">
            <HeroAuditForm />
          </div>
          <ul className="fade-up mt-6 flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
            {HERO_CHECKS.map((c) => (
              <li key={c} className="flex items-center gap-2 text-sm font-bold text-foreground">
                <CircleCheck className="h-5 w-5 text-primary" aria-hidden="true" strokeWidth={2.2} />
                {c}
              </li>
            ))}
          </ul>
        </div>
        <div className="fade-up mx-auto mt-10 max-w-3xl px-4 pb-0 sm:px-6">
          <Illustration name="hero-people" alt="Illustration of three bloggers" loading="eager" className="mx-auto max-w-xl" />
        </div>
      </section>

      {/* Network trust bar */}
      <section className="bg-background">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-center sm:gap-10 sm:px-6">
          <p className="text-sm font-semibold text-muted-foreground">Readiness checks for:</p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {[
              { name: "Google AdSense", src: "/logos/adsense.svg" },
              { name: "Ezoic", src: "/logos/ezoic.png" },
              { name: "Mediavine", src: "/logos/mediavine.png" },
              { name: "Raptive", src: "/logos/raptive.png" },
            ].map((n) => (
              <div key={n.name} className="flex items-center gap-2">
                <BrandLogo name={n.name} src={n.src} size={22} />
                <span className="text-sm font-bold text-foreground">{n.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works: UXpert numbered circles */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-[1.7rem] font-extrabold tracking-tight text-foreground sm:text-[2.2rem]">
            How auditing with <span className="text-primary">Audit Form</span> works
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-[15px] leading-relaxed text-muted-foreground">
            Take a minute to imagine opening the AdSense application form with zero doubt. That is what an
            evidence-first audit gives you: a score, a verdict, and a fix list in the right order.
          </p>
          <div className="mt-12 grid gap-10 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-extrabold text-primary-foreground" aria-hidden="true">
                  {s.n}
                </span>
                <h3 className="mt-5 text-lg font-extrabold text-primary">{s.title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-[1.7rem] font-extrabold tracking-tight text-foreground sm:text-[2.2rem]">
            Everything a reviewer looks at, <span className="text-primary">in one report</span>
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            Six analysis layers, one honest verdict, and a fix list ordered by what moves the needle first.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-[0_2px_12px_rgba(29,29,29,0.08)]">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <f.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-extrabold text-foreground">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Report anatomy */}
      <section className="bg-band border-y border-border">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-[1.7rem] font-extrabold tracking-tight text-foreground sm:text-[2.2rem]">
              Three colors. <span className="text-primary">Zero guesswork.</span>
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              Every finding is graded so you always know what is fine, what needs work, and what is actively
              blocking your approval.
            </p>
            <div className="mt-6 space-y-3">
              {[
                { dot: "bg-ok", t: "Green means okay", d: "This signal matches what reviewers expect. Keep it that way." },
                { dot: "bg-warn", t: "Orange means improve", d: "Not a violation, but weak enough to hurt your odds. Worth fixing." },
                { dot: "bg-risk", t: "Red means fix", d: "A real risk that commonly causes rejection. Handle these first." },
              ].map((r) => (
                <div key={r.t} className="flex items-start gap-3 rounded-md border border-border bg-card p-4">
                  <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${r.dot}`} aria-hidden="true" />
                  <div>
                    <p className="font-extrabold text-foreground">{r.t}</p>
                    <p className="text-sm text-muted-foreground">{r.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <ReportMockup />
        </div>
      </section>

      {/* Tools */}
      <section className="bg-background">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-[1.7rem] font-extrabold tracking-tight text-foreground sm:text-[2.2rem]">
            Tools that <span className="text-primary">finish the job</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-[15px] leading-relaxed text-muted-foreground">
            Fixing a rejection usually means writing. These tools are built for it.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {TOOLS.map((t) => (
              <Link key={t.title} href={t.href} className="group flex gap-4 rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-[0_2px_12px_rgba(29,29,29,0.08)]">
                <div className="hidden h-28 w-32 shrink-0 items-center overflow-hidden rounded-md sm:flex">
                  <Illustration name={t.img} alt="" className="h-full w-full [&>img]:h-full [&>img]:w-full [&>img]:object-cover" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <t.icon className="h-4.5 w-4.5 text-primary" aria-hidden="true" />
                    <h3 className="font-extrabold text-foreground">{t.title}</h3>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.body}</p>
                  <span className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-primary">
                    Open tool <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-[1.7rem] font-extrabold tracking-tight text-foreground sm:text-[2.2rem]">
              Simple <span className="text-primary">one-time plans</span>
            </h2>
            <p className="mt-3 text-[15px] text-muted-foreground">Pick credits, not subscriptions. They never expire.</p>
          </div>
          <div className="mt-10">
            <PricingCards plans={plans} rate={usdBdt} />
          </div>
        </div>
      </section>

      {/* Blog preview */}
      {(posts || []).length > 0 && (
        <section className="bg-background">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <div className="flex items-end justify-between">
              <h2 className="text-[1.7rem] font-extrabold tracking-tight text-foreground">
                From <span className="text-primary">the blog</span>
              </h2>
              <Link href="/blog" className="inline-flex items-center gap-1 text-sm font-bold uppercase tracking-wide text-primary hover:underline">
                All posts <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {posts.map((p) => (
                <Link key={p.id} href={`/blog/${p.slug}`} className="group rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-[0_2px_12px_rgba(29,29,29,0.08)]">
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">
                    {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                  </p>
                  <h3 className="mt-2 font-extrabold leading-snug text-foreground group-hover:text-primary">{p.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.excerpt}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-[1.7rem] font-extrabold tracking-tight text-foreground sm:text-[2.2rem]">
          Questions <span className="text-primary">publishers ask</span>
        </h2>
        <Accordion type="single" collapsible className="mt-8">
          {FAQS.map((f, i) => (
            <AccordionItem key={i} value={`f${i}`}>
              <AccordionTrigger className="text-left font-bold">{f.q}</AccordionTrigger>
              <AccordionContent className="leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA: near-black band with coral button */}
      <section className="bg-[#1d1d1d] text-white dark:bg-[#10141a]">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6">
          <h2 className="max-w-2xl text-[1.7rem] font-extrabold tracking-tight sm:text-[2.2rem]">
            Stop guessing. <span className="text-[#ff7a50]">Audit before you apply.</span>
          </h2>
          <p className="max-w-lg text-[15px] leading-relaxed text-white/75">
            A rejection costs you weeks. An audit takes minutes and shows you exactly what to fix.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 rounded-md px-8 text-sm font-bold uppercase tracking-wide">
              <Link href="/register">Start with free credits</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 rounded-md border-white/30 bg-transparent px-8 text-sm font-bold uppercase tracking-wide text-white hover:bg-white/10 hover:text-white">
              <Link href="/how-it-works">See how it works</Link>
            </Button>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
