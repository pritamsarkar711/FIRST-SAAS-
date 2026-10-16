import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessionProvider } from "@/components/session-provider";
import { db } from "@/lib/db";
import { AdminShell } from "@/components/admin/shell";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function ManagePanelLayout({ children }: { children: React.ReactNode }) {
  await ensureSeeded().catch(() => {});
  const session = await auth();
  if (!session?.user?.email) redirect("/manage/login");
  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user || user.role !== "ADMIN") redirect("/dashboard");

  return (
    <SessionProvider session={session}>
      <AdminShell adminName={user.name || user.email}>{children}</AdminShell>
    </SessionProvider>
  );
}
