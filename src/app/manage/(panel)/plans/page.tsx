import { PlansManager } from "@/components/admin/plans-manager";

export const metadata = { title: "Plans" };
export const dynamic = "force-dynamic";

export default function AdminPlansPage() {
  return <PlansManager />;
}
