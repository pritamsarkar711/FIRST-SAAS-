import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { SettingsWorkspace } from "@/components/dashboard/settings-workspace";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  const user = await db.user.findUnique({
    where: { email: session!.user!.email! },
    select: { name: true, email: true, twoFactorEnabled: true },
  });
  return <SettingsWorkspace user={{ name: user!.name || "", email: user!.email, twoFactorEnabled: user!.twoFactorEnabled }} />;
}
