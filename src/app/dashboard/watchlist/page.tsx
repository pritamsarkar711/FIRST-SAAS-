import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCosts } from "@/lib/credits";
import { WatchlistManager } from "@/components/dashboard/watchlist-manager";

export const metadata = { title: "Site monitoring" };
export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const session = await auth();
  const user = await db.user.findUnique({
    where: { email: session!.user!.email! },
    select: { id: true, credits: true },
  });
  const costs = await getCosts();

  return (
    <WatchlistManager
      credits={user!.credits}
      costs={costs.audit}
      deepCost={costs.deepScan ?? 6}
    />
  );
}
