import { useState } from "react";
import { Share2, Link2, Link2Off, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareButton({ auditId, initialToken }: { auditId: string; initialToken: string | null }) {
  const [token, setToken] = useState(initialToken);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  async function toggle() {
    setBusy(true);
    try {
      if (token) {
        const res = await fetch(`/api/audit/${auditId}/share`, { method: "DELETE" });
        if (res.ok) setToken(null);
      } else {
        const res = await fetch(`/api/audit/${auditId}/share`, { method: "POST" });
        const d = await res.json().catch(() => ({}));
        if (res.ok && d.url) {
          setOrigin(window.location.origin);
          setToken(d.url.split("/share/")[1]);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(`${origin || window.location.origin}/share/${token}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  }

  if (!token) {
    return (
      <Button variant="outline" onClick={() => void toggle()} disabled={busy} className="rounded-md font-semibold">
        <Share2 className="mr-2 h-4.5 w-4.5" /> Share
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <code className="hidden max-w-56 truncate rounded-md border border-border bg-secondary px-3 py-2 text-xs sm:block">
        /share/{token.slice(0, 14)}...
      </code>
      <Button variant="outline" size="sm" onClick={() => void copy()} className="rounded-md font-semibold">
        {copied ? <CircleCheck className="mr-1.5 h-3.5 w-3.5 text-ok" /> : <Link2 className="mr-1.5 h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy link"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => void toggle()} disabled={busy} className="rounded-md font-semibold text-risk">
        <Link2Off className="h-3.5 w-3.5" />
        <span className="sr-only">Revoke share link</span>
      </Button>
    </div>
  );
}
