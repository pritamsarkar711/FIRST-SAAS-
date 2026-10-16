"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard, SearchCheck, Radar, PenLine, Link2, Users, Wallet, Settings, Menu, X, LogOut, Coins, ExternalLink,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { NotificationBell } from "@/components/shared/notification-bell";
import { ThemeToggle } from "@/components/shared/theme";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/audit", label: "Site audit", icon: SearchCheck },
  { href: "/dashboard/watchlist", label: "Site monitoring", icon: Radar },
  { href: "/dashboard/writer", label: "Content writer", icon: PenLine },
  { href: "/dashboard/indexer", label: "Quick index", icon: Link2 },
  { href: "/dashboard/affiliate", label: "Affiliate program", icon: Users },
  { href: "/dashboard/billing", label: "Billing and plans", icon: Wallet },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardShell({ children, credits, userName, isAdmin }: { children: React.ReactNode; credits: number; userName: string; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();

  const nav = (
    <nav aria-label="Dashboard">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setOpen(false)}
          className={cn(
            "mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
            (item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href))
              ? "bg-accent font-semibold text-primary"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <item.icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
          {item.label}
        </Link>
      ))}
      {isAdmin && (
        <Link href="/manage" onClick={() => setOpen(false)}
          className="mb-0.5 mt-2 flex items-center gap-2.5 rounded-md border border-dashed border-border px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary">
          <ExternalLink className="h-4.5 w-4.5 shrink-0" /> Admin panel
        </Link>
      )}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card lg:flex">
        <div className="border-b border-border px-5 py-4">
          <Link href="/"><Logo /></Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">{nav}</div>
        <div className="border-t border-border p-4">
          <div className="flex items-center justify-between rounded-md bg-accent px-3 py-2.5">
            <span className="flex items-center gap-1.5 text-sm font-bold text-primary"><Coins className="h-4 w-4" /> {credits.toLocaleString()}</span>
            <Link href="/dashboard/billing" className="text-xs font-bold uppercase tracking-wide text-primary hover:underline">Buy</Link>
          </div>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <Logo />
              <button onClick={() => setOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-secondary" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">{nav}</div>
            <div className="border-t border-border p-4">
              <div className="mb-2 flex items-center justify-between rounded-md bg-accent px-3 py-2.5">
                <span className="flex items-center gap-1.5 text-sm font-bold text-primary"><Coins className="h-4 w-4" /> {credits.toLocaleString()} credits</span>
                <Link href="/dashboard/billing" onClick={() => setOpen(false)} className="text-xs font-bold uppercase tracking-wide text-primary">Buy</Link>
              </div>
              <button onClick={() => signOut({ callbackUrl: "/" })}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary">
                <LogOut className="h-4.5 w-4.5" /> Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-h-screen w-full flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
          <button onClick={() => setOpen(true)} className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-secondary lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden text-sm font-semibold text-muted-foreground lg:block">
            {NAV.find((n) => (n.href === "/dashboard" ? pathname === n.href : pathname.startsWith(n.href)))?.label || "Dashboard"}
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <NotificationBell />
            <ThemeToggle className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" />
            <Link href="/dashboard/billing" className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-sm font-bold text-primary" aria-label="Credit balance">
              <Coins className="h-4 w-4" /> {credits.toLocaleString()}
            </Link>
            <span className="hidden text-sm font-semibold text-foreground sm:block">{userName || session?.user?.name}</span>
            <button onClick={() => signOut({ callbackUrl: "/" })}
              className="hidden items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary sm:inline-flex">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 pb-safe sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
