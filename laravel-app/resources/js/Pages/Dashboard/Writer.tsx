import { Head, usePage } from "@inertiajs/react";
import { WriterWorkspace } from "@/components/dashboard/writer-workspace";
import { DashboardShell } from "@/components/dashboard/shell";

/** Port of src/app/dashboard/writer/page.tsx (tab query param handled by the controller). */
export default function Writer({ costs, credits, jobs, initialTab }: {
  costs: { standard: number; premium: number };
  credits: number;
  jobs: { id: string; type: string; keyword: string; status: string; createdAt: string }[];
  initialTab: "ADSENSE" | "AFFILIATE";
}) {
  const { auth } = usePage<any>().props;

  return (
    <DashboardShell credits={auth.user.credits} userName={auth.user.name || auth.user.email} isAdmin={auth.user.role === "ADMIN"}>
      <Head title="Content writer" />
      <WriterWorkspace
        costs={costs}
        credits={credits}
        jobs={jobs}
        initialTab={initialTab}
      />
    </DashboardShell>
  );
}
