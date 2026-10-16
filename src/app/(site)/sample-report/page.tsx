import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ReportView } from "@/components/shared/report-view";
import type { AuditReport } from "@/lib/audit-runner";

export const metadata: Metadata = {
  title: "Sample audit report",
  description: "A complete example of an Audit Form report: approval probability, color-coded findings, strengths, risks, critical fixes and a fix-first roadmap.",
};

// Illustrative example aligned with the homepage mockup. The domain is fictional.
const SAMPLE_REPORT: AuditReport = {
  probability: 62,
  verdict: "WAIT_AND_IMPROVE",
  summary:
    "mygreengarden.com has a real foundation: a clean WordPress install, a working sitemap, and the trust pages Google looks for. What holds the score back is depth. The sitemap lists 8 posts where comparable approved sites show 25 or more, two sampled articles land under 600 words, and category pages are empty shells. None of these are fatal on their own. Together they read as a young site, and young sites get the closest look.",
  sections: [
    {
      key: "content",
      title: "Content depth and quality",
      score: 55,
      status: "warn",
      items: [
        { label: "8 posts in sitemap, 25 recommended", status: "warn", detail: "Sites approved for AdSense in this niche typically show 20 to 40 indexed posts. With 8, the reviewer sees a site that has not yet settled into a publishing rhythm." },
        { label: "2 sampled articles under 600 words", status: "risk", detail: "The sampler pulled two recent posts at 540 and 610 words. Short posts are not an automatic rejection, but they make every other weakness look worse." },
        { label: "No author bylines detected", status: "warn", detail: "None of the sampled articles show a named author. E-E-A-T reviews look for a real person behind the advice, especially for topics like plant care that touch safety." },
        { label: "Original imagery on newer posts", status: "ok", detail: "Recent posts use original photos rather than stock bundles, which is a genuine quality signal reviewers notice." },
      ],
    },
    {
      key: "policy",
      title: "Policy pages and trust",
      score: 88,
      status: "ok",
      items: [
        { label: "Privacy Policy and Contact page found", status: "ok", detail: "Both pages are linked in the footer and reachable in one click. The contact page exposes a working mail link and a short form." },
        { label: "About page names the author", status: "ok", detail: "The About page describes the gardener behind the site with a photo and two years of context. Good sign for E-E-A-T." },
        { label: "No terms page", status: "warn", detail: "Terms are not strictly required for AdSense, but a short terms page rounds out the trust cluster for pennies of effort." },
      ],
    },
    {
      key: "navigation",
      title: "Navigation and user experience",
      score: 52,
      status: "warn",
      items: [
        { label: "Category pages are empty", status: "risk", detail: "3 of 4 category pages render zero posts. Reviewers click through categories, and empty ones suggest an unfinished site." },
        { label: "Menu structure is clear", status: "ok", detail: "Header navigation groups content into four sensible categories and reaches any post in two clicks." },
        { label: "Mobile layout holds up", status: "ok", detail: "No horizontal scroll or overlapping elements at phone widths, which protects the ad experience after approval." },
      ],
    },
    {
      key: "technical",
      title: "Technical and indexing",
      score: 74,
      status: "ok",
      items: [
        { label: "Sitemap submitted and crawlable", status: "ok", detail: "sitemap.xml resolves, returns 8 URLs and is referenced from robots.txt. Indexing basics are in place." },
        { label: " robots.txt allows article paths", status: "ok", detail: "No blocking rules on posts or categories. Crawl directives look intentional." },
        { label: "Mixed HTTP links on 1 older post", status: "warn", detail: "One 2024 post still embeds two http:// image links. Trivial to fix and removes a console warning." },
      ],
    },
    {
      key: "traffic",
      title: "Traffic and engagement",
      score: 48,
      status: "warn",
      items: [
        { label: "Comment activity on recent posts", status: "ok", detail: "Two recent posts show real comment threads with replies, which reviewers read as genuine audience interest." },
        { label: "No visible traffic evidence", status: "warn", detail: "Public signals (search presence, referral mentions) are thin. This is normal at 8 posts and improves fastest by publishing." },
      ],
    },
    {
      key: "adsense",
      title: "AdSense policy compliance",
      score: 80,
      status: "ok",
      items: [
        { label: "No prohibited content detected", status: "ok", detail: "Sampled content stays inside AdSense program policies: no adult, weapons, or misleading health claims." },
        { label: "No existing ad code", status: "ok", detail: "The site is clean of other ad networks, so there is no policy conflict to untangle at review time." },
        { label: "Disclosure missing on 1 affiliate-style post", status: "warn", detail: "A gear-review post links to shop pages without an affiliate disclosure. Add one sentence above the first link." },
      ],
    },
  ],
  strengths: [
    "Trust pages are complete and linked from every page",
    "Sitemap and robots.txt are correct and submitted",
    "Original photos instead of stock imagery on new posts",
    "Clean mobile layout with no overflow issues",
  ],
  risks: [
    "Only 8 posts published, well under the depth reviewers expect",
    "Sampled articles sit at or under the 600-word floor",
    "Empty category pages make the site look unfinished",
    "No author bylines to anchor E-E-A-T",
  ],
  criticalFixes: [
    "Bring every published post to 800+ words, starting with the two sampled articles",
    "Fill or remove the three empty categories before applying",
  ],
  roadmap: [
    { step: 1, title: "Deepen the two thin articles", detail: "Expand the 540 and 610 word posts to 900+ words with concrete steps, your own photos and a short FAQ block. This removes the single loudest rejection reason on the report." },
    { step: 2, title: "Fix the category pages", detail: "Assign the three empty categories to existing posts, or hide them from the menu until they hold at least 3 articles each." },
    { step: 3, title: "Publish to 25 posts", detail: "At your current pace of 2 posts a week this is roughly two months of work. Keep every post 800 words or more and attach a real author name." },
    { step: 4, title: "Add bylines and an author box", detail: "Surface the author from the About page on every article. A one-line bio with a photo is enough at this stage." },
    { step: 5, title: "Re-run this audit", detail: "After steps 1 and 2 the score typically moves 15 to 20 points. Members can re-check any time, and monitored domains re-check themselves weekly." },
  ],
};

const SAMPLE_SIGNALS = {
  estimatedPages: 8,
  articles: [{ length: 540 }, { length: 610 }],
  sitemap: { exists: true, urlCount: 8 },
  homepage: { platform: "WordPress" },
  deepScan: true,
  sitemapsTraversed: 2,
  navPageChecks: [
    { path: "about", url: "https://mygreengarden.com/about/", statusCode: 200, wordCount: 410, hasContent: true },
    { path: "contact", url: "https://mygreengarden.com/contact/", statusCode: 200, wordCount: 95, hasContent: false },
    { path: "privacy", url: "https://mygreengarden.com/privacy-policy/", statusCode: 200, wordCount: 1240, hasContent: true },
  ],
  categoryCheck: { url: "https://mygreengarden.com/category/vegetables/", statusCode: 200, wordCount: 210, articleLinks: 6 },
  contentFreshness: { newest: "2026-09-28", oldest: "2026-04-11", datedArticles: 10, within365d: 10, within90d: 3 },
  thinArticleRatio: 0.3,
};

export default function SampleReportPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
      {/* Intro banner */}
      <div className="rounded-lg border border-border bg-card p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">Sample report</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          This is exactly what you get before you apply
        </h1>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
          Below is a complete Audit Form report for a fictional gardening blog. Every real report looks like
          this: an approval probability, findings in green, orange and red, and a fix list ordered by what
          moves the needle first. The example site has real strengths and real problems, because a useful
          report tells you both.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button asChild className="rounded-md font-semibold">
            <Link href="/register">Check my site free</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-md font-semibold">
            <Link href="/pricing">See plans</Link>
          </Button>
        </div>
      </div>

      {/* The report itself */}
      <div className="mt-8">
        <ReportView
          domain="mygreengarden.com"
          target="ADSENSE"
          mode="STANDARD"
          createdAt={new Date()}
          report={SAMPLE_REPORT}
          signals={SAMPLE_SIGNALS}
          footerNote="Sample report for illustration. The domain shown is fictional. Your report analyzes your real site, live."
        />
      </div>

      {/* Bottom CTA */}
      <div className="mt-8 rounded-lg border border-border bg-card p-6 text-center sm:p-8">
        <h2 className="text-xl font-bold tracking-tight text-foreground">What would your site score?</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Signup takes an email, free credits land instantly, and your first audit usually finishes in two
          to three minutes. No card required.
        </p>
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild className="rounded-md font-semibold">
            <Link href="/register">Run my first audit</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-md font-semibold">
            <Link href="/how-it-works">How the audit works</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
