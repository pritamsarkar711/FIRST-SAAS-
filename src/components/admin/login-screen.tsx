"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
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
      const result = await signIn("credentials", { email, password, code, redirect: false });
      if (result?.error) {
        if (result.code === "2FA_REQUIRED" || result.error === "2FA_REQUIRED") {
          setNeeds2fa(true);
          setError("Enter the 6 digit code from your authenticator app.");
        } else {
          setError("Wrong credentials. Try again.");
        }
        return;
      }
      // Verify the signed-in user is an admin before entering the panel
      const res = await fetch("/api/auth/session");
      const session = await res.json().catch(() => null);
      if (session?.user?.role === "ADMIN") {
        router.push(params.get("callbackUrl") || "/manage");
        router.refresh();
      } else {
        setError("This account is not an administrator.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-lg border border-border bg-white p-6 sm:p-7">
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
          className="h-11 w-full rounded-md border border-input bg-white px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="admin@adaudit.app" />
        <label htmlFor="m-pass" className="mb-1.5 mt-4 block text-sm font-semibold text-foreground">Password</label>
        <input id="m-pass" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
          className="h-11 w-full rounded-md border border-input bg-white px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Password" />
        {needs2fa && (
          <>
            <label htmlFor="m-code" className="mb-1.5 mt-4 block text-sm font-semibold text-foreground">Two factor code</label>
            <input id="m-code" type="text" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} autoComplete="one-time-code"
              className="h-11 w-full rounded-md border border-input bg-white px-3 text-[15px] tracking-[0.3em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="000000" />
          </>
        )}
        {error && <p className="mt-3 text-sm font-medium text-risk" role="alert">{error}</p>}
        <Button type="submit" disabled={busy} className="mt-5 h-11 w-full rounded-md font-semibold">
          {busy ? "Verifying..." : "Enter manage panel"}
        </Button>
      </form>
      <p className="mt-4 text-center text-xs text-muted-foreground">All access attempts are logged.</p>
    </div>
  );
}

export function AdminLoginScreen() {
  return (
    <div className="dotgrid flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <Suspense fallback={<div className="h-80 animate-pulse rounded-lg bg-muted" />}>
          <AdminLoginForm />
        </Suspense>
      </div>
    </div>
  );
}
