import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { LogoMark } from "@/components/logo";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

async function getPost(slug: string) {
  const post = await db.blogPost.findUnique({ where: { slug }, include: { author: { select: { name: true } } } });
  return post;
}

function readingMinutes(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const words = text ? text.split(" ").length : 0;
  return Math.max(1, Math.round(words / 220));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Post not found" };
  return {
    title: post.metaTitle || post.title,
    description: post.metaDescription || post.excerpt || undefined,
    openGraph: {
      title: post.metaTitle || post.title,
      description: post.metaDescription || post.excerpt || undefined,
      type: "article",
      publishedTime: post.publishedAt?.toISOString(),
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post || post.status !== "PUBLISHED") notFound();

  await db.blogPost.update({ where: { id: post.id }, data: { views: { increment: 1 } } }).catch(() => {});

  const minutes = readingMinutes(post.content);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.metaDescription || post.excerpt || undefined,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { "@type": "Person", name: post.author.name || "Audit Form Team" },
    publisher: { "@type": "Organization", name: "Audit Form" },
    mainEntityOfPage: post.slug,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className={post.coverImage ? "relative h-64 w-full border-b border-border sm:h-80" : "border-b border-border bg-secondary/60"}>
        {post.coverImage ? (
          <Image src={post.coverImage} alt={post.title} fill priority sizes="100vw" className="object-cover" />
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
          <span>{post.author.name || "Audit Form Team"}</span>
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
    </>
  );
}
