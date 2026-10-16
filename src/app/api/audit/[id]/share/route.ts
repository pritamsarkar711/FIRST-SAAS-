import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const audit = await db.audit.findUnique({ where: { id } });
  if (!audit || audit.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (audit.status !== "DONE" || !audit.report) {
    return NextResponse.json({ error: "Only completed audits can be shared." }, { status: 400 });
  }

  const token = audit.shareToken || randomBytes(12).toString("hex");
  await db.audit.update({ where: { id }, data: { shareToken: token } });
  return NextResponse.json({ ok: true, url: `/share/${token}` });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const audit = await db.audit.findUnique({ where: { id } });
  if (!audit || audit.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.audit.update({ where: { id }, data: { shareToken: null } });
  return NextResponse.json({ ok: true });
}
