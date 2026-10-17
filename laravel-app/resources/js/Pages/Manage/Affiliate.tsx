import { usePage } from "@inertiajs/react";
import { AdminShell } from "@/components/admin/shell";
import { AffiliateManager } from "@/components/admin/affiliate-manager";

export default function ManageAffiliate() {
  const { props } = usePage<any>();
  const adminName = props.adminName ?? (props.auth?.user?.name || props.auth?.user?.email || "");

  return (
    <AdminShell adminName={adminName}>
      <AffiliateManager />
    </AdminShell>
  );
}
