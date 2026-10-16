import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user || user.role !== "ADMIN") return { user: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user, error: null };
}
