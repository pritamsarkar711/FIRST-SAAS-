import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const audit = await db.audit.findUnique({ where: { id } });
  if (!audit || (audit.userId !== user.id && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: audit.id,
    status: audit.status,
    probability: audit.probability,
    verdict: audit.verdict,
    report: audit.report ? JSON.parse(audit.report) : null,
    error: audit.error,
    domain: audit.domain,
    target: audit.target,
    mode: audit.mode,
    createdAt: audit.createdAt,
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const audit = await db.audit.findUnique({ where: { id } });
  if (!audit || audit.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.audit.delete({ where: { id } });
  logActivity({
    action: "AUDIT_DELETE",
    actorEmail: session.user.email,
    userId: user.id,
    detail: audit.domain,
  });
  return NextResponse.json({ ok: true });
}
