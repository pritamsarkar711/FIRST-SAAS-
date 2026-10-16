import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Clock } from "lucide-react";
import { db } from "@/lib/db";
import { LogoMark } from "@/components/logo";

export const metadata = {
  title: "Blog",
  description: "Guides on AdSense approval, low value content fixes, ad network requirements and publisher monetization.",
};
export const dynamic = "force-dynamic";

function readingMinutes(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const words = text ? text.split(" ").length : 0;
  return Math.max(1, Math.round(words / 220));
}

export default async function BlogListPage() {
  const posts = await db.blogPost.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
  });

  return (
    <>
      <section className="border-b border-border bg-secondary/50">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Blog</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Practical guides on getting approved and staying approved.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        {posts.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">New guides are on the way. Check back soon.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <Link key={p.id} href={`/blog/${p.slug}`} className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-[0_2px_12px_rgba(27,38,32,0.08)]">
              {p.coverImage ? (
                <div className="relative h-44 w-full border-b border-border">
                  <Image src={p.coverImage} alt={p.title} fill sizes="(max-width: 640px) 100vw, 400px" className="object-cover" />
                </div>
              ) : (
                <div className="dotgrid relative flex h-44 w-full items-center justify-center border-b border-border bg-secondary/50">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-primary/10">
                    <LogoMark className="h-7 w-7" />
                  </span>
                </div>
              )}
              <div className="flex flex-1 flex-col p-5">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                  {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" /> {readingMinutes(p.content)} min</span>
                </p>
                <h2 className="mt-2 font-bold leading-snug text-foreground group-hover:text-primary">{p.title}</h2>
                <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">{p.excerpt}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  Read <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
          </div>
        )}
      </section>
    </>
  );
}
