import { usePage } from "@inertiajs/react";
import { AdminShell } from "@/components/admin/shell";
import { PlansManager } from "@/components/admin/plans-manager";

export default function ManagePlans() {
  const { props } = usePage<any>();
  const adminName = props.adminName ?? (props.auth?.user?.name || props.auth?.user?.email || "");

  return (
    <AdminShell adminName={adminName}>
      <PlansManager />
    </AdminShell>
  );
}
