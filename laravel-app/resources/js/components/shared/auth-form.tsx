import { useState, Suspense } from "react";
import { router, Link } from "@inertiajs/react";
import axios from "axios";
import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { Illustration } from "@/components/shared/illustration";

function GoogleButton({ label }: { label: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-full rounded-md font-semibold"
      onClick={() => { window.location.href = "/auth/google/redirect"; }}
    >
      <img src="/logos/google.svg" alt="" width={16} height={16} className="mr-2" />
      {label}
    </Button>
  );
}

function RegisterForm({ params, googleEnabled }: { params: Record<string, string>; googleEnabled: boolean }) {
  const domain = params?.domain || "";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (!terms) { setError("You must accept the Terms of Service to continue."); return; }
    setBusy(true);
    try {
      const res = await axios.post("/api/auth/register", { name, email, password, acceptTerms: true });
      if (!res.data?.ok) throw new Error(res.data?.error || "Registration failed");
      const callback = domain
        ? `/dashboard/audit?domain=${encodeURIComponent(domain)}&autostart=1`
        : (params?.callbackUrl || "/dashboard");
      try {
        const login = await axios.post("/api/auth/login", { email, password });
        if (!login.data?.ok) throw new Error("Account created. Please sign in.");
      } catch {
        throw new Error("Account created. Please sign in.");
      }
      router.visit(callback);
    } catch (err) {
      const data = axios.isAxiosError(err) ? ((err.response?.data as Record<string, string> | undefined) ?? null) : null;
      setError(
        (typeof data?.error === "string" && data.error) ||
        (err instanceof Error ? err.message : "Registration failed")
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 sm:p-7">
      <h1 className="text-xl font-bold text-foreground">Create your account</h1>
      {domain ? (
        <p className="mt-1.5 text-sm text-muted-foreground">
          Your first audit for <span className="font-semibold text-foreground">{domain}</span> will start right after signup.
        </p>
      ) : null}
      {googleEnabled && (
        <>
          <div className="mt-5">
            <GoogleButton label="Continue with Google" />
          </div>
          <div className="my-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}
      <form onSubmit={submit} noValidate>
        <label htmlFor="r-name" className="mb-1.5 block text-sm font-semibold text-foreground">Full name</label>
        <input id="r-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name"
          className="h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Your name" />
        <label htmlFor="r-email" className="mb-1.5 mt-4 block text-sm font-semibold text-foreground">Email</label>
        <input id="r-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"
          className="h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="you@example.com" />
        <label htmlFor="r-pass" className="mb-1.5 mt-4 block text-sm font-semibold text-foreground">Password</label>
        <input id="r-pass" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password"
          className="h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="8+ characters" />
        <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm text-muted-foreground">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input accent-[#f86642]" />
          <span>
            I agree to the <Link href="/terms" className="font-semibold text-primary hover:underline" target="_blank">Terms of Service</Link>{" "}
            and the <Link href="/privacy" className="font-semibold text-primary hover:underline" target="_blank">Privacy Policy</Link>.
          </span>
        </label>
        {error && <p className="mt-3 text-sm font-medium text-risk" role="alert">{error}</p>}
        <Button type="submit" disabled={busy} className="mt-5 h-11 w-full rounded-md font-semibold">
          {busy ? "Creating account..." : "Create account"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={`/login${domain ? `?domain=${encodeURIComponent(domain)}` : ""}`} className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function LoginForm({ params, googleEnabled }: { params: Record<string, string>; googleEnabled: boolean }) {
  const domain = params?.domain || "";
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
      if (!res.data?.ok) {
        setError("Wrong email or password. Try again.");
        return;
      }
      const callback = domain
        ? `/dashboard/audit?domain=${encodeURIComponent(domain)}&autostart=1`
        : (params?.callbackUrl || "/dashboard");
      router.visit(callback);
    } catch (err) {
      const data = axios.isAxiosError(err) ? ((err.response?.data as Record<string, string> | undefined) ?? null) : null;
      if (data?.error === "2FA_REQUIRED") {
        setNeeds2fa(true);
        setError("Enter the 6 digit code from your authenticator app.");
      } else if (data?.error === "INVALID_2FA") {
        setError(data?.message || "That code is not valid. Check your authenticator app.");
      } else if (data?.error === "ACCOUNT_SUSPENDED") {
        setError(data?.message || "This account is suspended. Contact support.");
      } else {
        setError("Wrong email or password. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 sm:p-7">
      <h1 className="text-xl font-bold text-foreground">Welcome back</h1>
      <p className="mt-1 text-sm text-muted-foreground">Sign in to run audits and manage your reports.</p>
      {googleEnabled && (
        <>
          <div className="mt-5">
            <GoogleButton label="Sign in with Google" />
          </div>
          <div className="my-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}
      <form onSubmit={submit} noValidate>
        <label htmlFor="l-email" className="mb-1.5 block text-sm font-semibold text-foreground">Email</label>
        <input id="l-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"
          className="h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="you@example.com" />
        <label htmlFor="l-pass" className="mb-1.5 mt-4 block text-sm font-semibold text-foreground">Password</label>
        <input id="l-pass" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
          className="h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Your password" />
        {needs2fa && (
          <>
            <label htmlFor="l-code" className="mb-1.5 mt-4 block text-sm font-semibold text-foreground">Two factor code</label>
            <input id="l-code" type="text" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code"
              className="h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] tracking-[0.3em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="000000" maxLength={6} />
          </>
        )}
        {error && <p className="mt-3 text-sm font-medium text-risk" role="alert">{error}</p>}
        <Button type="submit" disabled={busy} className="mt-5 h-11 w-full rounded-md font-semibold">
          {busy ? "Signing in..." : "Sign in"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href={`/register${domain ? `?domain=${encodeURIComponent(domain)}` : ""}`} className="font-semibold text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export function AuthForm({
  mode,
  params = {},
  googleEnabled = false,
}: {
  mode: "login" | "register";
  params?: Record<string, string>;
  googleEnabled?: boolean;
}) {
  return (
    <div className="bg-band min-h-[calc(100vh-4rem)]">
      <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2">
        <div className="hidden justify-center lg:flex">
          <div className="w-full max-w-sm">
            <div className="overflow-hidden rounded-lg">
              <Illustration name="report" alt="Character carrying an audit report" loading="eager" />
            </div>
            <ul className="mt-5 space-y-2.5">
              {["Free credits the moment you sign up", "Reports saved as clean PDFs", "Cancel-free, one-time plans"].map((t) => (
                <li key={t} className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <CircleCheck className="h-4.5 w-4.5 shrink-0 text-primary" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex justify-center">
          <Suspense fallback={<div className="h-96 w-full max-w-md animate-pulse rounded-lg bg-muted" />}>
            {mode === "login" ? <LoginForm params={params} googleEnabled={googleEnabled} /> : <RegisterForm params={params} googleEnabled={googleEnabled} />}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
