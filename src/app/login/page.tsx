import { AuthForm } from "@/components/shared/auth-form";
import { ensureSeeded } from "@/lib/seed";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await ensureSeeded().catch(() => {});
  return <AuthForm mode="login" />;
}
