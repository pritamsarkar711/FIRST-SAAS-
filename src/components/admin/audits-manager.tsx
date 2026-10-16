"use client";

import { useCallback, useEffect, useState } from "react";
import { SearchCheck, FileDown, CircleX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInitialFetch } from "@/lib/use-initial-fetch";

interface AuditRow {
  id: string;
  domain: string;
  target: string;
  mode: string;
  status: string;
  probability: number;
  verdict: string | null;
  createdAt: string;
  user: { email: string };
}

export function AuditsManager() {
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    // Admin sees all audits through the public endpoint of each user is not available;
    // we reuse the users/payments pattern with a dedicated simple source: reuse /api/admin/payments style
    // Audits are fetched from the admin audits API added alongside this page.
    const res = await fetch("/api/admin/audits");
    const d = await res.json().catch(() => ({}));
    setAudits(d.audits || []);
    setLoading(false);
  }, []);
  useInitialFetch(load);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Audits</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every audit run on the platform.</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/60 text-left">
              <th className="px-4 py-2.5 font-bold">Domain</th>
              <th className="px-4 py-2.5 font-bold">User</th>
              <th className="px-4 py-2.5 font-bold">Network / mode</th>
              <th className="px-4 py-2.5 font-bold">Score</th>
              <th className="px-4 py-2.5 font-bold">Status</th>
              <th className="px-4 py-2.5 font-bold">When</th>
              <th className="px-4 py-2.5 text-right font-bold">Report</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : audits.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No audits yet.</td></tr>
            ) : audits.map((a) => (
              <tr key={a.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3 font-semibold text-foreground">{a.domain}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.user.email}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.target.toLowerCase()} · {a.mode.toLowerCase()}</td>
                <td className="px-4 py-3">
                  {a.status === "DONE" ? (
                    <span className={cn("rounded-sm px-2 py-1 text-xs font-bold",
                      a.probability >= 70 ? "bg-ok-soft text-ok" : a.probability >= 45 ? "bg-warn-soft text-warn" : "bg-risk-soft text-risk")}>
                      {a.probability}%
                    </span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={cn("text-xs font-semibold",
                    a.status === "DONE" ? "text-ok" : a.status === "FAILED" ? "text-risk" : "text-warn")}>
                    {a.status.toLowerCase()}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  {a.status === "DONE" ? (
                    <a href={`/api/audit/${a.id}/pdf`} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary" title="Download PDF">
                      <FileDown className="h-3.5 w-3.5" />
                    </a>
                  ) : a.status === "FAILED" ? (
                    <CircleX className="ml-auto h-4 w-4 text-risk/60" />
                  ) : (
                    <SearchCheck className="ml-auto h-4 w-4 text-warn/60" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
