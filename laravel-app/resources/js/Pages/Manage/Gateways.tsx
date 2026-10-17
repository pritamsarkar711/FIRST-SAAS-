import { usePage } from "@inertiajs/react";
import { AdminShell } from "@/components/admin/shell";
import { GatewaysManager } from "@/components/admin/gateways-manager";

export default function ManageGateways() {
  const { props } = usePage<any>();
  const adminName = props.adminName ?? (props.auth?.user?.name || props.auth?.user?.email || "");

  return (
    <AdminShell adminName={adminName}>
      <GatewaysManager />
    </AdminShell>
  );
}
