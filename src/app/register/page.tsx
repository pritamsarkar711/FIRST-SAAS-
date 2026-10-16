import { AuthForm } from "@/components/shared/auth-form";
import { ensureSeeded } from "@/lib/seed";

export const metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  await ensureSeeded().catch(() => {});
  return <AuthForm mode="register" />;
}
