import { usePage } from "@inertiajs/react";
import { AdminShell } from "@/components/admin/shell";
import { MessagesManager } from "@/components/admin/messages-manager";

export default function ManageMessages() {
  const { props } = usePage<any>();
  const adminName = props.adminName ?? (props.auth?.user?.name || props.auth?.user?.email || "");

  return (
    <AdminShell adminName={adminName}>
      <MessagesManager />
    </AdminShell>
  );
}
