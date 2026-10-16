"use client";

import { useCallback, useEffect, useState } from "react";
import { Fingerprint, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInitialFetch } from "@/lib/use-initial-fetch";
import { Input } from "@/components/ui/input";

interface LogRow {
  id: string;
  userId: string | null;
  actorEmail: string;
  action: string;
  detail: string | null;
  ip: string | null;
  createdAt: string;
}

const GROUPS = [
  { value: "all", label: "Everything" },
  { value: "auth", label: "Sign-in & security" },
  { value: "audits", label: "Audits" },
  { value: "tools", label: "Writer & indexer" },
  { value: "billing", label: "Payments" },
  { value: "affiliate", label: "Affiliate" },
  { value: "users", label: "User actions" },
  { value: "admin", label: "Admin changes" },
];

const ACTION_STYLES: Record<string, { label: string; tone: "ok" | "warn" | "risk" | "neutral" }> = {
  AUTH_LOGIN: { label: "Signed in", tone: "neutral" },
  AUTH_LOGIN_FAILED: { label: "Failed sign-in", tone: "risk" },
  AUTH_2FA_CHALLENGE: { label: "2FA prompt", tone: "warn" },
  AUTH_REGISTER: { label: "New account", tone: "ok" },
  AUTH_LOGOUT: { label: "Signed out", tone: "neutral" },
  AUTH_PASSWORD_CHANGE: { label: "Password", tone: "warn" },
  AUTH_2FA_ENABLE: { label: "2FA on", tone: "ok" },
  AUTH_2FA_DISABLE: { label: "2FA off", tone: "warn" },
  ADMIN_LOGIN: { label: "Admin sign-in", tone: "warn" },
  AUDIT_START: { label: "Audit started", tone: "neutral" },
  AUDIT_BATCH_START: { label: "Batch started", tone: "neutral" },
  AUDIT_DELETE: { label: "Audit deleted", tone: "warn" },
  AUDIT_SHARE: { label: "Share link", tone: "neutral" },
  WRITER_START: { label: "Article", tone: "neutral" },
  INDEXER_SUBMIT: { label: "Indexed", tone: "neutral" },
  CHECKOUT_SUBMIT: { label: "Order placed", tone: "neutral" },
  PAYMENT_APPROVE: { label: "Payment approved", tone: "ok" },
  PAYMENT_REJECT: { label: "Payment rejected", tone: "risk" },
  WITHDRAW_REQUEST: { label: "Withdrawal asked", tone: "neutral" },
  WITHDRAW_APPROVE: { label: "Withdrawal approved", tone: "ok" },
  WITHDRAW_REJECT: { label: "Withdrawal rejected", tone: "risk" },
  WITHDRAW_COMPLETE: { label: "Withdrawal paid", tone: "ok" },
  USER_CREDITS_ADJUST: { label: "Credits changed", tone: "warn" },
  USER_SUSPEND: { label: "Suspended", tone: "risk" },
  USER_UNSUSPEND: { label: "Reactivated", tone: "ok" },
  USER_DELETE: { label: "User deleted", tone: "risk" },
  USER_ROLE_CHANGE: { label: "Role change", tone: "warn" },
  PLAN_SAVE: { label: "Plan saved", tone: "warn" },
  GATEWAY_SAVE: { label: "Gateway saved", tone: "warn" },
  SETTINGS_SAVE: { label: "Settings saved", tone: "warn" },
  BLOG_PUBLISH: { label: "Blog", tone: "neutral" },
};

const TONE_CLASS: Record<string, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  risk: "bg-risk-soft text-risk",
  neutral: "bg-secondary text-secondary-foreground",
};

export function ActivityManager() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (g: string = "all", query: string = "", p: number = 1) => {
    setLoading(true);
    const res = await fetch(`/api/admin/activity?group=${encodeURIComponent(g)}&q=${encodeURIComponent(query)}&page=${p}`);
    const d = await res.json().catch(() => ({}));
    setRows(d.rows || []);
    setPages(d.pages || 1);
    setTotal(d.total || 0);
    setLoading(false);
  }, []);
  useInitialFetch(load);

  function apply(g: string, query: string, p: number) {
    setGroup(g);
    setQ(query);
    setPage(p);
    void load(g, query, p);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Activity log</h1>
        <p className="mt-1 text-sm text-muted-foreground">A running trail of sign-ins, audits, payments and every admin change. Entries cannot be edited or removed from the panel.</p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Log categories">
          {GROUPS.map((g) => (
            <button
              key={g.value} type="button" role="tab" aria-selected={group === g.value}
              onClick={() => apply(g.value, q, 1)}
              className={cn(
                "rounded-sm border px-2.5 py-1.5 text-xs font-bold transition-colors",
                group === g.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
        <form
          className="relative w-full lg:w-72"
          onSubmit={(e) => { e.preventDefault(); apply(group, q, 1); }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search email, detail, IP..."
            className="h-10 rounded-md pl-9"
            aria-label="Search activity log"
          />
        </form>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/60 text-left">
              <th className="px-4 py-2.5 font-bold">When</th>
              <th className="px-4 py-2.5 font-bold">Actor</th>
              <th className="px-4 py-2.5 font-bold">Event</th>
              <th className="px-4 py-2.5 font-bold">Detail</th>
              <th className="px-4 py-2.5 font-bold">IP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Loading the trail...</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <Fingerprint className="mx-auto h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-2 font-semibold text-foreground">Nothing logged in this view</p>
                  <p className="mt-1 text-sm text-muted-foreground">Events appear the moment users or admins do something.</p>
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const meta = ACTION_STYLES[r.action] || { label: r.action, tone: "neutral" as const };
                return (
                  <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" })}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-2.5 font-medium" title={r.actorEmail}>{r.actorEmail}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn("whitespace-nowrap rounded-sm px-2 py-1 text-xs font-bold", TONE_CLASS[meta.tone])}>{meta.label}</span>
                    </td>
                    <td className="max-w-[320px] px-4 py-2.5 text-muted-foreground"><span className="line-clamp-2">{r.detail || "—"}</span></td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-muted-foreground">{r.ip || "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{total.toLocaleString()} entries</p>
          <div className="flex items-center gap-2">
            <button
              type="button" disabled={page <= 1}
              onClick={() => apply(group, q, page - 1)}
              className="inline-flex h-9 items-center gap-1 rounded-md border border-border bg-card px-3 text-sm font-semibold disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <span className="text-sm font-semibold">Page {page} of {pages}</span>
            <button
              type="button" disabled={page >= pages}
              onClick={() => apply(group, q, page + 1)}
              className="inline-flex h-9 items-center gap-1 rounded-md border border-border bg-card px-3 text-sm font-semibold disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
