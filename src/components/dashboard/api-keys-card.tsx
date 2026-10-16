"use client";

import { useCallback, useState } from "react";
import { Terminal, Copy, CircleCheck, Plus, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useInitialFetch } from "@/lib/use-initial-fetch";

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  requestCount: number;
  revokedAt: string | null;
  createdAt: string;
}

export function ApiKeysCard() {
  const [keys, setKeys] = useState<ApiKeyRow[] | null>(null);
  const [maxActive, setMaxActive] = useState(5);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [freshSecret, setFreshSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/keys");
      if (res.ok) {
        const d = await res.json();
        setKeys(d.keys || []);
        setMaxActive(d.maxActive ?? 5);
      } else {
        setKeys([]);
      }
    } catch {
      setKeys([]);
    }
  }, []);
  useInitialFetch(load);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    setError("");
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", name }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy("");
    if (res.ok) {
      setName("");
      setFreshSecret(d.secret);
      setCopied(false);
      void load();
    } else {
      setError(d.error || "Could not create the key.");
    }
  }

  async function revokeKey(id: string) {
    setBusy(id);
    await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke", id }),
    });
    setBusy("");
    void load();
  }

  async function copySecret() {
    if (!freshSecret) return;
    try {
      await navigator.clipboard.writeText(freshSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const activeCount = (keys || []).filter((k) => !k.revokedAt).length;

  return (
    <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-bold text-foreground">
        <Terminal className="h-4.5 w-4.5 text-primary" /> Developer API
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Start audits from your own scripts and apps with a bearer key. Keys use the same credit balance as the dashboard.{" "}
        <a href="/docs/api" className="font-semibold text-primary underline underline-offset-2">
          Read the API docs <ExternalLink className="inline h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </p>

      {/* One-time secret */}
      {freshSecret && (
        <div className="mt-4 rounded-md border-2 border-primary/40 bg-primary/5 p-4" role="alert">
          <p className="text-sm font-bold text-foreground">Copy this key now. It is shown only once.</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <code className="min-w-0 flex-1 truncate rounded-sm bg-secondary px-3 py-2.5 font-mono text-xs text-foreground" aria-label="Your new API key">
              {freshSecret}
            </code>
            <Button type="button" variant="outline" onClick={copySecret} className="h-10 shrink-0 rounded-md font-semibold">
              {copied ? <CircleCheck className="mr-2 h-4 w-4 text-ok" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? "Copied" : "Copy key"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Only a hash is stored, so nobody can recover this value later, including us.</p>
        </div>
      )}

      {/* Key list */}
      {keys === null ? (
        <div className="mt-4 space-y-2">
          {[0, 1].map((i) => <div key={i} className="h-11 animate-pulse rounded-md bg-muted" />)}
        </div>
      ) : keys.length === 0 ? (
        <p className="mt-4 rounded-md bg-secondary px-3 py-2.5 text-sm text-muted-foreground">
          No API keys yet. Create one below to call the audit API from your own code.
        </p>
      ) : (
        <ul className="mt-4 max-h-72 divide-y divide-border overflow-y-auto rounded-md border border-border">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center gap-3 px-3.5 py-2.5">
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  k.revokedAt ? "bg-risk" : "bg-ok"
                )}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {k.name}
                  {k.revokedAt && <span className="ml-2 rounded-sm bg-risk/10 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-risk">Revoked</span>}
                </p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {k.prefix}··· · {k.requestCount} {k.requestCount === 1 ? "call" : "calls"}
                  {k.lastUsedAt ? ` · last used ${new Date(k.lastUsedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : " · never used"}
                </p>
              </div>
              {!k.revokedAt && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => revokeKey(k.id)}
                  disabled={busy === k.id}
                  className="h-8 shrink-0 rounded-md text-risk hover:text-risk"
                  aria-label={`Revoke API key ${k.name}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Create form */}
      <form onSubmit={createKey} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="api-key-name" className="sr-only">Key name</label>
          <Input
            id="api-key-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Key name, e.g. CI script"
            maxLength={40}
            className="h-11 rounded-md"
          />
        </div>
        <Button type="submit" disabled={name.trim().length < 2 || busy === "create" || activeCount >= maxActive} className="h-11 rounded-md font-semibold">
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Create key
        </Button>
      </form>
      {error && <p className="mt-2 text-sm font-medium text-risk" role="alert">{error}</p>}
      {activeCount >= maxActive && !error && (
        <p className="mt-2 text-xs text-muted-foreground">Limit of {maxActive} active keys reached. Revoke one to add another.</p>
      )}
    </div>
  );
}
