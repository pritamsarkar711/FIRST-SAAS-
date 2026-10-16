import { ActivityManager } from "@/components/admin/activity-manager";

export const metadata = { title: "Activity log" };
export const dynamic = "force-dynamic";

export default function AdminActivityPage() {
  return <ActivityManager />;
}
