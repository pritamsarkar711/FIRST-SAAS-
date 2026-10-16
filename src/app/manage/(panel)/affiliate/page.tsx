import { AffiliateManager } from "@/components/admin/affiliate-manager";

export const metadata = { title: "Affiliate" };
export const dynamic = "force-dynamic";

export default function AdminAffiliatePage() {
  return <AffiliateManager />;
}
