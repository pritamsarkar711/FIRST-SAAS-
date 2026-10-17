import { Suspense, useState } from "react";
import { router } from "@inertiajs/react";
import axios from "axios";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

function GoogleAdminButton() {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-full rounded-md font-semibold"
      onClick={() => { window.location.href = "/auth/google/redirect"; }}
    >
      <img src="/logos/google.svg" alt="" width={16} height={16} className="mr-2" />
      Sign in with Google
    </Button>
  );
}

function AdminLoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needs2fa, setNeeds2fa] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await axios.post("/api/auth/login", { email, password, code });
      if (res.data.ok && res.data.role === "ADMIN") {
        router.visit("/manage");
      } else {
        // Not an admin: drop the session that was just created.
        await axios.post("/api/auth/logout").catch(() => {});
        setError("This account does not have admin access.");
      }
    } catch (err) {
      const data = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
      if (data?.error === "2FA_REQUIRED" || data?.message === "2FA_REQUIRED") {
        setNeeds2fa(true);
        setError("Enter the 6 digit code from your authenticator app.");
      } else if (data?.error === "ACCOUNT_SUSPENDED") {
        setError(data?.message || "Wrong credentials. Try again.");
      } else {
        setError("Wrong credentials. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 sm:p-7">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-lg font-bold text-foreground">Administrator sign in</h1>
          <p className="text-xs text-muted-foreground">Restricted area for site managers.</p>
        </div>
      </div>
      <form onSubmit={submit} className="mt-5" noValidate>
        <label htmlFor="m-email" className="mb-1.5 block text-sm font-semibold text-foreground">Admin email</label>
        <input id="m-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"
          className="h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="admin@adaudit.app" />
        <label htmlFor="m-pass" className="mb-1.5 mt-4 block text-sm font-semibold text-foreground">Password</label>
        <input id="m-pass" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
          className="h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Password" />
        {needs2fa && (
          <>
            <label htmlFor="m-code" className="mb-1.5 mt-4 block text-sm font-semibold text-foreground">Two factor code</label>
            <input id="m-code" type="text" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} autoComplete="one-time-code"
              className="h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] tracking-[0.3em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="000000" />
          </>
        )}
        {error && <p className="mt-3 text-sm font-medium text-risk" role="alert">{error}</p>}
        <Button type="submit" disabled={busy} className="mt-5 h-11 w-full rounded-md font-semibold">
          {busy ? "Verifying..." : "Enter manage panel"}
        </Button>
        {googleEnabled && (
          <>
            <div className="mt-4 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="mt-4">
              <GoogleAdminButton />
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Google sign-in works with the admin account email only.
            </p>
          </>
        )}
      </form>
      <p className="mt-4 text-center text-xs text-muted-foreground">All access attempts are logged.</p>
    </div>
  );
}

export function AdminLoginScreen({ googleEnabled = false }: { googleEnabled?: boolean }) {
  return (
    <div className="dotgrid flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <Suspense fallback={<div className="h-80 animate-pulse rounded-lg bg-muted" />}>
          <AdminLoginForm googleEnabled={googleEnabled} />
        </Suspense>
      </div>
    </div>
  );
}
