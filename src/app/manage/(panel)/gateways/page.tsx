import { GatewaysManager } from "@/components/admin/gateways-manager";

export const metadata = { title: "Gateways" };
export const dynamic = "force-dynamic";

export default function AdminGatewaysPage() {
  return <GatewaysManager />;
}
