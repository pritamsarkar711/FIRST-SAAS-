"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, SearchCheck, Receipt, HandCoins, MailCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

const ICONS: Record<string, typeof Bell> = {
  AUDIT: SearchCheck,
  PAYMENT: Receipt,
  WITHDRAWAL: HandCoins,
  MESSAGE: MailCheck,
  SYSTEM: Info,
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const d = await res.json();
      setItems(d.notifications || []);
      setUnread(d.unread || 0);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    const interval = setInterval(load, 30_000);
    return () => { clearTimeout(t); clearInterval(interval); };
  }, [load]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function markAll() {
    setUnread(0);
    setItems((xs) => xs.map((x) => ({ ...x, read: true })));
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
  }

  async function markOne(id: string) {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, read: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => {});
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(!open); if (!open) void load(); }}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-risk px-1 text-[10px] font-bold text-white" aria-hidden="true">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fade-up absolute right-0 top-12 z-50 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border bg-card shadow-[0_8px_30px_rgba(27,38,32,0.14)]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-bold text-foreground">Notifications</p>
            {unread > 0 && (
              <button onClick={() => void markAll()} className="text-xs font-semibold text-primary hover:underline">Mark all read</button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing yet. Updates about audits and payments land here.</p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => {
                  const Icon = ICONS[n.type] || Info;
                  const inner = (
                    <span className="flex gap-3 px-4 py-3 transition-colors hover:bg-secondary/60">
                      <span className={cn("mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                        n.read ? "bg-muted text-muted-foreground" : "bg-accent text-primary")}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className={cn("block truncate text-sm", n.read ? "font-medium text-muted-foreground" : "font-bold text-foreground")}>
                          {n.title}
                        </span>
                        <span className="mt-0.5 block line-clamp-2 text-xs leading-relaxed text-muted-foreground">{n.body}</span>
                        <span className="mt-1 block text-[11px] text-muted-foreground/70">
                          {new Date(n.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </span>
                      </span>
                      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
                    </span>
                  );
                  return (
                    <li key={n.id}>
                      {n.link ? (
                        <Link href={n.link} onClick={() => void markOne(n.id)} className="block">{inner}</Link>
                      ) : (
                        <button onClick={() => void markOne(n.id)} className="block w-full text-left">{inner}</button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
