import { usePage } from "@inertiajs/react";
import { AdminShell } from "@/components/admin/shell";
import { BlogManager } from "@/components/admin/blog-manager";

export default function ManageBlog() {
  const { props } = usePage<any>();
  const adminName = props.adminName ?? (props.auth?.user?.name || props.auth?.user?.email || "");

  return (
    <AdminShell adminName={adminName}>
      <BlogManager />
    </AdminShell>
  );
}
