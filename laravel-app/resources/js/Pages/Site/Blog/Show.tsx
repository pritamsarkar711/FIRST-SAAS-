import { Head, Link } from "@inertiajs/react";
import { ArrowLeft } from "lucide-react";
import { LogoMark } from "@/components/logo";
import SiteShell from "@/components/site-shell";

interface PostRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  publishedAt: string | null;
  updatedAt: string;
  views: number;
  author?: { name: string | null } | null;
}

function readingMinutes(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const words = text ? text.split(" ").length : 0;
  return Math.max(1, Math.round(words / 220));
}

export default function BlogShow({ post }: { post: PostRow }) {
  const minutes = readingMinutes(post.content);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.metaDescription || post.excerpt || undefined,
    datePublished: post.publishedAt || undefined,
    dateModified: post.updatedAt,
    author: { "@type": "Person", name: post.author?.name || "Audit Form Team" },
    publisher: { "@type": "Organization", name: "Audit Form" },
    mainEntityOfPage: post.slug,
  };

  return (
    <SiteShell>
      <Head title={post.metaTitle || post.title}>
        <meta name="description" content={post.metaDescription || post.excerpt || undefined} />
        <meta property="og:title" content={post.metaTitle || post.title} />
        <meta property="og:description" content={post.metaDescription || post.excerpt || undefined} />
        <meta property="og:type" content="article" />
      </Head>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className={post.coverImage ? "relative h-64 w-full border-b border-border sm:h-80" : "border-b border-border bg-secondary/60"}>
        {post.coverImage ? (
          <img src={post.coverImage} alt={post.title} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="dotgrid flex h-40 items-center justify-center sm:h-48">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10">
              <LogoMark className="h-9 w-9" />
            </span>
          </div>
        )}
      </div>
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> All posts
        </Link>
        <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-[2.4rem]">{post.title}</h1>
        <p className="mt-3 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
          <span>{post.author?.name || "Audit Form Team"}</span>
          <span aria-hidden="true">·</span>
          <span>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : ""}</span>
          <span aria-hidden="true">·</span>
          <span>{minutes} min read</span>
          <span aria-hidden="true">·</span>
          <span>{post.views.toLocaleString()} views</span>
        </p>
        {post.excerpt ? <p className="mt-5 border-l-[3px] border-primary pl-4 text-[15px] italic leading-relaxed text-muted-foreground">{post.excerpt}</p> : null}
        <div className="article-body mt-8" dangerouslySetInnerHTML={{ __html: post.content }} />
      </article>
    </SiteShell>
  );
}
