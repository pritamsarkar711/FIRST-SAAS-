"use client";

import { useInitialFetch } from "@/lib/use-initial-fetch";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Link2, KeyRound, CircleCheck, CircleX, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HistoryItem {
  id: string;
  urls: string[];
  status: string;
  result: { submitted?: number; errors?: string[] } | null;
  createdAt: string;
}

export function IndexerWorkspace({ costs, credits, initialKey }: { costs: { index: number }; credits: number; initialKey: string | null }) {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [urlsRaw, setUrlsRaw] = useState("");
  const [key, setKey] = useState<string | null>(initialKey);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/indexer").then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (d) { setKey((k) => k || d.key); setHistory(d.history || []); }
    }).catch(() => {});
  }, []);

  const parsedUrls = urlsRaw.split("\n").map((l) => l.trim()).filter(Boolean);
  const domainClean = domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!domainClean || parsedUrls.length === 0) {
      setMessage({ ok: false, text: "Enter your domain and at least one URL." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/indexer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domainClean, urls: parsedUrls }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: data.error || "Submission failed." });
        return;
      }
      setKey(data.key || key);
      setMessage(data.ok
        ? { ok: true, text: `Submitted ${data.submitted} URL${data.submitted === 1 ? "" : "s"} to IndexNow. Search engines usually pick them up within minutes to hours.` }
        : { ok: false, text: data.error });
      const refreshed = await fetch("/api/indexer").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (refreshed?.history) setHistory(refreshed.history);
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Network error. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="rounded-lg border border-border bg-white p-5 sm:p-6">
        <h1 className="text-lg font-bold text-foreground">Quick index via IndexNow</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Submit fresh posts straight to Bing, Yandex and Seznam. One-time setup: host a small key file at your domain root.
        </p>

        <div className="mt-5">
          <label htmlFor="i-domain" className="mb-1.5 block text-sm font-semibold text-foreground">Your domain</label>
          <input id="i-domain" type="text" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="yourblog.com"
            className="h-11 w-full rounded-md border border-input bg-white px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>

        <div className="mt-4">
          <label htmlFor="i-urls" className="mb-1.5 block text-sm font-semibold text-foreground">
            URLs to index <span className="font-normal text-muted-foreground">(one per line, max 20)</span>
          </label>
          <textarea id="i-urls" rows={5} value={urlsRaw} onChange={(e) => setUrlsRaw(e.target.value)}
            placeholder={"https://yourblog.com/new-post-1\nhttps://yourblog.com/new-post-2"}
            className="w-full rounded-md border border-input bg-white px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>

        {key && (
          <div className="mt-4 rounded-md border border-border bg-secondary/60 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-foreground"><KeyRound className="h-4 w-4 text-primary" /> Your IndexNow key</p>
            <code className="mt-2 block truncate rounded-sm border border-border bg-white px-3 py-2 text-sm">{key}</code>
            <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
              Create a file named <span className="font-mono font-semibold">{key}.txt</span> containing this key, and upload it to the root of{" "}
              <span className="font-semibold">https://{domainClean || "yourblog.com"}/{key}.txt</span>. On WordPress use a file manager or the
              &ldquo;Insert Headers and Footers&rdquo; style plugins; on Blogger and Wix, upload via hosting settings. The key is the same for all your future submissions.
            </p>
          </div>
        )}

        {message && (
          <p className={cn("mt-4 rounded-md px-3.5 py-2.5 text-sm font-medium", message.ok ? "bg-ok-soft text-ok" : "bg-risk-soft text-risk")} role="alert">
            {message.ok ? <CircleCheck className="mr-1.5 inline h-4 w-4" /> : <CircleX className="mr-1.5 inline h-4 w-4" />}
            {message.text}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Balance: <span className="font-bold text-foreground">{credits.toLocaleString()}</span> credits · batch costs {costs.index}
          </p>
          <Button type="submit" disabled={busy || credits < costs.index} className="h-11 rounded-md px-6 font-semibold">
            <Link2 className="mr-2 h-4.5 w-4.5" /> {busy ? "Submitting..." : "Submit to IndexNow"}
          </Button>
        </div>
      </form>

      <div className="flex items-start gap-2.5 rounded-lg border border-border bg-accent/50 p-4">
        <Info className="mt-0.5 h-4.5 w-4.5 shrink-0 text-primary" />
        <p className="text-sm leading-relaxed text-muted-foreground">
          Google does not participate in IndexNow. For Google, keep a valid sitemap and internal links from indexed pages.
          Need content to index? The <Link href="/dashboard/writer" className="font-semibold text-primary hover:underline">content writer</Link> publishes straight to WordPress.
        </p>
      </div>

      {history.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-foreground">Submission history</h2>
          <div className="mt-3 overflow-hidden rounded-lg border border-border bg-white">
            <ul className="divide-y divide-border">
              {history.map((h) => (
                <li key={h.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">{h.urls.length} URL{h.urls.length === 1 ? "" : "s"}</p>
                    <span className={cn("rounded-sm px-2 py-0.5 text-xs font-bold",
                      h.status === "SUBMITTED" ? "bg-ok-soft text-ok" : h.status === "PARTIAL" ? "bg-warn-soft text-warn" : h.status === "FAILED" ? "bg-risk-soft text-risk" : "bg-muted text-muted-foreground")}>
                      {h.status}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {h.urls.slice(0, 4).map((u) => <li key={u} className="truncate text-xs text-muted-foreground">{u}</li>)}
                    {h.urls.length > 4 && <li className="text-xs text-muted-foreground">+{h.urls.length - 4} more</li>}
                  </ul>
                  {h.result?.errors?.length ? <p className="mt-1.5 text-xs text-risk">{h.result.errors.join("; ")}</p> : null}
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
