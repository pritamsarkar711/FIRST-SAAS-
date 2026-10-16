import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessionProvider } from "@/components/session-provider";
import { db } from "@/lib/db";
import { DashboardShell } from "@/components/dashboard/shell";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await ensureSeeded().catch(() => {});
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) redirect("/login");
  if (user.status === "SUSPENDED") redirect("/suspended");

  return (
    <SessionProvider session={session}>
      <DashboardShell credits={user.credits} userName={user.name || user.email} isAdmin={user.role === "ADMIN"}>
        {children}
      </DashboardShell>
    </SessionProvider>
  );
}
