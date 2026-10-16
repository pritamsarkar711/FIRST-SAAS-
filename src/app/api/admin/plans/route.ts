import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  const plans = await db.plan.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ plans });
}

const planSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(40),
  slug: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/),
  description: z.string().trim().max(200).optional().default(""),
  priceUsd: z.number().min(0).max(100000),
  credits: z.number().int().min(0).max(1000000),
  featuresRaw: z.string().max(2000).optional().default(""),
  badge: z.string().trim().max(30).optional().default(""),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(99).default(0),
});

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const parsed = planSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid plan data." }, { status: 400 });
  const d = parsed.data;
  const features = JSON.stringify(d.featuresRaw.split("\n").map((f) => f.trim()).filter(Boolean));
  const data = {
    name: d.name, slug: d.slug, description: d.description || null, priceUsd: d.priceUsd,
    credits: d.credits, features, badge: d.badge || null, active: d.active, sortOrder: d.sortOrder,
  };

  if (d.id) {
    await db.plan.update({ where: { id: d.id }, data });
  } else {
    await db.plan.create({ data });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Plan id required." }, { status: 400 });
  const inUse = await db.payment.count({ where: { planId: id } });
  if (inUse > 0) {
    await db.plan.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ ok: true, message: "Plan has payments, so it was deactivated instead of deleted." });
  }
  await db.plan.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
