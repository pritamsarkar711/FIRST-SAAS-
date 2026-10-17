import { Head, usePage } from "@inertiajs/react";
import { AuditWorkspace } from "@/components/dashboard/audit-workspace";
import { DashboardShell } from "@/components/dashboard/shell";

/**
 * Port of src/app/dashboard/audit/page.tsx. The Next server component read
 * the session and search params; here the controller passes the same props
 * (costs, credits, history, initial query values).
 */
export default function AuditIndex({
  costs, deepCost, credits, history, initialDomain, initialNetwork, initialDeep, autostart,
}: {
  costs: { normal: number; standard: number; premium: number };
  deepCost: number;
  credits: number;
  history: { id: string; domain: string; target: string; mode: string; deepScan: boolean; status: string; probability: number; verdict: string | null; batchId: string | null; createdAt: string }[];
  initialDomain: string;
  initialNetwork: string;
  initialDeep: boolean;
  autostart: boolean;
}) {
  const { auth } = usePage<any>().props;

  return (
    <DashboardShell credits={auth.user.credits} userName={auth.user.name || auth.user.email} isAdmin={auth.user.role === "ADMIN"}>
      <Head title="Site audit" />
      <AuditWorkspace
        costs={costs}
        deepCost={deepCost}
        credits={credits}
        history={history}
        initialDomain={initialDomain}
        initialNetwork={initialNetwork}
        initialDeep={initialDeep}
        autostart={autostart}
      />
    </DashboardShell>
  );
}
