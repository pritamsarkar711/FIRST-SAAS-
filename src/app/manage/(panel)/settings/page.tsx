import { SettingsManager } from "@/components/admin/settings-manager";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default function AdminSettingsPage() {
  return <SettingsManager />;
}
