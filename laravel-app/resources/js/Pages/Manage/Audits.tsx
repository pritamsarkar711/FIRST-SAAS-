import { usePage } from "@inertiajs/react";
import { AdminShell } from "@/components/admin/shell";
import { AuditsManager } from "@/components/admin/audits-manager";

export default function ManageAudits() {
  const { props } = usePage<any>();
  const adminName = props.adminName ?? (props.auth?.user?.name || props.auth?.user?.email || "");

  return (
    <AdminShell adminName={adminName}>
      <AuditsManager />
    </AdminShell>
  );
}
