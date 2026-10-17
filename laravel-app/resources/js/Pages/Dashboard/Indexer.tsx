import { Head, usePage } from "@inertiajs/react";
import { IndexerWorkspace } from "@/components/dashboard/indexer-workspace";
import { DashboardShell } from "@/components/dashboard/shell";

/**
 * Port of src/app/dashboard/indexer/page.tsx. The controller derives the same
 * IndexNow key: sha256(userId + ":" + secret).slice(0, 32).
 */
export default function Indexer({ costs, credits, initialKey }: {
  costs: { index: number };
  credits: number;
  initialKey: string | null;
}) {
  const { auth } = usePage<any>().props;

  return (
    <DashboardShell credits={auth.user.credits} userName={auth.user.name || auth.user.email} isAdmin={auth.user.role === "ADMIN"}>
      <Head title="Quick index" />
      <IndexerWorkspace costs={costs} credits={credits} initialKey={initialKey} />
    </DashboardShell>
  );
}
