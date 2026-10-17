import { AdminLoginScreen } from "@/components/admin/login-screen";

export default function ManageLogin({ googleEnabled = false }: { googleEnabled?: boolean }) {
  return <AdminLoginScreen googleEnabled={googleEnabled} />;
}
