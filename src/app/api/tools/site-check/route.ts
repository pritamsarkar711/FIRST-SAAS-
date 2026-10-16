import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertPublicUrl, normalizeDomain } from "@/lib/guard";
import { rateLimit, clientIp } from "@/lib/credits";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

const Body = z.object({ domain: z.string().trim().min(3).max(200) });

type CheckStatus = "ok" | "warn" | "risk";
interface Check { id: string; label: string; status: CheckStatus; detail: string }
interface SiteCheckResult { domain: string; checks: Check[]; passed: number; total: number }

const TIMEOUT_MS = 8000;
const MAX_BYTES = 400_000;

async function fetchText(url: string, timeoutMs = TIMEOUT_MS): Promise<{ ok: boolean; status: number; body: string; finalUrl: string; ms: number }> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AdAuditSiteCheck/1.0; +https://adaudit.app/bot)" },
      cache: "no-store",
    });
    const reader = res.body?.getReader();
    let body = "";
    if (reader) {
      const dec = new TextDecoder();
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        body += dec.decode(value, { stream: true });
        if (received >= MAX_BYTES) { await reader.cancel().catch(() => {}); break; }
      }
    }
    return { ok: res.ok, status: res.status, body, finalUrl: res.url || url, ms: Date.now() - started };
  } catch {
    return { ok: false, status: 0, body: "", finalUrl: url, ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Free public site check (no signup): verifies the five things every ad network
 * reviewer sees first. Rate limited per IP, SSRF-guarded, read-only GETs.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(`sitecheck:${clientIp(req)}`, 10, 10 * 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: `Too many checks from this address. Try again in ${Math.ceil((limited.retryAfter || 60) / 60)} minutes.` },
      { status: 429 },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a domain, e.g. yourblog.com" }, { status: 400 });

  const domain = normalizeDomain(parsed.data.domain);
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) || domain.length > 253) {
    return NextResponse.json({ error: "That does not look like a real domain. Example: yourblog.com" }, { status: 400 });
  }

  try {
    await assertPublicUrl(domain);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "This domain cannot be checked" }, { status: 400 });
  }

  const checks: Check[] = [];

  // 1. Homepage reachability over HTTPS
  const home = await fetchText(`https://${domain}/`);
  if (!home.ok || !home.body) {
    checks.push({ id: "home", label: "Homepage loads over HTTPS", status: "risk", detail: "The site could not be reached over HTTPS. AdSense review starts with a reachable homepage." });
    logActivity({ action: "TOOL_SITECHECK", actorEmail: `anonymous@${clientIp(req)}`, detail: `${domain}: unreachable` });
    const failed: SiteCheckResult = { domain, checks, passed: 0, total: 6 };
    return NextResponse.json(failed);
  }
  checks.push({
    id: "home",
    label: "Homepage loads over HTTPS",
    status: "ok",
    detail: `Reachable in ${home.ms} ms${home.finalUrl.startsWith("https://") ? "" : " (redirects to HTTP, which reviewers penalize)"}.`,
  });

  const html = home.body;

  // 2. Title + meta description present
  const title = /<title[^>]*>([^<]{1,200})<\/title>/i.exec(html)?.[1]?.trim() || "";
  const desc = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,300})["']/i.exec(html)?.[1]?.trim() || "";
  checks.push({
    id: "meta",
    label: "Title and meta description",
    status: title && desc ? "ok" : title ? "warn" : "risk",
    detail: title
      ? desc
        ? `Title "${title.slice(0, 70)}" and a meta description are both present.`
        : "A title exists but the meta description is missing. Search traffic suffers without it."
      : "No title tag found. Reviewers and search engines both need one.",
  });

  // 3. Mobile viewport
  const viewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  checks.push({
    id: "viewport",
    label: "Mobile viewport declared",
    status: viewport ? "ok" : "risk",
    detail: viewport
      ? "The page declares a viewport, so it renders on phones. AdSense requires mobile-friendly pages."
      : "No viewport meta tag. Without it the site fails the mobile-friendly bar on phones.",
  });

  // 4. AdSense script already present
  const hasAdsense = /adsbygoogle\.js|pagead2\.googlesyndication\.com|google_ad_client|ca-pub-\d{8,}/i.test(html);
  checks.push({
    id: "adsense",
    label: "AdSense script on the page",
    status: hasAdsense ? "ok" : "warn",
    detail: hasAdsense
      ? "An AdSense tag is already serving on this page."
      : "No AdSense tag found yet. That is fine before approval; it must be added once the account is activated.",
  });

  // 5. ads.txt
  const adsTxt = await fetchText(`https://${domain}/ads.txt`, 6000);
  const adsTxtValid = adsTxt.ok && /google\.com[^,\n]*,\s*pub-\d+/i.test(adsTxt.body);
  checks.push({
    id: "adstxt",
    label: "ads.txt with your publisher ID",
    status: adsTxtValid ? "ok" : "warn",
    detail: adsTxtValid
      ? "ads.txt exists and authorizes a Google publisher ID."
      : hasAdsense
        ? adsTxt.ok
          ? "ads.txt exists but does not reference a Google pub- ID. Once approved, add: google.com, pub-XXXX, DIRECT, f08c47fec0942fa0."
          : "No ads.txt found. After approval, add one at the domain root or ad revenue can be withheld."
        : "No ads.txt yet. Needed after approval, not before.",
  });

  // 6. robots.txt + sitemap
  const robots = await fetchText(`https://${domain}/robots.txt`, 6000);
  const sitemapInRobots = robots.ok && /sitemap:/i.test(robots.body);
  const sitemap = await fetchText(`https://${domain}/sitemap.xml`, 6000);
  const sitemapOk = sitemap.ok && /<(urlset|sitemapindex)/i.test(sitemap.body);
  checks.push({
    id: "crawl",
    label: "robots.txt and XML sitemap",
    status: robots.ok && sitemapOk ? "ok" : robots.ok || sitemapOk ? "warn" : "risk",
    detail: robots.ok && sitemapOk
      ? `robots.txt is live${sitemapInRobots ? " and declares the sitemap" : ""}, and sitemap.xml parses as a real sitemap.`
      : robots.ok || sitemapOk
        ? `Found ${robots.ok ? "robots.txt" : "sitemap.xml"} but not both. Submitting a sitemap speeds up indexing, which reviewers like to see.`
        : "Neither robots.txt nor sitemap.xml responded. Crawlers index such sites slowly and unevenly.",
  });

  const passed = checks.filter((c) => c.status === "ok").length;
  logActivity({ action: "TOOL_SITECHECK", actorEmail: `anonymous@${clientIp(req)}`, detail: `${domain}: ${passed}/${checks.length} passed` });

  const result: SiteCheckResult = { domain, checks, passed, total: checks.length };
  return NextResponse.json(result);
}
