"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, Users, SearchCheck, Receipt, Package, CreditCard, HandCoins,
  MailCheck, Newspaper, Settings, Menu, X, LogOut, Fingerprint, Radar,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { NotificationBell } from "@/components/shared/notification-bell";
import { ThemeToggle } from "@/components/shared/theme";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/manage", label: "Dashboard", icon: LayoutDashboard },
  { href: "/manage/users", label: "Users", icon: Users },
  { href: "/manage/audits", label: "Audits", icon: SearchCheck },
  { href: "/manage/monitors", label: "Monitors", icon: Radar },
  { href: "/manage/payments", label: "Payments", icon: Receipt },
  { href: "/manage/plans", label: "Plans", icon: Package },
  { href: "/manage/gateways", label: "Gateways", icon: CreditCard },
  { href: "/manage/affiliate", label: "Affiliate", icon: HandCoins },
  { href: "/manage/messages", label: "Messages", icon: MailCheck },
  { href: "/manage/blog", label: "Blog", icon: Newspaper },
  { href: "/manage/activity", label: "Activity log", icon: Fingerprint },
  { href: "/manage/settings", label: "Settings", icon: Settings },
];

export function AdminShell({ children, adminName }: { children: React.ReactNode; adminName: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const nav = (
    <nav aria-label="Admin">
      {NAV.map((item) => (
        <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
          className={cn(
            "mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
            (item.href === "/manage" ? pathname === item.href : pathname.startsWith(item.href))
              ? "bg-accent font-semibold text-primary"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}>
          <item.icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
          {item.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen border-t-4 border-primary">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card lg:flex">
        <div className="border-b border-border px-5 py-4">
          <Link href="/manage"><Logo name="Audit Form Manage" /></Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">{nav}</div>
        <div className="border-t border-border p-4">
          <Link href="/" className="mb-1 block px-3 py-2 text-sm text-muted-foreground hover:text-primary">← View site</Link>
          <button onClick={() => signOut({ callbackUrl: "/manage/login" })}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <Logo name="Audit Form Manage" />
              <button onClick={() => setOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-secondary" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">{nav}</div>
            <div className="border-t border-border p-4">
              <button onClick={() => signOut({ callbackUrl: "/manage/login" })}
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
          <span className="hidden text-sm font-bold uppercase tracking-wide text-primary lg:block">Manage</span>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <NotificationBell />
            <ThemeToggle className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" />
          </div>
          <span className="ml-1 text-sm font-semibold text-foreground sm:ml-3">{adminName}</span>
          <button onClick={() => { signOut({ callbackUrl: "/manage/login" }); router.refresh(); }}
            className="ml-3 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary lg:hidden">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </header>
        <main className="flex-1 px-4 py-6 pb-safe sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
