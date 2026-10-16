import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  const gateways = await db.gatewayConfig.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ gateways });
}

const schema = z.object({
  id: z.string().min(1),
  enabled: z.boolean().optional(),
  mode: z.enum(["MANUAL", "API"]).optional(),
  instructions: z.string().max(1000).optional(),
  config: z.string().max(4000).optional(),
});

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid gateway data." }, { status: 400 });
  const { id, config, ...rest } = parsed.data;
  if (config !== undefined) {
    try { JSON.parse(config); } catch {
      return NextResponse.json({ error: "Config must be valid JSON (API keys and settings)." }, { status: 400 });
    }
  }
  await db.gatewayConfig.update({
    where: { id },
    data: { ...rest, ...(config !== undefined ? { config } : {}) },
  });
  return NextResponse.json({ ok: true });
}
