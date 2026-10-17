import { usePage } from "@inertiajs/react";
import { AdminShell } from "@/components/admin/shell";
import { SettingsManager } from "@/components/admin/settings-manager";

export default function ManageSettings() {
  const { props } = usePage<any>();
  const adminName = props.adminName ?? (props.auth?.user?.name || props.auth?.user?.email || "");

  return (
    <AdminShell adminName={adminName}>
      <SettingsManager />
    </AdminShell>
  );
}
