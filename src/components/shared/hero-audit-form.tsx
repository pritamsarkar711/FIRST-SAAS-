"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NETWORKS = [
  { value: "ADSENSE", label: "Google AdSense" },
  { value: "EZOIC", label: "Ezoic" },
  { value: "MEDIAVINE", label: "Mediavine" },
  { value: "RAPTIVE", label: "Raptive" },
];

export function HeroAuditForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [network, setNetwork] = useState("ADSENSE");
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const d = domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(d)) {
      setError("Enter a valid domain, for example myblog.com");
      return;
    }
    setError("");
    router.push(`/register?domain=${encodeURIComponent(d)}&network=${network}`);
  }

  return (
    <div className={compact ? "" : "w-full"}>
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row" noValidate>
        <div className="relative flex-1">
          <SearchCheck className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="yourblog.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            aria-label="Your website domain"
            className="h-12 w-full rounded-md border border-input bg-card pl-10 pr-3 text-[15px] text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="sm:w-40">
          <Select value={network} onValueChange={setNetwork}>
            <SelectTrigger className="h-12 w-full rounded-md bg-card text-[15px]" aria-label="Ad network to check">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NETWORKS.map((n) => (
                <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="h-12 rounded-md px-6 text-[15px] font-semibold">
          Check site
        </Button>
      </form>
      {error ? <p className="mt-2 text-sm font-medium text-risk" role="alert">{error}</p> : null}
      <p className="mt-3 text-sm text-muted-foreground">
        In a hurry?{" "}
        <a href="/tools" className="font-semibold text-primary underline underline-offset-2">
          Run a free instant site check
        </a>{" "}
        with six quick health checks, no signup needed.
      </p>
    </div>
  );
}
