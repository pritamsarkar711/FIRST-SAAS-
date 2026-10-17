import { useCallback, useState } from "react";
import { router } from "@inertiajs/react";
import { KeyRound, ShieldCheck, UserRound, CircleCheck, QrCode, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useInitialFetch } from "@/lib/use-initial-fetch";
import { ApiKeysCard } from "@/components/dashboard/api-keys-card";

interface SecurityEvent { id: string; label: string; detail: string | null; ip: string | null; createdAt: string }

export function SettingsWorkspace({ user }: { user: { name: string; email: string; twoFactorEnabled: boolean } }) {
  const [name, setName] = useState(user.name || "");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState("");

  // password
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");

  // 2FA
  const [pw, setPw] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [disablePw, setDisablePw] = useState("");

  function flash(key: string) { setSaved(key); setTimeout(() => setSaved(""), 2000); }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy("profile");
    const res = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "profile", name }) });
    setBusy("");
    if (res.ok) { flash("profile"); router.reload(); }
  }
  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy("password");
    const res = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "password", current, next }) });
    const d = await res.json().catch(() => ({}));
    setBusy("");
    if (res.ok) { setCurrent(""); setNext(""); flash("password"); } else alert(d.error || "Could not update the password.");
  }
  async function start2fa() {
    setBusy("2fa");
    const res = await fetch("/api/auth/2fa/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    const d = await res.json().catch(() => ({}));
    setBusy("");
    if (res.ok) { setQr(d.qr); setSecret(d.secret); } else alert(d.error || "Could not start setup.");
  }
  async function enable2fa(e: React.FormEvent) {
    e.preventDefault();
    setBusy("2fa-enable");
    const res = await fetch("/api/auth/2fa/enable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const d = await res.json().catch(() => ({}));
    setBusy("");
    if (res.ok) { setQr(null); setSecret(null); setCode(""); router.reload(); } else alert(d.error || "The code was not valid.");
  }
  async function disable2fa(e: React.FormEvent) {
    e.preventDefault();
    setBusy("2fa-disable");
    const res = await fetch("/api/auth/2fa/disable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: disablePw, code: disableCode }) });
    const d = await res.json().catch(() => ({}));
    setBusy("");
    if (res.ok) { setDisableCode(""); setDisablePw(""); router.reload(); } else alert(d.error || "Could not disable 2FA.");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Profile, password, developer API and two factor authentication.</p>
      </div>

      {/* Profile */}
      <form onSubmit={saveProfile} className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-bold text-foreground"><UserRound className="h-4.5 w-4.5 text-primary" /> Profile</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="s-name" className="mb-1.5 block text-sm font-semibold text-foreground">Full name</label>
            <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-md" maxLength={60} />
          </div>
          <div>
            <label htmlFor="s-email" className="mb-1.5 block text-sm font-semibold text-foreground">Email</label>
            <Input id="s-email" value={user.email} disabled className="h-11 rounded-md bg-muted" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button type="submit" disabled={busy === "profile"} className="rounded-md font-semibold">Save profile</Button>
          {saved === "profile" && <span className="flex items-center gap-1 text-sm font-semibold text-ok"><CircleCheck className="h-4 w-4" /> Saved</span>}
        </div>
      </form>

      {/* Password */}
      <form onSubmit={savePassword} className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-bold text-foreground"><KeyRound className="h-4.5 w-4.5 text-primary" /> Password</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="s-cur" className="mb-1.5 block text-sm font-semibold text-foreground">Current password</label>
            <Input id="s-cur" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className="h-11 rounded-md" autoComplete="current-password" />
          </div>
          <div>
            <label htmlFor="s-new" className="mb-1.5 block text-sm font-semibold text-foreground">New password</label>
            <Input id="s-new" type="password" value={next} onChange={(e) => setNext(e.target.value)} className="h-11 rounded-md" autoComplete="new-password" placeholder="8+ characters" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button type="submit" disabled={busy === "password"} className="rounded-md font-semibold">Update password</Button>
          {saved === "password" && <span className="flex items-center gap-1 text-sm font-semibold text-ok"><CircleCheck className="h-4 w-4" /> Updated</span>}
        </div>
      </form>

      {/* 2FA */}
      <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-bold text-foreground"><ShieldCheck className="h-4.5 w-4.5 text-primary" /> Two factor authentication</h2>
        {user.twoFactorEnabled ? (
          <form onSubmit={disable2fa} className="mt-4 max-w-md">
            <p className="text-sm text-muted-foreground">2FA is currently <span className="font-bold text-ok">enabled</span>. To turn it off, confirm your password and a current code.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Input type="password" placeholder="Current password" value={disablePw} onChange={(e) => setDisablePw(e.target.value)} className="h-11 rounded-md" autoComplete="current-password" />
              <Input type="text" placeholder="6 digit code" value={disableCode} onChange={(e) => setDisableCode(e.target.value)} className="h-11 rounded-md tracking-[0.3em]" maxLength={6} inputMode="numeric" />
            </div>
            <Button type="submit" variant="outline" disabled={busy === "2fa-disable"} className="mt-3 rounded-md font-semibold">Disable 2FA</Button>
          </form>
        ) : qr ? (
          <div className="mt-4 max-w-md">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Scan this QR with Google Authenticator, Authy or 1Password. Then enter the 6 digit code to finish.
            </p>
            {qr && (
              <img src={qr} alt="Two factor QR code" width={180} height={180} className="mt-3 rounded-md border border-border" />
            )}
            {secret && <code className="mt-2 block truncate rounded-sm bg-secondary px-3 py-2 text-xs">{secret}</code>}
            <form onSubmit={enable2fa} className="mt-3 flex gap-2">
              <Input type="text" placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} className="h-11 w-40 rounded-md tracking-[0.3em]" maxLength={6} inputMode="numeric" />
              <Button type="submit" disabled={busy === "2fa-enable"} className="rounded-md font-semibold">Verify and enable</Button>
            </form>
          </div>
        ) : (
          <div className="mt-4 max-w-md">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Add a second step at login with any authenticator app. Recommended for everyone handling payments.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input type="password" placeholder="Confirm your password" value={pw} onChange={(e) => setPw(e.target.value)} className="h-11 flex-1 rounded-md" autoComplete="current-password" />
              <Button type="button" onClick={start2fa} disabled={!pw || busy === "2fa"} className="h-11 rounded-md font-semibold">
                <QrCode className="mr-2 h-4 w-4" /> Start setup
              </Button>
            </div>
          </div>
        )}
      </div>

      <ApiKeysCard />

      <RecentActivity />
    </div>
  );
}

function RecentActivity() {
  const [events, setEvents] = useState<SecurityEvent[] | null>(null);
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/security");
      if (res.ok) {
        const d = await res.json();
        setEvents(d.events || []);
      } else {
        setEvents([]);
      }
    } catch {
      setEvents([]);
    }
  }, []);
  useInitialFetch(load);

  return (
    <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-bold text-foreground"><Fingerprint className="h-4.5 w-4.5 text-primary" /> Recent account activity</h2>
      <p className="mt-1 text-sm text-muted-foreground">The latest security events on your account. If something here looks wrong, change your password and turn on two factor authentication.</p>
      {events === null ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-11 animate-pulse rounded-md bg-muted" />)}
        </div>
      ) : events.length === 0 ? (
        <p className="mt-4 rounded-md bg-secondary px-3 py-2.5 text-sm text-muted-foreground">Nothing logged yet. Events appear as you sign in, run audits and order credits.</p>
      ) : (
        <ul className="mt-4 max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-border">
          {events.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-3.5 py-2.5">
              <span className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                e.label.includes("failed") ? "bg-risk" : e.label.includes("created") || e.label.includes("on") ? "bg-ok" : "bg-primary/50"
              )} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{e.label}</p>
                {e.detail && <p className="truncate text-xs text-muted-foreground">{e.detail}</p>}
              </div>
              <div className="whitespace-nowrap text-right text-xs text-muted-foreground">
                <p>{new Date(e.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                {e.ip && <p className="font-mono">{e.ip}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
