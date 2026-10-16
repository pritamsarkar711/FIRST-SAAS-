import { AdminLoginScreen } from "@/components/admin/login-screen";
import { ensureSeeded } from "@/lib/seed";

export const metadata = { title: "Admin sign in" };
export const dynamic = "force-dynamic";

export default async function ManageLoginPage() {
  await ensureSeeded().catch(() => {});
  return <AdminLoginScreen />;
}
