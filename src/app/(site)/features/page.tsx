import Image from "next/image";
import Link from "next/link";
import {
  FileSearch, Gauge, ShieldCheck, FileDown, PenLine, Network, CircleCheck, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Features",
  description: "Six analysis layers, three audit modes, branded PDF reports and a fix-first roadmap built for AdSense and premium ad network approval.",
};

const LAYERS: { icon: typeof FileSearch; title: string; body: string; points: string[] }[] = [
  {
    icon: FileSearch,
    title: "Website quality",
    body: "Professionalism, layout, page weight signals, mobile viewport, navigation structure, and clutter that distracts from content.",
    points: ["Mobile viewport and responsive setup", "Navigation clarity and depth", "Layout and widget overload"],
  },
  {
    icon: PenLine,
    title: "Content quality",
    body: "The layer that decides most approvals. We sample real articles and measure what reviewers measure.",
    points: ["Article depth and helpfulness", "AI-generated content footprints", "Thin pages, duplicate patterns, keyword stuffing"],
  },
  {
    icon: Gauge,
    title: "Traffic quality",
    body: "We tell you honestly what can and cannot be verified from the outside, and what to check in your own analytics.",
    points: ["Invalid click risk patterns", "Bot and exchange traffic red flags", "What to verify in Search Console"],
  },
  {
    icon: ShieldCheck,
    title: "Policy risks",
    body: "Copyright, scraped content, unsafe downloads, misleading buttons, restricted topics and deceptive UX patterns.",
    points: ["Policy page presence and reachability", "Restricted topic exposure", "Deceptive design patterns"],
  },
  {
    icon: CircleCheck,
    title: "Trust and E-E-A-T",
    body: "About, Contact, Privacy, Disclaimer, author signals, ownership transparency and branding consistency.",
    points: ["Policy pages audit", "Author and expertise signals", "Ownership transparency"],
  },
  {
    icon: Network,
    title: "SEO and indexing",
    body: "Sitemap health, crawlability, internal linking, orphan pages and topical structure.",
    points: ["Sitemap and robots.txt analysis", "Internal linking structure", "Topical cluster coverage"],
  },
];

export default function FeaturesPage() {
  return (
    <>
      <section className="dotgrid border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
            An audit that reads your site the way a reviewer does
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            Every audit runs six analysis layers against a live crawl of your domain, then converts the evidence
            into a probability, a verdict and a fix-first roadmap.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-2">
          {LAYERS.map((l) => (
            <div key={l.title} className="flex gap-4 rounded-lg border border-border bg-white p-6">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
                <l.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-foreground">{l.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{l.body}</p>
                <ul className="mt-3 space-y-1.5">
                  {l.points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm text-foreground">
                      <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" /> {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-secondary/50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="overflow-hidden rounded-lg border border-border">
              <Image src="/illustrations/audit.png" alt="Audit engine examining a website page" width={1344} height={768} className="h-auto w-full bg-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Three modes, one engine</h2>
              <div className="mt-6 space-y-4">
                {[
                  { t: "Normal", d: "A capable, efficient model that covers the common rejection causes. Cheapest per audit and fast." },
                  { t: "Standard", d: "Our recommendation. A stronger model, deeper content analysis and the best balance of cost and depth." },
                  { t: "Premium", d: "The most thorough pass with a top-tier frontier model. Maximum findings, maximum accuracy, most credits." },
                ].map((m) => (
                  <div key={m.t} className="rounded-md border border-border bg-white p-4">
                    <p className="font-bold text-foreground">{m.t}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{m.d}</p>
                  </div>
                ))}
              </div>
              <Button asChild className="mt-6 rounded-md font-semibold">
                <Link href="/register">Run your first audit</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
