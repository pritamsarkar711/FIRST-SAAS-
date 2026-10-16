import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const post = await db.blogPost.findUnique({ where: { id } });
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ post });
  }
  const posts = await db.blogPost.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, slug: true, status: true, views: true, publishedAt: true, createdAt: true },
  });
  return NextResponse.json({ posts });
}

const schema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(4).max(180),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/),
  excerpt: z.string().trim().max(400).optional().default(""),
  content: z.string().min(10).max(200_000),
  coverImage: z.string().max(400).optional().default(""),
  metaTitle: z.string().trim().max(70).optional().default(""),
  metaDescription: z.string().trim().max(160).optional().default(""),
  status: z.enum(["DRAFT", "PUBLISHED"]),
});

export async function POST(req: NextRequest) {
  const { user: admin, error } = await requireAdmin();
  if (error) return error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid post data." }, { status: 400 });
  }
  const d = parsed.data;
  const data = {
    title: d.title, slug: d.slug, excerpt: d.excerpt || null, content: d.content,
    coverImage: d.coverImage || null, metaTitle: d.metaTitle || null, metaDescription: d.metaDescription || null,
    status: d.status,
    publishedAt: d.status === "PUBLISHED" ? new Date() : null,
  };

  if (d.id) {
    const existing = await db.blogPost.findUnique({ where: { id: d.id } });
    if (!existing) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    await db.blogPost.update({
      where: { id: d.id },
      data: { ...data, publishedAt: existing.publishedAt ?? data.publishedAt },
    });
    return NextResponse.json({ ok: true, id: d.id });
  }
  const post = await db.blogPost.create({ data: { ...data, authorId: admin.id } });
  return NextResponse.json({ ok: true, id: post.id });
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Post id required." }, { status: 400 });
  await db.blogPost.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
