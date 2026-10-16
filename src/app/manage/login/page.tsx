import { AdminLoginScreen } from "@/components/admin/login-screen";
import { ensureSeeded } from "@/lib/seed";
import { getSetting, GOOGLE_DEFAULTS } from "@/lib/settings";

export const metadata = { title: "Admin sign in" };
export const dynamic = "force-dynamic";

export default async function ManageLoginPage() {
  await ensureSeeded().catch(() => {});
  // Google sign-in appears only when OAuth credentials are configured
  // (environment first, then the admin-panel setting) - mirrors auth.ts.
  const g = await getSetting("google", GOOGLE_DEFAULTS).catch(() => null);
  const clientId = process.env.GOOGLE_CLIENT_ID || (g && g.clientId) || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || (g && g.clientSecret) || "";
  const googleEnabled = Boolean(clientId && clientSecret);
  return <AdminLoginScreen googleEnabled={googleEnabled} />;
}
