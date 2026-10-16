import { AuditsManager } from "@/components/admin/audits-manager";

export const metadata = { title: "Audits" };
export const dynamic = "force-dynamic";

export default function AdminAuditsPage() {
  return <AuditsManager />;
}
