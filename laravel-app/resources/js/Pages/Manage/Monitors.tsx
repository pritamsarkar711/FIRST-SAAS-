import { usePage } from "@inertiajs/react";
import { AdminShell } from "@/components/admin/shell";
import { MonitorsManager } from "@/components/admin/monitors-manager";

export default function ManageMonitors() {
  const { props } = usePage<any>();
  const adminName = props.adminName ?? (props.auth?.user?.name || props.auth?.user?.email || "");

  return (
    <AdminShell adminName={adminName}>
      <MonitorsManager />
    </AdminShell>
  );
}
