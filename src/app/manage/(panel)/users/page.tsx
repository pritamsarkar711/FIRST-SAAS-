import { UsersManager } from "@/components/admin/users-manager";

export const metadata = { title: "Users" };
export const dynamic = "force-dynamic";

export default function AdminUsersPage() {
  return <UsersManager />;
}
