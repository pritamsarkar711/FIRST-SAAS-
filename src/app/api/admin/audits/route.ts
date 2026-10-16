import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  const audits = await db.audit.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { email: true } } },
  });
  return NextResponse.json({
    audits: audits.map((a) => ({
      id: a.id, domain: a.domain, target: a.target, mode: a.mode, status: a.status,
      probability: a.probability, verdict: a.verdict, createdAt: a.createdAt,
      user: { email: a.user.email },
    })),
  });
}
