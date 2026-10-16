import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

async function getPost(slug: string) {
  const post = await db.blogPost.findUnique({ where: { slug }, include: { author: { select: { name: true } } } });
  return post;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Post not found" };
  return {
    title: post.metaTitle || post.title,
    description: post.metaDescription || post.excerpt || undefined,
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post || post.status !== "PUBLISHED") notFound();

  await db.blogPost.update({ where: { id: post.id }, data: { views: { increment: 1 } } }).catch(() => {});

  return (
    <>
      {post.coverImage ? (
        <div className="relative h-64 w-full border-b border-border sm:h-80">
          <Image src={post.coverImage} alt={post.title} fill priority sizes="100vw" className="object-cover" />
        </div>
      ) : null}
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> All posts
        </Link>
        <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-[2.4rem]">{post.title}</h1>
        <p className="mt-3 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
          <span>{post.author.name || "AdAudit Team"}</span>
          <span aria-hidden="true">·</span>
          <span>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : ""}</span>
          <span aria-hidden="true">·</span>
          <span>{post.views.toLocaleString()} views</span>
        </p>
        {post.excerpt ? <p className="mt-5 border-l-[3px] border-primary pl-4 text-[15px] italic leading-relaxed text-muted-foreground">{post.excerpt}</p> : null}
        <div className="article-body mt-8" dangerouslySetInnerHTML={{ __html: post.content }} />
      </article>
    </>
  );
}
