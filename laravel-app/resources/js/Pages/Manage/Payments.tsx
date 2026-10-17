import { usePage } from "@inertiajs/react";
import { AdminShell } from "@/components/admin/shell";
import { PaymentsManager } from "@/components/admin/payments-manager";

export default function ManagePayments() {
  const { props } = usePage<any>();
  const adminName = props.adminName ?? (props.auth?.user?.name || props.auth?.user?.email || "");

  return (
    <AdminShell adminName={adminName}>
      <PaymentsManager />
    </AdminShell>
  );
}
