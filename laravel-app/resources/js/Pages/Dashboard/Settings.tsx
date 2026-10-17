import { Head, usePage } from "@inertiajs/react";
import { SettingsWorkspace } from "@/components/dashboard/settings-workspace";
import { DashboardShell } from "@/components/dashboard/shell";

/** Port of src/app/dashboard/settings/page.tsx. */
export default function Settings({ user }: {
  user: { name: string; email: string; twoFactorEnabled: boolean };
}) {
  const { auth } = usePage<any>().props;

  return (
    <DashboardShell credits={auth.user.credits} userName={auth.user.name || auth.user.email} isAdmin={auth.user.role === "ADMIN"}>
      <Head title="Settings" />
      <SettingsWorkspace user={user} />
    </DashboardShell>
  );
}
