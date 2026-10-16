import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCosts } from "@/lib/credits";
import { WriterWorkspace } from "@/components/dashboard/writer-workspace";

export const metadata = { title: "Content writer" };
export const dynamic = "force-dynamic";

export default async function WriterPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const session = await auth();
  const user = await db.user.findUnique({ where: { email: session!.user!.email! }, select: { id: true, credits: true } });
  const [costs, jobs] = await Promise.all([
    getCosts(),
    db.contentJob.findMany({
      where: { userId: user!.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, type: true, keyword: true, status: true, createdAt: true },
    }),
  ]);

  return (
    <WriterWorkspace
      costs={costs.writer}
      credits={user!.credits}
      jobs={jobs.map((j) => ({ ...j, createdAt: j.createdAt.toISOString() }))}
      initialTab={tab === "affiliate" ? "AFFILIATE" : "ADSENSE"}
    />
  );
}
