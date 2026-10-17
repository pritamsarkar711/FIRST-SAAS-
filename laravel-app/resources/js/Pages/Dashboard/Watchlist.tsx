import { Head, usePage } from "@inertiajs/react";
import { WatchlistManager } from "@/components/dashboard/watchlist-manager";
import { DashboardShell } from "@/components/dashboard/shell";

/** Port of src/app/dashboard/watchlist/page.tsx. */
export default function Watchlist({ credits, costs, deepCost }: {
  credits: number;
  costs: { normal: number; standard: number; premium: number };
  deepCost: number;
}) {
  const { auth } = usePage<any>().props;

  return (
    <DashboardShell credits={auth.user.credits} userName={auth.user.name || auth.user.email} isAdmin={auth.user.role === "ADMIN"}>
      <Head title="Site monitoring" />
      <WatchlistManager
        credits={credits}
        costs={costs}
        deepCost={deepCost}
      />
    </DashboardShell>
  );
}
