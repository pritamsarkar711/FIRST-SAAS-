import { useInitialFetch } from "@/lib/use-initial-fetch";
import { useCallback, useEffect, useState } from "react";
import { Coins, Search, ShieldCheck, ShieldOff, Trash2, KeyRound, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  credits: number;
  referralCode: string;
  createdAt: string;
  twoFactorEnabled: boolean;
  _count: { audits: number; payments: number };
}

export function UsersManager() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const load = useCallback(async (query = "") => {
    setLoading(true);
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}`);
    const d = await res.json().catch(() => ({}));
    setUsers(d.users || []);
    setLoading(false);
  }, []);
  useInitialFetch(load);

  async function act(id: string, action: string, amount?: number) {
    setMsg("");
    const res = await fetch("/api/admin/users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, amount }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(d.error || "Action failed."); return; }
    setMsg("Done.");
    setTimeout(() => setMsg(""), 1500);
    void load(q);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">Suspend, credit and manage accounts.</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void load(q); }} className="flex gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email or name"
              className="h-10 w-64 rounded-md border border-input bg-card pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <Button type="submit" variant="outline" className="h-10 rounded-md font-semibold">Search</Button>
          <a href="/api/export/admin?type=users" download
            className="inline-flex h-10 items-center rounded-md border border-border bg-card px-3.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">
            Export CSV
          </a>
        </form>
      </div>

      {msg && <p className="flex items-center gap-1.5 rounded-md bg-ok-soft px-3 py-2 text-sm font-semibold text-ok"><CircleCheck className="h-4 w-4" /> {msg}</p>}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/60 text-left">
              <th className="px-4 py-2.5 font-bold">User</th>
              <th className="px-4 py-2.5 font-bold">Credits</th>
              <th className="px-4 py-2.5 font-bold">Audits</th>
              <th className="px-4 py-2.5 font-bold">Status</th>
              <th className="px-4 py-2.5 font-bold">Joined</th>
              <th className="px-4 py-2.5 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No users found.</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="border-b border-border/60 last:border-0 align-top">
                <td className="px-4 py-3">
                  <p className="font-semibold text-foreground">{u.name || "—"} {u.role === "ADMIN" && <span className="ml-1 rounded-sm bg-accent px-1.5 py-0.5 text-[10px] font-bold text-primary">ADMIN</span>}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                  <p className="text-[11px] text-muted-foreground">ref: {u.referralCode}{u.twoFactorEnabled ? " · 2FA on" : ""}</p>
                </td>
                <td className="px-4 py-3">
                  <form onSubmit={(e) => { e.preventDefault(); const v = Number((e.currentTarget.elements.namedItem("credits") as HTMLInputElement).value); if (!Number.isNaN(v)) void act(u.id, "setCredits", v); }} className="flex items-center gap-1.5">
                    <input name="credits" type="number" defaultValue={u.credits} min={0}
                      className="h-8 w-20 rounded-md border border-input px-2 text-sm" aria-label={`Credits for ${u.email}`} />
                    <button type="submit" className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary" title="Save credits">
                      <Coins className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u._count.audits} / {u._count.payments} pay</td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-sm px-2 py-1 text-xs font-bold",
                    u.status === "ACTIVE" ? "bg-ok-soft text-ok" : "bg-risk-soft text-risk")}>{u.status.toLowerCase()}</span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {u.status === "ACTIVE" ? (
                      <button onClick={() => void act(u.id, "suspend")} className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs font-semibold text-muted-foreground hover:bg-risk-soft hover:text-risk" title="Suspend">
                        <ShieldOff className="h-3.5 w-3.5" /> Suspend
                      </button>
                    ) : (
                      <button onClick={() => void act(u.id, "activate")} className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs font-semibold text-muted-foreground hover:bg-ok-soft hover:text-ok" title="Activate">
                        <ShieldCheck className="h-3.5 w-3.5" /> Activate
                      </button>
                    )}
                    <button onClick={() => void act(u.id, "addCredits", 50)} className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-primary" title="Add 50 credits">
                      <Coins className="h-3.5 w-3.5" /> +50
                    </button>
                    <button onClick={() => void act(u.id, "reset2fa")} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary" title="Reset 2FA">
                      <KeyRound className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => void act(u.id, u.role === "ADMIN" ? "removeAdmin" : "makeAdmin")}
                      className="inline-flex h-8 items-center rounded-md border border-border px-2 text-xs font-semibold text-muted-foreground hover:bg-secondary" title="Toggle admin">
                      {u.role === "ADMIN" ? "Demote" : "Make admin"}
                    </button>
                    <button onClick={() => { if (confirm(`Delete ${u.email}? This removes their audits and payments records.`)) void act(u.id, "delete"); }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-risk-soft hover:text-risk" title="Delete user">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
