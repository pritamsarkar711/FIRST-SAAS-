import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCosts } from "@/lib/credits";
import { AuditWorkspace } from "@/components/dashboard/audit-workspace";

export const metadata = { title: "Site audit" };
export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const session = await auth();
  const user = await db.user.findUnique({
    where: { email: session!.user!.email! },
    select: { id: true, credits: true },
  });
  const [costs, history] = await Promise.all([
    getCosts(),
    db.audit.findMany({
      where: { userId: user!.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, domain: true, target: true, mode: true, status: true, probability: true, verdict: true, createdAt: true },
    }),
  ]);

  return (
    <AuditWorkspace
      costs={costs.audit}
      credits={user!.credits}
      history={history.map((h) => ({ ...h, createdAt: h.createdAt.toISOString() }))}
    />
  );
}
