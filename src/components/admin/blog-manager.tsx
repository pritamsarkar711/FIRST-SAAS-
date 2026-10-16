"use client";

import { useInitialFetch } from "@/lib/use-initial-fetch";
import { useCallback, useEffect, useRef, useState } from "react";
import { Newspaper, Plus, Pencil, Trash2, CircleCheck, ImageUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RichEditor } from "@/components/admin/rich-editor";
import { cn } from "@/lib/utils";

interface PostRow { id: string; title: string; slug: string; status: string; views: number; publishedAt: string | null; createdAt: string }
interface PostFull extends PostRow { excerpt: string | null; content: string; coverImage: string | null; metaTitle: string | null; metaDescription: string | null }

const EMPTY = { id: "", title: "", slug: "", excerpt: "", content: "", coverImage: "", metaTitle: "", metaDescription: "", status: "DRAFT" };

function slugify(t: string) {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export function BlogManager() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const slugTouched = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/posts");
    const d = await res.json().catch(() => ({}));
    setPosts(d.posts || []);
  }, []);
  useInitialFetch(load);

  async function openEdit(id: string) {
    const res = await fetch(`/api/admin/posts?id=${id}`);
    const d = await res.json().catch(() => ({}));
    const p = d.post as PostFull;
    if (!p) return;
    slugTouched.current = true;
    setForm({
      id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt || "", content: p.content,
      coverImage: p.coverImage || "", metaTitle: p.metaTitle || "", metaDescription: p.metaDescription || "", status: p.status,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    const res = await fetch("/api/admin/posts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, id: form.id || undefined }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(d.error || "Save failed."); return; }
    setMsg("Post saved.");
    setForm(null);
    void load();
    setTimeout(() => setMsg(""), 2000);
  }

  async function remove(id: string) {
    if (!confirm("Delete this post permanently?")) return;
    await fetch(`/api/admin/posts?id=${id}`, { method: "DELETE" });
    void load();
  }

  async function uploadCover(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    if (res.ok && form) setForm({ ...form, coverImage: d.url });
    else setMsg(d.error || "Upload failed.");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Blog</h1>
          <p className="mt-1 text-sm text-muted-foreground">Publish SEO posts to grow organic traffic.</p>
        </div>
        {!form && (
          <Button onClick={() => { slugTouched.current = false; setForm({ ...EMPTY }); }} className="rounded-md font-semibold">
            <Plus className="mr-2 h-4 w-4" /> New post
          </Button>
        )}
      </div>

      {msg && <p className="flex items-center gap-1.5 rounded-md bg-ok-soft px-3 py-2 text-sm font-semibold text-ok"><CircleCheck className="h-4 w-4" /> {msg}</p>}

      {form && (
        <form onSubmit={save} className="rounded-lg border border-primary/40 bg-white p-5">
          <h2 className="font-bold text-foreground">{form.id ? "Edit post" : "New post"}</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-foreground">Title</label>
              <input required value={form.title} onChange={(e) => {
                const t = e.target.value;
                setForm({ ...form, title: t, slug: slugTouched.current ? form.slug : slugify(t) });
              }} className="h-11 w-full rounded-md border border-input bg-white px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">Slug</label>
              <input required value={form.slug} onChange={(e) => { slugTouched.current = true; setForm({ ...form, slug: slugify(e.target.value) }); }}
                className="h-11 w-full rounded-md border border-input bg-white px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div className="lg:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-foreground">Excerpt</label>
              <textarea rows={2} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                className="w-full rounded-md border border-input bg-white px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">Cover image</label>
              <div className="flex items-center gap-2">
                <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border border-input bg-white px-4 text-sm font-semibold text-foreground hover:bg-secondary">
                  <ImageUp className="h-4 w-4" /> Upload
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadCover(f); }} />
                </label>
                {form.coverImage && <span className="truncate text-xs text-muted-foreground">{form.coverImage}</span>}
              </div>
              {form.coverImage && (
                 
                <img src={form.coverImage} alt="Cover preview" className="mt-2 h-20 w-full rounded-md border border-border object-cover" />
              )}
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-semibold text-foreground">Content</label>
            <RichEditor value={form.content} onChange={(html) => setForm((f) => (f ? { ...f, content: html } : f))} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">Meta title (SEO)</label>
              <input value={form.metaTitle} maxLength={70} onChange={(e) => setForm({ ...form, metaTitle: e.target.value })}
                className="h-11 w-full rounded-md border border-input bg-white px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">Meta description (SEO)</label>
              <input value={form.metaDescription} maxLength={160} onChange={(e) => setForm({ ...form, metaDescription: e.target.value })}
                className="h-11 w-full rounded-md border border-input bg-white px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="text-sm font-semibold text-foreground">Status</label>
            <div className="flex gap-1 rounded-md border border-border bg-secondary p-1">
              {(["DRAFT", "PUBLISHED"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setForm({ ...form, status: s })}
                  className={cn("rounded-sm px-3.5 py-1.5 text-sm font-bold", form.status === s ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                  {s.toLowerCase()}
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-2">
              <Button type="submit" disabled={busy} className="rounded-md font-semibold">{busy ? "Saving..." : "Save post"}</Button>
              <Button type="button" variant="ghost" onClick={() => setForm(null)} className="rounded-md font-semibold">Cancel</Button>
            </div>
          </div>
        </form>
      )}

      {posts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-secondary/40 p-10 text-center">
          <Newspaper className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">No posts yet. Publish your first one.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          <ul className="divide-y divide-border">
            {posts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{p.title}</p>
                  <p className="text-xs text-muted-foreground">/blog/{p.slug} · {p.views} views · {new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={cn("rounded-sm px-2 py-0.5 text-xs font-bold", p.status === "PUBLISHED" ? "bg-ok-soft text-ok" : "bg-muted text-muted-foreground")}>
                    {p.status.toLowerCase()}
                  </span>
                  <button onClick={() => void openEdit(p.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary" title="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => void remove(p.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-risk-soft hover:text-risk" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
