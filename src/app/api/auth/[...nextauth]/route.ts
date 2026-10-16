import NextAuth from "next-auth";
import { buildAuthOptions } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";

const handler = async (req: Request, ctx: { params: Promise<{ nextauth: string[] }> }) => {
  await ensureSeeded();
  const options = await buildAuthOptions();
  return NextAuth(options)(req as never, ctx as never);
};

export { handler as GET, handler as POST };
