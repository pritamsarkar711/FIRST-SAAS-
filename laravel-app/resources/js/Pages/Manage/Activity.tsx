import { usePage } from "@inertiajs/react";
import { AdminShell } from "@/components/admin/shell";
import { ActivityManager } from "@/components/admin/activity-manager";

export default function ManageActivity() {
  const { props } = usePage<any>();
  const adminName = props.adminName ?? (props.auth?.user?.name || props.auth?.user?.email || "");

  return (
    <AdminShell adminName={adminName}>
      <ActivityManager />
    </AdminShell>
  );
}
