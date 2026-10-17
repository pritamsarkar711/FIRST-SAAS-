import { Head, usePage } from "@inertiajs/react";
import { AffiliateWorkspace } from "@/components/dashboard/affiliate-workspace";
import { DashboardShell } from "@/components/dashboard/shell";

/** Port of src/app/dashboard/affiliate/page.tsx (origin built from request headers in the controller). */
export default function Affiliate({ origin }: { origin: string }) {
  const { auth } = usePage<any>().props;

  return (
    <DashboardShell credits={auth.user.credits} userName={auth.user.name || auth.user.email} isAdmin={auth.user.role === "ADMIN"}>
      <Head title="Affiliate program" />
      <AffiliateWorkspace origin={origin} />
    </DashboardShell>
  );
}
