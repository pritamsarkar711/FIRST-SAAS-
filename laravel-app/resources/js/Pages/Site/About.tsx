import { Head, Link } from "@inertiajs/react";
import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Illustration } from "@/components/shared/illustration";
import SiteShell from "@/components/site-shell";

export default function About() {
  return (
    <SiteShell>
      <Head title="About" />
      <section className="border-b border-border bg-secondary/50">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
            Rejection emails that never explain anything
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            Every week, thousands of publishers apply to Google AdSense and get back the same two words: low value
            content. No reason, no details, no path forward. They rewrite, reapply, and get rejected again. We built
            Audit Form to close that gap.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">What we actually do</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              We crawl your site the way an evaluator would see it: pages, content, navigation, policy documents,
              indexing health and structure. A frontier AI model then reviews the evidence against the published
              rules of AdSense and premium networks, and tells you the truth: what is fine, what is weak, and what
              is actively getting you rejected.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              We are not affiliated with Google. We simply apply their published policies, plus observed approval
              patterns, to your site before you spend weeks waiting in a review queue.
            </p>
            <ul className="mt-5 space-y-2.5">
              {[
                "Evidence-based: every finding cites what was found in the crawl",
                "Honest: when traffic data cannot be verified externally, we say so",
                "Actionable: a numbered roadmap, not vague advice",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm font-medium text-foreground">
                  <CircleCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-primary" /> {t}
                </li>
              ))}
            </ul>
            <Button asChild className="mt-6 rounded-md font-semibold">
              <Link href="/register">Try it with free credits</Link>
            </Button>
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            <Illustration name="support" alt="The Audit Form team supporting publishers" />
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
