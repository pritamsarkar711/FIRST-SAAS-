import * as cheerio from "cheerio";
import { assertPublicUrl, normalizeDomain } from "@/lib/guard";

const UA = "Mozilla/5.0 (compatible; AdAuditBot/1.0; +https://adaudit.app/bot)";
const TIMEOUT = 15_000;

export interface PageSignals {
  url: string;
  statusCode: number;
  responseMs: number;
  https: boolean;
  redirected: boolean;
  finalUrl: string;
  title: string;
  metaDescription: string;
  viewport: boolean;
  canonical: boolean;
  robotsMeta: string;
  lang: string;
  h1Count: number;
  h2Count: number;
  wordCount: number;
  textPreview: string;
  internalLinks: number;
  externalLinks: number;
  navPages: Record<string, boolean>;
  images: number;
  imagesMissingAlt: number;
  adScripts: string[];
  analytics: string[];
  platform: string;
  socialLinks: string[];
  hasContactForm: boolean;
  copyrightYear: string | null;
  categoryLinks: string[];
}

export interface SampledArticle {
  url: string;
  statusCode: number;
  wordCount: number;
  headings: number;
  paragraphs: number;
  externalLinks: number;
  authorByline: boolean;
  datePublished: string | null;
  structuredData: boolean;
  imagesMissingAlt: number;
  title: string;
}

export interface CrawlSignals {
  domain: string;
  fetchedAt: string;
  homepage: PageSignals | null;
  robots: { exists: boolean; sitemapDeclared: boolean; blocksAll: boolean };
  sitemap: { exists: boolean; urlCount: number; samples: string[] };
  articles: SampledArticle[];
  estimatedPages: number;
  errors: string[];
}

async function fetchPage(url: string): Promise<{ ok: boolean; status: number; html: string; ms: number; finalUrl: string }> {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT),
      cache: "no-store",
    });
    const html = await res.text().catch(() => "");
    return { ok: res.ok, status: res.status, html: html.slice(0, 900_000), ms: Date.now() - started, finalUrl: res.url || url };
  } catch {
    return { ok: false, status: 0, html: "", ms: Date.now() - started, finalUrl: url };
  }
}

function fetchText(url: string): Promise<string> {
  return fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" })
    .then((r) => (r.ok ? r.text() : ""))
    .catch(() => "");
}

const NAV_PATTERNS: [string, RegExp][] = [
  ["about", /\/about(-us|-me)?\/?$/i],
  ["contact", /\/contact(-us|-me)?\/?$/i],
  ["privacy", /\/privacy(-policy)?\/?$/i],
  ["terms", /\/(terms(-of-(service|use))?|tos)\/?$/i],
  ["disclaimer", /\/disclaimer\/?$/i],
  ["editorial", /\/(editorial|editorial-policy)\/?$/i],
  ["authors", /\/(author|team|writers|about-the-author)/i],
];

export function parseHomepage(html: string, baseUrl: string, status: number, ms: number, finalUrl: string): PageSignals {
  const $ = cheerio.load(html);
  $("script,style,noscript,svg").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const withScripts = cheerio.load(html);

  const links = withScripts("a[href]").toArray();
  const origin = new URL(baseUrl).origin;
  let internal = 0, external = 0;
  const socialLinks: string[] = [];
  const categoryPaths: string[] = [];
  const navPages: Record<string, boolean> = {};
  for (const el of links) {
    const href = withScripts(el).attr("href") || "";
    if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;
    let abs: URL;
    try { abs = new URL(href, baseUrl); } catch { continue; }
    if (abs.origin === origin) {
      internal++;
      const p = abs.pathname;
      for (const [key, re] of NAV_PATTERNS) if (re.test(p)) navPages[key] = true;
      if (/\/(category|categories|tag|topics)\//i.test(p)) categoryPaths.push(p);
    } else {
      external++;
      if (/facebook\.com|twitter\.com|x\.com|instagram\.com|youtube\.com|linkedin\.com|pinterest\.com|t\.me/i.test(abs.hostname)) {
        socialLinks.push(abs.origin);
      }
    }
  }

  const scriptsHtml = withScripts("script").toString().toLowerCase();
  const adScripts: string[] = [];
  if (scriptsHtml.includes("adsbygoogle")) adScripts.push("Google AdSense");
  if (scriptsHtml.includes("ezoic")) adScripts.push("Ezoic");
  if (scriptsHtml.includes("mediavine")) adScripts.push("Mediavine");
  if (scriptsHtml.includes("raptive") || scriptsHtml.includes("adthrive")) adScripts.push("Raptive");
  const analytics: string[] = [];
  if (scriptsHtml.includes("googletagmanager") || scriptsHtml.includes("gtag(")) analytics.push("Google Analytics/GTM");
  if (scriptsHtml.includes("plausible")) analytics.push("Plausible");
  if (scriptsHtml.includes("clarity.ms")) analytics.push("Microsoft Clarity");

  let platform = "unknown";
  if (scriptsHtml.includes("wp-content") || withScripts('meta[name="generator"][content*="WordPress"]').length) platform = "WordPress";
  else if (withScripts('meta[name="generator"][content*="Blogger"]').length || scriptsHtml.includes("blogspot")) platform = "Blogger";
  else if (scriptsHtml.includes("cdn.shopify")) platform = "Shopify";
  else if (withScripts('meta[name="generator"][content*="Wix"]').length) platform = "Wix";
  else if (scriptsHtml.includes("static.parastorage") || scriptsHtml.includes("wixstatic")) platform = "Wix";

  const images = withScripts("img").length;
  const imagesMissingAlt = withScripts("img").filter((_, el) => !withScripts(el).attr("alt")?.trim()).length;
  const bodyText = withScripts("body").text();
  const copyrightYear = bodyText.match(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(20\d{2})/i)?.[1] ?? null;
  const hasContactForm = withScripts("form input[type='email'], form textarea").length > 0;

  return {
    url: baseUrl,
    statusCode: status,
    responseMs: ms,
    https: baseUrl.startsWith("https://"),
    redirected: finalUrl.replace(/^https?/, "") !== baseUrl.replace(/^https?/, ""),
    finalUrl,
    title: ($("title").first().text() || "").trim().slice(0, 200),
    metaDescription: (withScripts('meta[name="description"]').attr("content") || "").trim().slice(0, 300),
    viewport: withScripts('meta[name="viewport"]').length > 0,
    canonical: withScripts('link[rel="canonical"]').length > 0,
    robotsMeta: (withScripts('meta[name="robots"]').attr("content") || "").slice(0, 100),
    lang: withScripts("html").attr("lang") || "",
    h1Count: $("h1").length,
    h2Count: $("h2").length,
    wordCount: text ? text.split(/\s+/).length : 0,
    textPreview: text.slice(0, 1200),
    internalLinks: internal,
    externalLinks: external,
    navPages,
    images,
    imagesMissingAlt,
    adScripts,
    analytics,
    platform,
    socialLinks: [...new Set(socialLinks)].slice(0, 5),
    hasContactForm,
    copyrightYear,
    categoryLinks: [...new Set(categoryPaths)].slice(0, 8),
  };
}

export function parseArticle(html: string, url: string, status: number): SampledArticle {
  const $ = cheerio.load(html);
  const main = $("article").length ? $("article").first() : $("main").length ? $("main").first() : $("body");
  const text = main.text().replace(/\s+/g, " ").trim();
  const lower = html.toLowerCase();
  let datePublished: string | null = null;
  try {
    const ld = JSON.parse($('script[type="application/ld+json"]').first().html() || "{}");
    datePublished = ld.datePublished || ld.dateCreated || null;
  } catch { /* optional */ }
  return {
    url,
    statusCode: status,
    wordCount: text ? text.split(/\s+/).length : 0,
    headings: main.find("h2,h3").length,
    paragraphs: main.find("p").length,
    externalLinks: main.find("a[href^='http']").filter((_, el) => !$(el).attr("href")?.includes(new URL(url).hostname)).length,
    authorByline: lower.includes("rel=\"author\"") || main.find(".author,.byline,[rel=author]").length > 0 || /written by|by\s+[A-Z]/.test(text.slice(0, 500)),
    datePublished,
    structuredData: lower.includes("application/ld+json"),
    imagesMissingAlt: main.find("img").filter((_, el) => !$(el).attr("alt")?.trim()).length,
    title: ($("title").first().text() || "").trim().slice(0, 150),
  };
}

export async function crawlSite(rawDomain: string): Promise<CrawlSignals> {
  const domain = normalizeDomain(rawDomain);
  await assertPublicUrl(domain); // SSRF guard: resolve + reject private targets
  const errors: string[] = [];
  const base = `https://${domain}`;

  const home = await fetchPage(base);
  if (!home.ok || !home.html) {
    // try www
    const alt = await fetchPage(`https://www.${domain}`);
    if (alt.ok && alt.html) {
      return crawlFromHome(alt, `https://www.${domain}`, domain, errors, true);
    }
    errors.push(`Homepage request failed (status ${home.status || "network error"})`);
    return {
      domain, fetchedAt: new Date().toISOString(), homepage: null,
      robots: { exists: false, sitemapDeclared: false, blocksAll: false },
      sitemap: { exists: false, urlCount: 0, samples: [] },
      articles: [], estimatedPages: 0, errors,
    };
  }
  return crawlFromHome(home, home.finalUrl || base, domain, errors, false);
}

async function crawlFromHome(
  home: { html: string; status: number; ms: number; finalUrl: string },
  homeUrl: string,
  domain: string,
  errors: string[],
  usedWww: boolean
): Promise<CrawlSignals> {
  const homepage = parseHomepage(home.html, homeUrl, home.status, home.ms, home.finalUrl);
  if (usedWww) errors.push("Site is only reachable at www." + domain);

  // robots.txt
  const robotsTxt = await fetchText(`https://${domain}/robots.txt`);
  const robots = {
    exists: robotsTxt.includes("user-agent"),
    sitemapDeclared: /sitemap\s*:/i.test(robotsTxt),
    blocksAll: /disallow:\s*\/\s*$/im.test(robotsTxt) && /user-agent:\s*\*/i.test(robotsTxt),
  };

  // sitemap
  let sitemapUrl = robotsTxt.match(/sitemap\s*:\s*(\S+)/i)?.[1] || "";
  let sitemapXml = sitemapUrl ? await fetchText(sitemapUrl) : "";
  if (!sitemapXml.includes("<urlset") && !sitemapXml.includes("<sitemapindex")) {
    for (const candidate of [`https://${domain}/sitemap.xml`, `https://${domain}/sitemap_index.xml`, `https://${domain}/wp-sitemap.xml`]) {
      const xml = await fetchText(candidate);
      if (xml.includes("<urlset") || xml.includes("<sitemapindex")) { sitemapXml = xml; sitemapUrl = candidate; break; }
    }
  }
  let sitemap = { exists: false, urlCount: 0, samples: [] as string[] };
  if (sitemapXml.includes("<urlset") || sitemapXml.includes("<sitemapindex")) {
    const $ = cheerio.load(sitemapXml, { xmlMode: true });
    let locs = $("loc").map((_, el) => $(el).text().trim()).get();
    if (sitemapXml.includes("<sitemapindex")) {
      // fetch first child sitemap
      const child = locs.find((l) => l.includes(".xml"));
      if (child) {
        const childXml = await fetchText(child);
        const $$ = cheerio.load(childXml, { xmlMode: true });
        locs = $$("loc").map((_, el) => $$(el).text().trim()).get();
      }
    }
    const pages = locs.filter((l) => !/\.(jpg|jpeg|png|gif|webp|pdf|zip|mp4)$/i.test(l));
    sitemap = { exists: true, urlCount: pages.length, samples: pages.slice(0, 12) };
  }

  // sample up to 3 article pages (prefer post-looking URLs, skip home/policy pages)
  const candidates = sitemap.samples
    .filter((u) => {
      const p = new URL(u).pathname;
      return p.split("/").filter(Boolean).length >= 1 && !/\/(about|contact|privacy|terms|disclaimer|category|tag|author|page)\b/i.test(p);
    })
    .slice(0, 3);
  const articles: SampledArticle[] = [];
  if (candidates.length) {
    const results = await Promise.all(candidates.map(async (u) => {
      const r = await fetchPage(u);
      if (r.ok && r.html) return parseArticle(r.html, u, r.status);
      return null;
    }));
    for (const r of results) if (r) articles.push(r);
  }

  const estimatedPages = sitemap.exists ? sitemap.urlCount : homepage.internalLinks;

  return {
    domain,
    fetchedAt: new Date().toISOString(),
    homepage,
    robots,
    sitemap,
    articles,
    estimatedPages,
    errors,
  };
}
