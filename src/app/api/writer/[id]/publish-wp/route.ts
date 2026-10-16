import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const schema = z.object({
  siteUrl: z.string().trim().url().max(200),
  username: z.string().trim().min(1).max(80),
  appPassword: z.string().trim().min(6).max(120),
  status: z.enum(["draft", "publish"]).default("draft"),
});

async function wpFetch(base: string, path: string, auth: string, body: unknown, contentType = "application/json") {
  return fetch(`${base.replace(/\/$/, "")}/wp-json/wp/v2/${path}`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": contentType, Accept: "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const job = await db.contentJob.findUnique({ where: { id } });
  if (!job || job.userId !== user.id || !job.result) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Fill in your site URL, username and application password." }, { status: 400 });
  const { siteUrl, username, appPassword, status } = parsed.data;

  // SSRF guard on user-supplied WP site
  const { assertPublicUrl } = await import("@/lib/guard");
  try {
    await assertPublicUrl(siteUrl);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid site URL" }, { status: 400 });
  }

  const result = JSON.parse(job.result) as { title: string; contentHtml: string; excerpt: string; slug: string; metaDescription: string };
  const images = job.images ? (JSON.parse(job.images) as { file: string; title: string; alt: string }[]) : [];
  const auth = Buffer.from(`${username}:${appPassword}`).toString("base64");
  const origin = new URL(req.url).origin;

  try {
    // Upload images to the WP media library first, then swap URLs
    let html = result.contentHtml;
    for (const img of images) {
      try {
        const bin = await fetch(`${origin}${img.file}`).then((r) => (r.ok ? Buffer.from(await r.arrayBuffer()) : null));
        if (!bin) continue;
        const fileName = img.file.split("/").pop() || "image.png";
        const form = new FormData();
        form.append("file", new Blob([new Uint8Array(bin)], { type: "image/png" }), fileName);
        const res = await fetch(`${siteUrl.replace(/\/$/, "")}/wp-json/wp/v2/media`, {
          method: "POST",
          headers: { Authorization: `Basic ${auth}` },
          body: form,
          signal: AbortSignal.timeout(60_000),
        });
        if (res.ok) {
          const media = await res.json();
          const remote = media?.source_url;
          if (remote) {
            const local = img.file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            html = html.replace(new RegExp(local, "g"), remote);
          }
        }
      } catch { /* keep local URL if upload fails */ }
    }

    const create = await wpFetch(siteUrl, "posts", auth, {
      title: result.title,
      content: html,
      excerpt: result.excerpt,
      slug: result.slug,
      status,
    });
    const data = await create.json().catch(() => ({}));
    if (!create.ok) {
      const msg = data?.message || `WordPress responded with ${create.status}. Check the application password and that the REST API is enabled.`;
      return NextResponse.json({ error: String(msg).slice(0, 300) }, { status: 400 });
    }
    return NextResponse.json({ ok: true, link: data?.link || null, id: data?.id || null });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message.slice(0, 300) : "Could not reach your WordPress site." }, { status: 400 });
  }
}
