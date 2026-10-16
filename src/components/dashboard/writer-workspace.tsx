"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PenLine, Coins, Copy, FileDown, UploadCloud, CircleCheck, CircleX, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface StartResponse { ok?: boolean; id?: string; error?: string }
interface Job {
  id: string;
  type: string;
  mode: string;
  keyword: string;
  status: string;
  result: {
    title: string; slug: string; metaTitle: string; metaDescription: string; excerpt: string;
    focusKeyword: string; wordCount: number; contentHtml: string; faqs: { q: string; a: string }[];
  } | null;
  images: { file: string; title: string; alt: string }[];
  error?: string | null;
  createdAt: string;
}

const IMG_STYLES = [
  { value: "vector", label: "Flat vector" },
  { value: "photo", label: "Realistic photo" },
  { value: "brutalist", label: "Neo-brutalist" },
  { value: "diagram", label: "Diagram" },
];
const LENGTHS = [
  { value: 1500, label: "1,500 words" },
  { value: 2500, label: "2,500 words (recommended)" },
  { value: 3500, label: "3,500 words" },
];

export function WriterWorkspace({
  costs, credits, jobs, initialTab,
}: {
  costs: { standard: number; premium: number };
  credits: number;
  jobs: { id: string; type: string; keyword: string; status: string; createdAt: string }[];
  initialTab: "ADSENSE" | "AFFILIATE";
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"ADSENSE" | "AFFILIATE">(initialTab);
  const [keyword, setKeyword] = useState("");
  const [mode, setMode] = useState("STANDARD");
  const [words, setWords] = useState(2500);
  const [imageStyle, setImageStyle] = useState("vector");
  const [internalLinksRaw, setInternalLinksRaw] = useState("");
  const [affiliateLinksRaw, setAffiliateLinksRaw] = useState("");
  const [siteName, setSiteName] = useState("");
  const [audience, setAudience] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState<Job | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [history, setHistory] = useState(jobs);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const start = useCallback(async () => {
    setError("");
    if (keyword.trim().length < 3) { setError("Give the writer a keyword of at least 3 characters."); return; }
    setBusy(true);
    setActive({ id: "", type: tab, mode, keyword, status: "PENDING", result: null, images: [], createdAt: "" });
    try {
      const res = await fetch("/api/writer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: tab, keyword: keyword.trim(), mode, words, imageStyle, internalLinksRaw, affiliateLinksRaw, siteName, audience, notes }),
      });
      const data: StartResponse = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActive(null);
        setError(data.error || "Could not start the writer.");
        return;
      }
      const id = data.id!;
      setActive((a) => (a ? { ...a, id } : a));
      pollRef.current = setInterval(async () => {
        const r = await fetch(`/api/writer/${id}`);
        const j: Job = await r.json();
        if (j.status === "DONE" || j.status === "FAILED") {
          if (pollRef.current) clearInterval(pollRef.current);
          setActive(j);
          setHistory((h) => [{ id: j.id, type: j.type, keyword: j.keyword, status: j.status, createdAt: j.createdAt || new Date().toISOString() }, ...h]);
          router.refresh();
        } else {
          setActive(j);
        }
      }, 4000);
    } catch {
      setActive(null);
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }, [keyword, tab, mode, words, imageStyle, internalLinksRaw, affiliateLinksRaw, siteName, audience, notes, router]);

  async function openJob(id: string) {
    const r = await fetch(`/api/writer/${id}`);
    if (r.ok) { setActive(await r.json()); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }

  const cost = costs[mode.toLowerCase() as "standard" | "premium"];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 rounded-md border border-border bg-secondary p-1" role="tablist" aria-label="Writer type">
        {([["ADSENSE", "AdSense content writer"], ["AFFILIATE", "Affiliate content writer"]] as const).map(([v, label]) => (
          <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
            className={cn("flex-1 rounded-sm px-3 py-2 text-sm font-bold transition-colors", tab === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
            {label}
          </button>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={(e) => { e.preventDefault(); void start(); }} className="rounded-lg border border-border bg-white p-5 sm:p-6">
        <h1 className="text-lg font-bold text-foreground">{tab === "ADSENSE" ? "Write an AdSense ready article" : "Write an affiliate article"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tab === "ADSENSE"
            ? "E-E-A-T aligned, human tone, FAQ section, SEO meta and images included. Takes 2 to 5 minutes."
            : "Honest reviews with disclosure, what-you-will-learn opening, comparison table and your affiliate links."}
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="w-keyword" className="mb-1.5 block text-sm font-semibold text-foreground">Main keyword</label>
            <input id="w-keyword" type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)}
              placeholder={tab === "ADSENSE" ? "e.g. peace lily drooping but soil is wet" : "e.g. best budget mechanical keyboards"}
              className="h-11 w-full rounded-md border border-input bg-white px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-foreground">Mode</label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="h-11 w-full rounded-md text-[15px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="STANDARD">Standard mode ({costs.standard} credits)</SelectItem>
                <SelectItem value="PREMIUM">Premium mode ({costs.premium} credits)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-foreground">Length</label>
            <Select value={String(words)} onValueChange={(v) => setWords(Number(v))}>
              <SelectTrigger className="h-11 w-full rounded-md text-[15px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LENGTHS.map((l) => <SelectItem key={l.value} value={String(l.value)}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-foreground">Image style</label>
            <Select value={imageStyle} onValueChange={setImageStyle}>
              <SelectTrigger className="h-11 w-full rounded-md text-[15px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {IMG_STYLES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="w-site" className="mb-1.5 block text-sm font-semibold text-foreground">Publishing site (optional)</label>
            <input id="w-site" type="text" value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="myblog.com"
              className="h-11 w-full rounded-md border border-input bg-white px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="w-internal" className="mb-1.5 block text-sm font-semibold text-foreground">
              Internal links <span className="font-normal text-muted-foreground">(one per line: url | anchor text)</span>
            </label>
            <textarea id="w-internal" rows={2} value={internalLinksRaw} onChange={(e) => setInternalLinksRaw(e.target.value)}
              placeholder={"https://myblog.com/watering-guide | how to water peace lilies"}
              className="w-full rounded-md border border-input bg-white px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          {tab === "AFFILIATE" && (
            <div className="md:col-span-2">
              <label htmlFor="w-aff" className="mb-1.5 block text-sm font-semibold text-foreground">
                Affiliate links <span className="font-normal text-muted-foreground">(one per line: label | url)</span>
              </label>
              <textarea id="w-aff" rows={3} value={affiliateLinksRaw} onChange={(e) => setAffiliateLinksRaw(e.target.value)}
                placeholder={"Keychron K2 | https://www.amazon.com/dp/B07XXXX"}
                className="w-full rounded-md border border-input bg-white px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
          )}
          <div>
            <label htmlFor="w-aud" className="mb-1.5 block text-sm font-semibold text-foreground">Target reader (optional)</label>
            <input id="w-aud" type="text" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Beginner plant owners"
              className="h-11 w-full rounded-md border border-input bg-white px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <div>
            <label htmlFor="w-notes" className="mb-1.5 block text-sm font-semibold text-foreground">Extra instructions (optional)</label>
            <input id="w-notes" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Focus on indoor varieties"
              className="h-11 w-full rounded-md border border-input bg-white px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
        </div>

        {error && <p className="mt-4 rounded-md bg-risk-soft px-3 py-2.5 text-sm font-medium text-risk" role="alert">{error}</p>}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Balance: <span className="font-bold text-foreground">{credits.toLocaleString()}</span> credits
            {credits < cost && <span className="ml-1 font-semibold text-risk">(need {cost})</span>}
          </p>
          <Button type="submit" disabled={busy || credits < cost} className="h-11 rounded-md px-6 font-semibold">
            <PenLine className="mr-2 h-4.5 w-4.5" /> {busy ? "Starting..." : "Generate article"}
          </Button>
        </div>
      </form>

      {/* Active job / result */}
      {active && (
        <div className="fade-up rounded-lg border border-border bg-white">
          {active.status === "FAILED" ? (
            <div className="p-6">
              <div className="flex items-center gap-2.5"><CircleX className="h-6 w-6 text-risk" /><p className="font-bold text-foreground">Generation failed</p></div>
              <p className="mt-2 text-sm text-muted-foreground">{active.error} Credits were refunded.</p>
            </div>
          ) : active.status !== "DONE" || !active.result ? (
            <div className="p-6">
              <div className="flex items-center gap-2.5">
                <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                <p className="font-bold text-foreground">Writing: {active.keyword}</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Researching, drafting and polishing. This takes 2 to 5 minutes. Keep this page open.</p>
              <div className="mt-4 space-y-2">
                {["Research and outline", "Draft the full article", "Create images", "Polish and finalize"].map((s, i) => (
                  <div key={s} className="flex items-center gap-2.5 text-sm">
                    <span className={cn("h-2 w-2 rounded-full", i === 0 ? "bg-primary" : "bg-muted-foreground/30")} />
                    <span className={i === 0 ? "font-semibold text-foreground" : "text-muted-foreground"}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ArticleResult job={active} />
          )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-foreground">Recent articles</h2>
          <div className="mt-3 overflow-hidden rounded-lg border border-border bg-white">
            <ul className="divide-y divide-border">
              {history.slice(0, 10).map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <button onClick={() => void openJob(j.id)} className="truncate text-left font-semibold text-foreground hover:text-primary">
                      {j.keyword}
                    </button>
                    <p className="text-xs text-muted-foreground">
                      {j.type === "AFFILIATE" ? "Affiliate" : "AdSense"} · {new Date(j.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("rounded-sm px-2 py-1 text-xs font-bold",
                      j.status === "DONE" ? "bg-ok-soft text-ok" : j.status === "FAILED" ? "bg-risk-soft text-risk" : "bg-warn-soft text-warn")}>
                      {j.status === "DONE" ? "Ready" : j.status === "FAILED" ? "Failed" : "Working"}
                    </span>
                    <button
                      onClick={async () => { await fetch(`/api/writer/${j.id}`, { method: "DELETE" }); setHistory((h) => h.filter((x) => x.id !== j.id)); if (active?.id === j.id) setActive(null); router.refresh(); }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-risk-soft hover:text-risk"
                      aria-label="Delete article">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function ArticleResult({ job }: { job: Job }) {
  const result = job.result!;
  const [copied, setCopied] = useState("");
  const [tab, setTab] = useState<"preview" | "html">("preview");
  const [wpOpen, setWpOpen] = useState(false);
  const [wpUrl, setWpUrl] = useState("");
  const [wpUser, setWpUser] = useState("");
  const [wpPass, setWpPass] = useState("");
  const [wpStatus, setWpStatus] = useState("");
  const [wpBusy, setWpBusy] = useState(false);
  const [wpLink, setWpLink] = useState<string | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    }).catch(() => {});
  }

  function download() {
    const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${result.title}</title><meta name="description" content="${result.metaDescription}"></head><body style="max-width:760px;margin:40px auto;padding:0 20px;font-family:Georgia,serif;line-height:1.75;color:#222">${result.contentHtml}</body></html>`;
    const blob = new Blob([doc], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${result.slug || "article"}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function publishWp(e: React.FormEvent) {
    e.preventDefault();
    setWpBusy(true); setWpStatus(""); setWpLink(null);
    try {
      const res = await fetch(`/api/writer/${job.id}/publish-wp`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl: wpUrl, username: wpUser, appPassword: wpPass, status: "draft" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not publish to WordPress.");
      setWpLink(data.link);
    } catch (err) {
      setWpStatus(err instanceof Error ? err.message : "Publish failed.");
    } finally {
      setWpBusy(false);
    }
  }

  return (
    <div>
      <div className="border-b border-border p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ok">Article ready</p>
            <h2 className="mt-1 text-lg font-bold leading-snug text-foreground">{result.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{result.wordCount.toLocaleString()} words · {result.faqs.length} FAQs · {job.images.length} images · {job.mode.toLowerCase()} mode</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" className="rounded-md font-semibold" onClick={() => copy(result.contentHtml, "html")}>
              <Copy className="mr-1.5 h-3.5 w-3.5" /> {copied === "html" ? "Copied" : "Copy HTML"}
            </Button>
            <Button variant="outline" size="sm" className="rounded-md font-semibold" onClick={download}>
              <FileDown className="mr-1.5 h-3.5 w-3.5" /> .html
            </Button>
            <Button size="sm" className="rounded-md font-semibold" onClick={() => setWpOpen(true)}>
              <UploadCloud className="mr-1.5 h-3.5 w-3.5" /> Publish
            </Button>
          </div>
        </div>
        {wpOpen && (
          <form onSubmit={publishWp} className="mt-4 rounded-md border border-border bg-secondary/60 p-4">
            <p className="text-sm font-semibold text-foreground">Publish to WordPress as a draft</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Create an Application Password in WordPress under Users &gt; Profile. We upload the images to your media library and save the post as a draft.
            </p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
              <input required type="url" value={wpUrl} onChange={(e) => setWpUrl(e.target.value)} placeholder="https://yourblog.com"
                className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              <input required type="text" value={wpUser} onChange={(e) => setWpUser(e.target.value)} placeholder="Username"
                className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              <input required type="password" value={wpPass} onChange={(e) => setWpPass(e.target.value)} placeholder="Application password"
                className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            {wpStatus && <p className="mt-2 text-sm font-medium text-risk">{wpStatus}</p>}
            {wpLink && <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-ok"><CircleCheck className="h-4 w-4" /> Draft created: <a href={wpLink} target="_blank" rel="noreferrer" className="underline">{wpLink}</a></p>}
            <div className="mt-3 flex gap-2">
              <Button type="submit" size="sm" disabled={wpBusy} className="rounded-md font-semibold">{wpBusy ? "Publishing..." : "Create draft"}</Button>
              <Button type="button" size="sm" variant="ghost" className="rounded-md font-semibold" onClick={() => setWpOpen(false)}>Close</Button>
            </div>
          </form>
        )}
      </div>

      <div className="flex gap-1 border-b border-border px-5 pt-3" role="tablist" aria-label="Result view">
        {(["preview", "html"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={cn("rounded-t-md px-4 py-2 text-sm font-bold", tab === t ? "border-x border-t border-border bg-white text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {t === "preview" ? "Preview" : "SEO and meta"}
          </button>
        ))}
      </div>

      {tab === "preview" ? (
        <div className="p-5 sm:p-7">
          <div className="article-body" dangerouslySetInnerHTML={{ __html: result.contentHtml }} />
          {result.faqs.length > 0 && (
            <div className="mt-8 rounded-lg border border-border bg-secondary/40 p-5">
              <h3 className="text-lg font-bold text-foreground">Frequently asked questions</h3>
              <div className="mt-3 space-y-3">
                {result.faqs.map((f, i) => (
                  <div key={i}>
                    <p className="font-semibold text-foreground">{f.q}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {job.images.length > 0 && (
            <div className="mt-6 rounded-lg border border-border p-5">
              <h3 className="font-bold text-foreground">Image alt texts</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                {job.images.map((img, i) => (
                  <li key={i}><span className="font-semibold text-foreground">{img.title}:</span> {img.alt}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4 p-5 sm:p-7">
          {[
            ["SEO title", result.metaTitle],
            ["Meta description", result.metaDescription],
            ["Slug", `/${result.slug}`],
            ["Focus keyword", result.focusKeyword],
            ["Excerpt", result.excerpt],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
              <span className="w-36 shrink-0 text-sm font-bold text-foreground">{label}</span>
              <div className="flex flex-1 items-center gap-2">
                <code className="min-w-0 flex-1 rounded-md border border-border bg-secondary px-3 py-2 text-sm break-words text-foreground">{value}</code>
                <button onClick={() => copy(String(value), label)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary" aria-label={`Copy ${label}`}>
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          <p className="rounded-md bg-warn-soft px-3.5 py-2.5 text-xs leading-relaxed text-warn">
            <Coins className="mr-1 inline h-3.5 w-3.5" />
            Rank Math tip: paste the focus keyword in your SEO plugin, and keep the meta description under 155 characters. Review and personalize the draft before publishing.
          </p>
        </div>
      )}
    </div>
  );
}
