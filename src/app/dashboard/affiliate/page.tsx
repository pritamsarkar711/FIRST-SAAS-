import { headers } from "next/headers";
import { AffiliateWorkspace } from "@/components/dashboard/affiliate-workspace";

export const metadata = { title: "Affiliate program" };
export const dynamic = "force-dynamic";

export default async function AffiliatePage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  return <AffiliateWorkspace origin={`${proto}://${host}`} />;
}
