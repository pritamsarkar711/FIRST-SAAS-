"use client";

import { useInitialFetch } from "@/lib/use-initial-fetch";
import { useCallback, useEffect, useState } from "react";
import { Package, Plus, Pencil, Trash2, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PlanRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceUsd: number;
  credits: number;
  monitorLimit: number | null;
  features: string;
  badge: string | null;
  active: boolean;
  sortOrder: number;
}

const EMPTY = { id: "", name: "", slug: "", description: "", priceUsd: 9.9, credits: 100, monitorLimit: "1", featuresRaw: "", badge: "", active: true, sortOrder: 5 };

export function PlansManager() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/plans");
    const d = await res.json().catch(() => ({}));
    setPlans((d.plans || []).map((p: PlanRow) => ({ ...p, features: p.features })));
  }, []);
  useInitialFetch(load);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const res = await fetch("/api/admin/plans", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: form.id || undefined, name: form.name, slug: form.slug, description: form.description,
        priceUsd: Number(form.priceUsd), credits: Number(form.credits),
        monitorLimit: form.monitorLimit === "" ? null : Number(form.monitorLimit),
        featuresRaw: form.featuresRaw, badge: form.badge, active: form.active, sortOrder: Number(form.sortOrder),
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(d.error || "Save failed."); return; }
    setMsg("Plan saved.");
    setForm(null);
    void load();
    setTimeout(() => setMsg(""), 2000);
  }

  async function remove(id: string) {
    if (!confirm("Delete or deactivate this plan?")) return;
    await fetch(`/api/admin/plans?id=${id}`, { method: "DELETE" });
    void load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Plans</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pricing shown on the site. Changes apply immediately.</p>
        </div>
        <Button onClick={() => setForm({ ...EMPTY })} className="rounded-md font-semibold">
          <Plus className="mr-2 h-4 w-4" /> New plan
        </Button>
      </div>

      {msg && <p className="flex items-center gap-1.5 rounded-md bg-ok-soft px-3 py-2 text-sm font-semibold text-ok"><CircleCheck className="h-4 w-4" /> {msg}</p>}

      {form && (
        <form onSubmit={save} className="rounded-lg border border-primary/40 bg-card p-5">
          <h2 className="font-bold text-foreground">{form.id ? "Edit plan" : "Create plan"}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["name", "Plan name", "text", "Standard"],
              ["slug", "Slug", "text", "standard"],
              ["badge", "Badge (optional)", "text", "Best value"],
              ["priceUsd", "Price USD", "number", "14.9"],
              ["credits", "Credits", "number", "150"],
              ["monitorLimit", "Monitored domains", "number", "3"],
              ["sortOrder", "Sort order", "number", "2"],
            ].map(([key, label, type, ph]) => (
              <div key={key}>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">{label}</label>
                <input
                  type={type} step="0.01" placeholder={ph} value={String(form[key as keyof typeof form] ?? "")}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            ))}
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-1.5 block text-sm font-semibold text-foreground">Description</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-1.5 block text-sm font-semibold text-foreground">Features (one per line)</label>
              <textarea rows={4} value={form.featuresRaw} onChange={(e) => setForm({ ...form, featuresRaw: e.target.value })}
                className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 accent-[#0d6b4d]" />
              Active (visible to customers)
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="submit" className="rounded-md font-semibold">Save plan</Button>
            <Button type="button" variant="ghost" onClick={() => setForm(null)} className="rounded-md font-semibold">Cancel</Button>
          </div>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => (
          <div key={p.id} className={cn("rounded-lg border bg-card p-5", p.active ? "border-border" : "border-dashed border-border opacity-70")}>
            <div className="flex items-start justify-between">
              <Package className="h-5 w-5 text-primary" />
              <div className="flex gap-1">
                <button onClick={() => setForm({
                  id: p.id, name: p.name, slug: p.slug, description: p.description || "",
                  priceUsd: p.priceUsd, credits: p.credits, monitorLimit: p.monitorLimit === null ? "" : String(p.monitorLimit),
                  featuresRaw: JSON.parse(p.features || "[]").join("\n"),
                  badge: p.badge || "", active: p.active, sortOrder: p.sortOrder,
                })} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary" title="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => void remove(p.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-risk-soft hover:text-risk" title="Delete">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <p className="mt-2 font-bold text-foreground">{p.name}</p>
            <p className="text-sm text-muted-foreground">{p.description}</p>
            <p className="mt-2 text-lg font-bold text-foreground">${p.priceUsd.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">/ {p.credits} credits</span></p>
            <p className="mt-1 text-xs text-muted-foreground">{p.monitorLimit ?? "\u2013"} monitored {p.monitorLimit === 1 ? "domain" : "domains"} · {p.active ? "Active" : "Hidden"} · order {p.sortOrder}{p.badge ? ` · ${p.badge}` : ""}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
