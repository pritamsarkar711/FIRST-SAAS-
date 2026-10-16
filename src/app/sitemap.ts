import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseUrl();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/features`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/how-it-works`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/tools`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/pricing`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/blog`, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/contact`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/refund`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/login`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/register`, changeFrequency: "yearly", priority: 0.6 },
  ];

  try {
    const posts = await db.blogPost.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      select: { slug: true, updatedAt: true },
      take: 500,
    });
    return [
      ...staticRoutes,
      ...posts.map((p) => ({
        url: `${base}/blog/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
    ];
  } catch {
    return staticRoutes;
  }
}
