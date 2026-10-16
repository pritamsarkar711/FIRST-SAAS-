import { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes } from "crypto";

const db = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

const POSTS = [
  {
    title: "Why Google says low value content and what it actually means",
    slug: "low-value-content-meaning-and-fixes",
    excerpt:
      "The most common AdSense rejection reason explained: what reviewers look for, which page patterns trigger it, and the exact order to fix things in.",
    metaTitle: "Low Value Content: What It Means and How to Fix It",
    metaDescription:
      "A plain explanation of the low value content rejection, the page patterns that cause it, and a practical fix order for bloggers.",
    content: `<p>If your AdSense application was rejected, the email probably contained two words: low value content. It is the most common reason and also the most confusing one, because Google never lists the pages or the patterns it disliked. Here is what that phrase actually covers and what to do about it.</p>
<h2>What counts as low value</h2>
<p>Reviewers compare your pages against what a searcher would find useful. The rejection usually means some combination of these patterns:</p>
<ul>
<li>Articles under 600 words that cover a topic thinner than existing search results</li>
<li>Multiple posts that repeat the same information with different titles</li>
<li>Auto-generated or heavily templated content with little original input</li>
<li>Category or tag pages full of short, empty listings</li>
<li>Posts copied or lightly paraphrased from other sites</li>
<li>Content that reads like product listings rather than helpful articles</li>
</ul>
<h2>Why the whole site gets judged</h2>
<p>AdSense approval is a site level decision, not a per article one. Three or four thin pages among genuinely helpful ones can sink the review, because the reviewer cannot assume which pages will carry ads. This is why pruning matters as much as writing.</p>
<h2>The fix order that works</h2>
<p>Start by deleting or noindexing anything you would not show a reviewer on purpose: empty categories, tag archives, affiliate-only stubs and placeholder posts. Then take ten of your best topics and make each one the most complete, honest answer on the internet for that exact question. Aim for depth through usefulness, not word count padding. Add an author name, an about page and a contact page so the reviewer can see a real publisher behind the site.</p>
<h2>How to check before reapplying</h2>
<p>Count the posts Google can actually index, read three of them at random and ask whether each solves a problem completely, then run a full audit against the published policy checklist. Tools like our AdSense readiness audit do exactly this: they crawl your sitemap, sample real articles and score the same signals a reviewer weighs, so you can reapply when the evidence says you are ready rather than hoping this time is different.</p>`,
  },
  {
    title: "How many posts do you need before applying to AdSense",
    slug: "how-many-posts-before-applying-adsense",
    excerpt:
      "There is no official minimum, but real approvals cluster around a clear pattern of indexed posts, topic coverage and site age. Here is the honest math.",
    metaTitle: "How Many Posts Before Applying to AdSense? Honest Math",
    metaDescription:
      "There is no official post minimum for AdSense. Here is what approval data and policy reviews actually suggest before you apply.",
    content: `<p>Google has never published a minimum post count for AdSense. But if you look at how rejections cluster, a pattern emerges that is worth understanding before you spend an application attempt.</p>
<h2>The practical floor</h2>
<p>Sites that get approved on a first attempt almost always have at least 20 to 30 indexed, substantial posts: articles between 800 and 2,500 words that each answer one question completely. Below that range, reviewers have too little evidence that the site will keep producing value, so low value content rejections become common even when every existing post is good.</p>
<h2>Quality beats volume, but structure needs evidence</h2>
<p>A site with 25 genuinely helpful posts consistently beats a site with 100 rushed ones. The trap is counting every short note as a post. Reviewers see the whole index: if half your URLs are thin tag pages, product roundups or announcements, the helpful fraction is too small to carry the decision.</p>
<h2>Signals that matter as much as the count</h2>
<ul>
<li>One clear topic or a tight set of related topics, not a scatter of unrelated niches</li>
<li>Policy pages: about, contact, privacy policy and a disclaimer where relevant</li>
<li>A clean navigation structure a stranger can follow without getting lost</li>
<li>Some evidence of updates: fresh dates, corrected mistakes, added sections</li>
</ul>
<h2>Timing your application</h2>
<p>Apply when the checklist above is boringly complete and your analytics show at least some organic or consistent traffic. A useful rule: if you would be embarrassed by any single page in your sitemap, fix or remove it before applying. Running a readiness audit before the application costs minutes, while a rejection costs a review cycle and sometimes weeks of waiting between attempts.</p>`,
  },
];

async function main() {
  const admin = await db.user.findUnique({ where: { email: "admin@adaudit.app" } });
  if (!admin) throw new Error("Admin not seeded yet");
  for (const p of POSTS) {
    await db.blogPost.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        content: p.content,
        metaTitle: p.metaTitle,
        metaDescription: p.metaDescription,
        status: "PUBLISHED",
        publishedAt: new Date(),
        authorId: admin.id,
      },
    });
  }
  console.log("blog posts seeded");
}

main().finally(() => db.$disconnect());
