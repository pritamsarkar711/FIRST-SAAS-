import { auth } from "@/lib/auth";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { getCosts } from "@/lib/credits";
import { IndexerWorkspace } from "@/components/dashboard/indexer-workspace";

export const metadata = { title: "Quick index" };
export const dynamic = "force-dynamic";

export default async function IndexerPage() {
  const session = await auth();
  const user = await db.user.findUnique({ where: { email: session!.user!.email! }, select: { id: true, credits: true } });
  const costs = await getCosts();
  const key = createHash("sha256").update(`${user!.id}:${process.env.NEXTAUTH_SECRET || "adaudit"}`).digest("hex").slice(0, 32);

  return <IndexerWorkspace costs={costs} credits={user!.credits} initialKey={key} />;
}
