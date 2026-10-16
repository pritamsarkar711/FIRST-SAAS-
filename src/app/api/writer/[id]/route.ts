import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const job = await db.contentJob.findUnique({ where: { id } });
  if (!job || (job.userId !== user.id && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    type: job.type,
    mode: job.mode,
    keyword: job.keyword,
    status: job.status,
    result: job.result ? JSON.parse(job.result) : null,
    images: job.images ? JSON.parse(job.images) : [],
    error: job.error,
    createdAt: job.createdAt,
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const job = await db.contentJob.findUnique({ where: { id } });
  if (!job || job.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.contentJob.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
