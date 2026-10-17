import { usePage } from "@inertiajs/react";
import { AdminShell } from "@/components/admin/shell";
import { UsersManager } from "@/components/admin/users-manager";

export default function ManageUsers() {
  const { props } = usePage<any>();
  const adminName = props.adminName ?? (props.auth?.user?.name || props.auth?.user?.email || "");

  return (
    <AdminShell adminName={adminName}>
      <UsersManager />
    </AdminShell>
  );
}
