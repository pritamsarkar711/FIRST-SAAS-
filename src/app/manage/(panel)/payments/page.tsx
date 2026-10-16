import { PaymentsManager } from "@/components/admin/payments-manager";

export const metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

export default function AdminPaymentsPage() {
  return <PaymentsManager />;
}
