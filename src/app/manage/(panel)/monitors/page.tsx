import { MonitorsManager } from "@/components/admin/monitors-manager";

export const metadata = { title: "Monitors" };
export const dynamic = "force-dynamic";

export default function AdminMonitorsPage() {
  return <MonitorsManager />;
}
