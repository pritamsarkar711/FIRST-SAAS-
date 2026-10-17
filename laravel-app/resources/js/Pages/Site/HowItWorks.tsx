import { Head, Link } from "@inertiajs/react";
import { CircleCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { Illustration } from "@/components/shared/illustration";
import SiteShell from "@/components/site-shell";

const STEPS = [
  {
    title: "Enter your domain",
    body: "Type your URL and choose the ad network you are targeting. No plugins, no account access, no tracking code needed. The crawler only sees what the public internet sees.",
    img: "audit-desk",
    alt: "Entering a domain to start an audit",
  },
  {
    title: "We crawl the real site",
    body: "The engine fetches your homepage, robots.txt and sitemap, then samples real articles. It records page counts, policy pages, navigation, content depth, images, platform, ads and analytics scripts.",
    img: "index-rocket",
    alt: "Crawling pages from a sitemap",
  },
  {
    title: "The AI reviews the evidence",
    body: "A frontier model evaluates the crawl against published policy rules, thinking like a human reviewer: hidden risks, trust gaps, thin content, AI footprints and indexing problems.",
    img: "report",
    alt: "AI reviewer analyzing findings",
  },
  {
    title: "Fix, re-check, apply",
    body: "You get a probability, a verdict and a numbered roadmap. Fix the reds, improve the oranges, re-run the audit and apply when the verdict says you are ready.",
    img: "growth",
    alt: "Fixing issues and getting approved",
  },
];

export default function HowItWorks() {
  return (
    <SiteShell>
      <Head title="How it works" />
      <section className="border-b border-border bg-secondary/50">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">From domain to verdict in four steps</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            No account access. Nothing to install. Everything happens on our side.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="space-y-10">
          {STEPS.map((s, i) => (
            <div key={s.title} className={`grid items-center gap-8 lg:grid-cols-2 ${i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""}`}>
              <div className="overflow-hidden rounded-lg">
                <Illustration name={s.img} alt={s.alt} />
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-primary">Step {i + 1}</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">{s.title}</h2>
                <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-secondary/50">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight text-foreground">Check against four networks</h2>
          <div className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-2">
            {[
              { name: "Google AdSense", src: "/logos/adsense.svg", note: "First approval and re-applications" },
              { name: "Ezoic", src: "/logos/ezoic.png", note: "No minimum traffic, content quality focused" },
              { name: "Mediavine", src: "/logos/mediavine.png", note: "Roughly 50k sessions per month expected" },
              { name: "Raptive", src: "/logos/raptive.png", note: "Roughly 100k monthly pageviews expected" },
            ].map((n) => (
              <div key={n.name} className="flex items-center gap-3 rounded-md border border-border bg-card p-4">
                <BrandLogo name={n.name} src={n.src} size={24} />
                <div>
                  <p className="font-bold text-foreground">{n.name}</p>
                  <p className="text-sm text-muted-foreground">{n.note}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed text-muted-foreground">
            Premium networks are private exchanges, and their exact bar is not public. Our models use their published
            requirements plus observed approval patterns, and say clearly when traffic data must be verified by you.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            "Nothing to install on your site",
            "PDF report you can keep and compare",
            "Credits never expire",
          ].map((t) => (
            <div key={t} className="flex items-center gap-2.5 rounded-md border border-border bg-card px-4 py-3.5 text-sm font-medium">
              <CircleCheck className="h-4.5 w-4.5 shrink-0 text-primary" /> {t}
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Button asChild size="lg" className="h-12 rounded-md px-8 font-semibold">
            <Link href="/register">Run your first audit <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>
    </SiteShell>
  );
}
