<?php

namespace App\Services;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Symfony\DomCrawler\Crawler as DomCrawler;

/**
 * Port of src/lib/crawler.ts - fetches a site's homepage, robots.txt and
 * sitemap, samples article pages and extracts every signal field 1:1 so the
 * AI prompt data and the report signals JSON have identical shapes.
 */
class Crawler
{
    public const UA = 'Mozilla/5.0 (compatible; Audit FormBot/1.0; +https://adaudit.app/bot)';
    public const TIMEOUT_SECONDS = 15; // AbortSignal.timeout(15_000) in crawler.ts

    private const NAV_PATTERNS = [
        'about' => '/\/about(-us|-me)?\/?$/i',
        'contact' => '/\/contact(-us|-me)?\/?$/i',
        'privacy' => '/\/privacy(-policy)?\/?$/i',
        'terms' => '/\/(terms(-of-(service|use))?|tos)\/?$/i',
        'disclaimer' => '/\/disclaimer\/?$/i',
        'editorial' => '/\/(editorial|editorial-policy)\/?$/i',
        'authors' => '/\/(author|team|writers|about-the-author)/i',
    ];

    // ---------- fetching ----------

    /** @return array{ok: bool, status: int, html: string, ms: int, finalUrl: string} */
    public static function fetchPage(string $url): array
    {
        $started = (int) floor(microtime(true) * 1000);
        try {
            $res = Http::withHeaders([
                    'User-Agent' => self::UA,
                    'Accept' => 'text/html,application/xhtml+xml',
                ])
                ->timeout(self::TIMEOUT_SECONDS)
                ->get($url);

            return [
                'ok' => $res->successful(),
                'status' => $res->status(),
                'html' => mb_substr($res->body(), 0, 900000),
                'ms' => (int) floor(microtime(true) * 1000) - $started,
                'finalUrl' => (string) ($res->effectiveUri() ?: $url),
            ];
        } catch (\Throwable) {
            return ['ok' => false, 'status' => 0, 'html' => '', 'ms' => (int) floor(microtime(true) * 1000) - $started, 'finalUrl' => $url];
        }
    }

    public static function fetchText(string $url): string
    {
        try {
            $res = Http::withHeaders(['User-Agent' => self::UA])
                ->timeout(self::TIMEOUT_SECONDS)
                ->get($url);

            return $res->successful() ? $res->body() : '';
        } catch (\Throwable) {
            return '';
        }
    }

    // ---------- parsing ----------

    /** UTF-8 tolerant DOM loader. */
    private static function loadDoc(string $html): \DOMDocument
    {
        $doc = new \DOMDocument();
        libxml_use_internal_errors(true);
        if (trim($html) !== '') {
            $doc->loadHTML('<?xml encoding="utf-8" ?>' . $html, LIBXML_NOERROR | LIBXML_NOWARNING);
        }
        libxml_clear_errors();

        return $doc;
    }

    /** Removes every matching element (by tag name) from the document. */
    private static function stripTags(\DOMDocument $doc, array $tags): void
    {
        foreach ($tags as $tag) {
            $nodes = $doc->getElementsByTagName($tag);
            // Collect first: removing while iterating a live list skips nodes.
            $remove = [];
            foreach ($nodes as $node) {
                $remove[] = $node;
            }
            foreach ($remove as $node) {
                $node->parentNode?->removeChild($node);
            }
        }
    }

    private static function bodyText(\DOMDocument $doc): string
    {
        $bodies = $doc->getElementsByTagName('body');

        return $bodies->length ? ($bodies->item(0)->textContent ?? '') : ($doc->textContent ?? '');
    }

    private static function normalizeWs(string $s): string
    {
        return trim((string) preg_replace('/\s+/u', ' ', $s));
    }

    private static function words(string $text): int
    {
        if ($text === '') {
            return 0;
        }
        $parts = preg_split('/\s+/u', trim($text), -1, PREG_SPLIT_NO_EMPTY);

        return $parts === false ? 0 : count($parts);
    }

    /** Port of new URL(href, base) for the cases the crawler encounters. */
    public static function resolveUrl(string $href, string $base): ?string
    {
        $href = trim($href);
        if ($href === '' || $href[0] === '#') {
            return null;
        }
        // Absolute with an http(s) scheme
        if (preg_match('#^https?://#i', $href)) {
            return $href;
        }
        // mailto:, tel:, javascript:, data:, app:, ...
        if (preg_match('#^[a-zA-Z][a-zA-Z0-9+.\-]*:#', $href)) {
            return null;
        }

        $b = parse_url($base);
        if (! $b || empty($b['host'])) {
            return null;
        }
        $scheme = strtolower($b['scheme'] ?? 'https');
        $host = $b['host'];
        $port = isset($b['port']) ? ':' . $b['port'] : '';
        $basePath = $b['path'] ?? '/';

        $hp = parse_url($href);
        if ($hp === false) {
            return null;
        }

        // Protocol-relative: //cdn.example.com/x
        if (! empty($hp['host'])) {
            $pport = isset($hp['port']) ? ':' . $hp['port'] : '';

            return "{$scheme}://{$hp['host']}{$pport}" . ($hp['path'] ?? '/') .
                (isset($hp['query']) ? '?' . $hp['query'] : '') .
                (isset($hp['fragment']) ? '#' . $hp['fragment'] : '');
        }

        $path = $hp['path'] ?? '';
        $query = isset($hp['query']) ? '?' . $hp['query'] : '';
        $fragment = isset($hp['fragment']) ? '#' . $hp['fragment'] : '';

        if ($path === '') {
            $path = $basePath;
        } elseif ($path[0] !== '/') {
            $dir = preg_replace('#/[^/]*$#', '/', $basePath);
            if (! $dir) {
                $dir = '/';
            }
            $path = $dir . $path;
        }
        $path = self::removeDotSegments($path);

        return "{$scheme}://{$host}{$port}{$path}{$query}{$fragment}";
    }

    private static function removeDotSegments(string $path): string
    {
        if (! str_contains($path, '.')) {
            return $path;
        }
        $out = [];
        foreach (explode('/', $path) as $seg) {
            if ($seg === '.') {
                continue;
            }
            if ($seg === '..') {
                array_pop($out);
                continue;
            }
            $out[] = $seg;
        }

        return implode('/', $out);
    }

    /** URL origin (scheme://host[:non-standard-port]) like the JS URL.origin. */
    private static function origin(array $parts): string
    {
        $scheme = strtolower($parts['scheme'] ?? 'https');
        $host = $parts['host'] ?? '';
        $port = isset($parts['port']) && !(($scheme === 'http' && $parts['port'] === 80) || ($scheme === 'https' && $parts['port'] === 443))
            ? ':' . $parts['port']
            : '';

        return "{$scheme}://{$host}{$port}";
    }

    private static function pathnameOf(string $url): string
    {
        $p = parse_url($url);

        return $p['path'] ?? '/';
    }

    /**
     * Port of parseHomepage().
     *
     * @return array<string, mixed> PageSignals
     */
    public static function parseHomepage(string $html, string $baseUrl, int $status, int $ms, string $finalUrl): array
    {
        $strippedDoc = self::loadDoc($html);
        self::stripTags($strippedDoc, ['script', 'style', 'noscript', 'svg']);
        $stripped = new DomCrawler($strippedDoc);

        $fullDoc = self::loadDoc($html);
        $withScripts = new DomCrawler($fullDoc);

        // text from the stripped body
        $text = self::normalizeWs(self::bodyText($strippedDoc));

        // links (from the full document, like the original)
        $origin = self::origin(parse_url($baseUrl) ?: []);
        $internal = 0;
        $external = 0;
        $socialLinks = [];
        $categoryPaths = [];
        $navPages = [];

        foreach ($withScripts->filter('a[href]') as $a) {
            $href = $a->getAttribute('href');
            $low = strtolower($href);
            if (str_starts_with($low, 'mailto:') || str_starts_with($low, 'tel:') || str_starts_with($low, 'javascript:')) {
                continue;
            }
            $abs = self::resolveUrl($href, $baseUrl);
            if ($abs === null) {
                continue;
            }
            $absParts = parse_url($abs) ?: [];
            if (empty($absParts['host'])) {
                continue;
            }
            if (self::origin($absParts) === $origin) {
                $internal++;
                $p = $absParts['path'] ?? '/';
                foreach (self::NAV_PATTERNS as $key => $re) {
                    if (preg_match($re, $p)) {
                        $navPages[$key] = true;
                    }
                }
                if (preg_match('/\/(category|categories|tag|topics)\//i', $p)) {
                    $categoryPaths[] = $p;
                }
            } else {
                $external++;
                if (preg_match('/facebook\.com|twitter\.com|x\.com|instagram\.com|youtube\.com|linkedin\.com|pinterest\.com|t\.me/i', strtolower($absParts['host'] ?? ''))) {
                    $socialLinks[] = self::origin($absParts);
                }
            }
        }

        // script sources + inline script text, lowercased
        $scriptsHtml = '';
        foreach ($withScripts->filter('script') as $s) {
            $scriptsHtml .= $s->ownerDocument?->saveHTML($s);
        }
        $scriptsHtml = strtolower($scriptsHtml);

        $adScripts = [];
        if (str_contains($scriptsHtml, 'adsbygoogle')) {
            $adScripts[] = 'Google AdSense';
        }
        if (str_contains($scriptsHtml, 'ezoic')) {
            $adScripts[] = 'Ezoic';
        }
        if (str_contains($scriptsHtml, 'mediavine')) {
            $adScripts[] = 'Mediavine';
        }
        if (str_contains($scriptsHtml, 'raptive') || str_contains($scriptsHtml, 'adthrive')) {
            $adScripts[] = 'Raptive';
        }
        $analytics = [];
        if (str_contains($scriptsHtml, 'googletagmanager') || str_contains($scriptsHtml, 'gtag(')) {
            $analytics[] = 'Google Analytics/GTM';
        }
        if (str_contains($scriptsHtml, 'plausible')) {
            $analytics[] = 'Plausible';
        }
        if (str_contains($scriptsHtml, 'clarity.ms')) {
            $analytics[] = 'Microsoft Clarity';
        }

        $generatorContents = $withScripts->filter('meta[name="generator"]')->each(
            fn (DomCrawler $n) => $n->attr('content') ?? ''
        );

        $platform = 'unknown';
        if (str_contains($scriptsHtml, 'wp-content') || self::someContains($generatorContents, 'WordPress')) {
            $platform = 'WordPress';
        } elseif (self::someContains($generatorContents, 'Blogger') || str_contains($scriptsHtml, 'blogspot')) {
            $platform = 'Blogger';
        } elseif (str_contains($scriptsHtml, 'cdn.shopify')) {
            $platform = 'Shopify';
        } elseif (self::someContains($generatorContents, 'Wix')) {
            $platform = 'Wix';
        } elseif (str_contains($scriptsHtml, 'static.parastorage') || str_contains($scriptsHtml, 'wixstatic')) {
            $platform = 'Wix';
        }

        $images = 0;
        $imagesMissingAlt = 0;
        foreach ($withScripts->filter('img') as $img) {
            $images++;
            $alt = $img->getAttribute('alt');
            if (trim($alt) === '') {
                $imagesMissingAlt++;
            }
        }

        $bodyText = self::bodyText($fullDoc);
        $copyrightYear = null;
        if (preg_match('/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(20\d{2})/i', $bodyText, $m)) {
            $copyrightYear = $m[1];
        }
        $hasContactForm = $withScripts->filter("form input[type='email'], form textarea")->count() > 0;

        $title = '';
        if ($stripped->filter('title')->count()) {
            $title = mb_substr(trim($stripped->filter('title')->first()->text()), 0, 200);
        }
        $metaDescription = '';
        if ($withScripts->filter('meta[name="description"]')->count()) {
            $metaDescription = mb_substr(trim((string) $withScripts->filter('meta[name="description"]')->first()->attr('content')), 0, 300);
        }
        $robotsMeta = '';
        if ($withScripts->filter('meta[name="robots"]')->count()) {
            $robotsMeta = mb_substr((string) $withScripts->filter('meta[name="robots"]')->first()->attr('content'), 0, 100);
        }
        $lang = '';
        if ($withScripts->filter('html')->count()) {
            $lang = (string) $withScripts->filter('html')->first()->attr('lang');
        }

        $socialLinks = array_values(array_unique($socialLinks));
        $categoryPaths = array_values(array_unique($categoryPaths));

        return [
            'url' => $baseUrl,
            'statusCode' => $status,
            'responseMs' => $ms,
            'https' => str_starts_with($baseUrl, 'https://'),
            'redirected' => preg_replace('/^https?/', '', $finalUrl) !== preg_replace('/^https?/', '', $baseUrl),
            'finalUrl' => $finalUrl,
            'title' => $title,
            'metaDescription' => $metaDescription,
            'viewport' => $withScripts->filter('meta[name="viewport"]')->count() > 0,
            'canonical' => $withScripts->filter('link[rel="canonical"]')->count() > 0,
            'robotsMeta' => $robotsMeta,
            'lang' => $lang,
            'h1Count' => $stripped->filter('h1')->count(),
            'h2Count' => $stripped->filter('h2')->count(),
            'wordCount' => self::words($text),
            'textPreview' => mb_substr($text, 0, 1200),
            'internalLinks' => $internal,
            'externalLinks' => $external,
            'navPages' => $navPages === [] ? new \stdClass() : $navPages,
            'images' => $images,
            'imagesMissingAlt' => $imagesMissingAlt,
            'adScripts' => $adScripts,
            'analytics' => $analytics,
            'platform' => $platform,
            'socialLinks' => array_slice($socialLinks, 0, 5),
            'hasContactForm' => $hasContactForm,
            'copyrightYear' => $copyrightYear,
            'categoryLinks' => array_slice($categoryPaths, 0, 8),
        ];
    }

    private static function someContains(array $haystacks, string $needle): bool
    {
        foreach ($haystacks as $h) {
            if (str_contains($h, $needle)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Port of parseArticle().
     *
     * @return array<string, mixed> SampledArticle
     */
    public static function parseArticle(string $html, string $url, int $status): array
    {
        $doc = self::loadDoc($html);
        $c = new DomCrawler($doc);

        $main = null;
        if ($c->filter('article')->count()) {
            $main = $c->filter('article')->first();
        } elseif ($c->filter('main')->count()) {
            $main = $c->filter('main')->first();
        } elseif ($c->filter('body')->count()) {
            $main = $c->filter('body')->first();
        }
        $mainNode = $main?->getNode(0);
        $text = self::normalizeWs($mainNode?->textContent ?? '');

        $lower = strtolower($html);

        $datePublished = null;
        try {
            if ($c->filter('script[type="application/ld+json"]')->count()) {
                $ld = json_decode($c->filter('script[type="application/ld+json"]')->first()->text(), true);
                if (is_array($ld)) {
                    $datePublished = $ld['datePublished'] ?? $ld['dateCreated'] ?? null;
                    if (is_string($datePublished) && $datePublished === '') {
                        $datePublished = null;
                    }
                }
            }
        } catch (\Throwable) {
            // optional
        }

        $hostname = parse_url($url, PHP_URL_HOST) ?: '';

        $externalLinks = 0;
        if ($mainNode !== null) {
            foreach ($main->filter("a[href^='http']") as $a) {
                $href = (string) $a->getAttribute('href');
                if ($hostname !== '' && str_contains($href, $hostname)) {
                    continue;
                }
                $externalLinks++;
            }
        }

        $authorByline = false;
        if (str_contains($lower, 'rel="author"')) {
            $authorByline = true;
        } elseif ($main !== null && $main->filter('.author,.byline,[rel=author]')->count() > 0) {
            $authorByline = true;
        } elseif (preg_match('/written by|by\s+[A-Z]/', mb_substr($text, 0, 500))) {
            $authorByline = true;
        }

        $imagesMissingAlt = 0;
        if ($main !== null) {
            foreach ($main->filter('img') as $img) {
                if (trim((string) $img->getAttribute('alt')) === '') {
                    $imagesMissingAlt++;
                }
            }
        }

        $title = '';
        if ($c->filter('title')->count()) {
            $title = mb_substr(trim($c->filter('title')->first()->text()), 0, 150);
        }

        return [
            'url' => $url,
            'statusCode' => $status,
            'wordCount' => self::words($text),
            'headings' => $main ? $main->filter('h2,h3')->count() : 0,
            'paragraphs' => $main ? $main->filter('p')->count() : 0,
            'externalLinks' => $externalLinks,
            'authorByline' => $authorByline,
            'datePublished' => $datePublished,
            'structuredData' => str_contains($lower, 'application/ld+json'),
            'imagesMissingAlt' => $imagesMissingAlt,
            'title' => $title,
        ];
    }

    // ---------- crawling ----------

    /**
     * Port of crawlSite(). Throws (SSRF guard) when the domain is not a
     * public http(s) target - same as the original.
     *
     * @return array<string, mixed> CrawlSignals
     */
    public static function crawlSite(string $rawDomain, bool $deep = false): array
    {
        $domain = SafeUrl::normalizeDomain($rawDomain);
        SafeUrl::assertPublicUrl($domain); // SSRF guard: resolve + reject private targets

        $errors = [];
        $base = "https://{$domain}";

        $home = self::fetchPage($base);
        if (! $home['ok'] || $home['html'] === '') {
            // try www
            $alt = self::fetchPage("https://www.{$domain}");
            if ($alt['ok'] && $alt['html'] !== '') {
                return self::crawlFromHome($alt, "https://www.{$domain}", $domain, $errors, true, $deep);
            }
            $errors[] = 'Homepage request failed (status ' . ($home['status'] ?: 'network error') . ')';

            return [
                'domain' => $domain,
                'fetchedAt' => now()->toIso8601String(),
                'homepage' => null,
                'robots' => ['exists' => false, 'sitemapDeclared' => false, 'blocksAll' => false],
                'sitemap' => ['exists' => false, 'urlCount' => 0, 'samples' => []],
                'articles' => [],
                'estimatedPages' => 0,
                'errors' => $errors,
                'deepScan' => $deep,
            ];
        }

        return self::crawlFromHome($home, $home['finalUrl'] ?: $base, $domain, $errors, false, $deep);
    }

    /**
     * @param array{html: string, status: int, ms: int, finalUrl: string} $home
     * @param string[] $errors
     * @return array<string, mixed>
     */
    private static function crawlFromHome(array $home, string $homeUrl, string $domain, array $errors, bool $usedWww, bool $deep): array
    {
        $homepage = self::parseHomepage($home['html'], $homeUrl, $home['status'], $home['ms'], $home['finalUrl']);
        if ($usedWww) {
            $errors[] = 'Site is only reachable at www.' . $domain;
        }

        // robots.txt
        $robotsTxt = self::fetchText("https://{$domain}/robots.txt");
        $robots = [
            'exists' => str_contains($robotsTxt, 'user-agent'),
            'sitemapDeclared' => (bool) preg_match('/sitemap\s*:/i', $robotsTxt),
            'blocksAll' => (bool) (preg_match('/disallow:\s*\/\s*$/im', $robotsTxt) && preg_match('/user-agent:\s*\*/i', $robotsTxt)),
        ];

        // sitemap
        $sitemapUrl = '';
        if (preg_match('/sitemap\s*:\s*(\S+)/i', $robotsTxt, $m)) {
            $sitemapUrl = $m[1];
        }
        $sitemapXml = $sitemapUrl !== '' ? self::fetchText($sitemapUrl) : '';
        if (! str_contains($sitemapXml, '<urlset') && ! str_contains($sitemapXml, '<sitemapindex')) {
            foreach (["https://{$domain}/sitemap.xml", "https://{$domain}/sitemap_index.xml", "https://{$domain}/wp-sitemap.xml"] as $candidate) {
                $xml = self::fetchText($candidate);
                if (str_contains($xml, '<urlset') || str_contains($xml, '<sitemapindex')) {
                    $sitemapXml = $xml;
                    $sitemapUrl = $candidate;
                    break;
                }
            }
        }

        $sitemap = ['exists' => false, 'urlCount' => 0, 'samples' => []];
        $sitemapsTraversed = 0;
        if (str_contains($sitemapXml, '<urlset') || str_contains($sitemapXml, '<sitemapindex')) {
            $locs = self::collectSitemapLocs($sitemapXml);
            if (str_contains($sitemapXml, '<sitemapindex')) {
                // standard: first child only; deep: up to 8 child sitemaps
                $children = array_values(array_filter($locs, fn ($l) => str_contains($l, '.xml')));
                $children = array_slice($children, 0, $deep ? 8 : 1);
                $all = [];
                foreach ($children as $child) {
                    $childXml = self::fetchText($child);
                    if (str_contains($childXml, '<urlset')) {
                        $sitemapsTraversed++;
                        $all = array_merge($all, self::collectSitemapLocs($childXml));
                    }
                }
                if ($sitemapsTraversed === 0) {
                    $errors[] = 'Sitemap index declared but none of its child sitemaps could be read';
                }
                if ($all !== []) {
                    $locs = $all;
                } else {
                    $locs = array_values(array_filter($locs, fn ($l) => ! str_contains($l, '.xml')));
                }
            } else {
                $sitemapsTraversed = 1;
            }
            $pages = array_values(array_filter($locs, fn ($l) => ! preg_match('/\.(jpg|jpeg|png|gif|webp|pdf|zip|mp4)$/i', $l)));
            $sitemap = ['exists' => true, 'urlCount' => count($pages), 'samples' => array_slice(array_values($pages), 0, $deep ? 40 : 12)];
        }

        // sample up to 3 article pages (up to 10 on deep scans); prefer post-looking
        // URLs, skip home/policy pages. Stride across large pools so old and new
        // posts are both represented.
        $pool = [];
        foreach ($sitemap['samples'] as $u) {
            $p = self::pathnameOf($u);
            $segments = count(array_filter(explode('/', $p), fn ($s) => $s !== ''));
            if ($segments >= 1 && ! preg_match('/\/(about|contact|privacy|terms|disclaimer|category|tag|author|page)\b/i', $p)) {
                $pool[] = $u;
            }
        }
        $sampleSize = $deep ? 10 : 3;
        $candidates = $pool;
        if (count($pool) > $sampleSize) {
            $stride = count($pool) / $sampleSize;
            $candidates = [];
            for ($i = 0; $i < $sampleSize; $i++) {
                $idx = (int) floor($i * $stride);
                if (isset($pool[$idx])) {
                    $candidates[$idx] = $pool[$idx];
                }
            }
            $candidates = array_values($candidates);
        }

        $articles = [];
        if ($candidates !== []) {
            $responses = self::fetchPagesParallel($candidates);
            foreach ($responses as $r) {
                if ($r['ok'] && $r['html'] !== '') {
                    $articles[] = self::parseArticle($r['html'], $r['url'], $r['status']);
                }
            }
        }

        // Deep-scan extras: verify policy/nav pages with real fetches, probe one
        // category page, measure freshness.
        $navPageChecks = [];
        $categoryCheck = null;
        $contentFreshness = null;
        $thinArticleRatio = null;

        if ($deep && $homepage !== null) {
            $navTargets = [
                ['about', '/\/about(-us|-me)?\/?$/i'],
                ['contact', '/\/contact(-us|-me)?\/?$/i'],
                ['privacy', '/\/privacy(-policy)?\/?$/i'],
                ['terms', '/\/(terms(-of-(service|use))?|tos)\/?$/i'],
            ];
            $origin = self::origin(parse_url($homepage['url']) ?: []);
            $fullDoc = self::loadDoc($home['html']); // fresh parse: parseHomepage strips what we need
            $h = new DomCrawler($fullDoc);
            $found = [];
            foreach ($h->filter('a[href]') as $a) {
                $href = $a->getAttribute('href');
                $abs = self::resolveUrl($href, $homepage['url']);
                if ($abs === null) {
                    continue;
                }
                $p = self::pathnameOf($abs);
                foreach ($navTargets as [$path, $re]) {
                    if (preg_match($re, $p) && ! isset($found[$path])) {
                        $found[$path] = ['path' => $path, 'url' => $abs];
                    }
                }
            }
            $found = array_values($found);

            $checkResponses = self::fetchPagesParallel(array_column($found, 'url'));
            foreach ($checkResponses as $i => $r) {
                $path = $found[$i]['path'];
                if (! $r['ok'] || $r['html'] === '') {
                    $navPageChecks[] = ['path' => $path, 'url' => $r['url'], 'statusCode' => $r['status'], 'wordCount' => 0, 'hasContent' => false];
                    continue;
                }
                $d = self::loadDoc($r['html']);
                self::stripTags($d, ['script', 'style', 'noscript', 'svg', 'nav', 'footer', 'header']);
                $cc = new DomCrawler($d);
                $words = '';
                if ($cc->filter('main')->count()) {
                    $words = $cc->filter('main')->first()->getNode(0)->textContent ?? '';
                } else {
                    $words = self::bodyText($d);
                }
                $words = self::normalizeWs($words);
                $wordCount = self::words($words);
                $navPageChecks[] = ['path' => $path, 'url' => $r['url'], 'statusCode' => $r['status'], 'wordCount' => $wordCount, 'hasContent' => $wordCount >= 150];
            }
            $navPageChecks = array_slice($navPageChecks, 0, 4);

            if (($homepage['categoryLinks'] ?? []) !== []) {
                $catUrl = self::resolveUrl($homepage['categoryLinks'][0], $origin) ?? ($origin . $homepage['categoryLinks'][0]);
                $r = self::fetchPage($catUrl);
                if ($r['ok'] && $r['html'] !== '') {
                    $d = self::loadDoc($r['html']);
                    self::stripTags($d, ['script', 'style', 'noscript', 'svg']);
                    $cc = new DomCrawler($d);
                    $catWords = self::normalizeWs(self::bodyText($d));
                    $catHost = parse_url($catUrl, PHP_URL_HOST) ?: '';
                    $articleLinks = 0;
                    foreach ($cc->filter('a[href]') as $a) {
                        $href = $a->getAttribute('href');
                        $abs = self::resolveUrl($href, $catUrl);
                        if ($abs === null) {
                            continue;
                        }
                        $ap = parse_url($abs) ?: [];
                        $apPath = $ap['path'] ?? '/';
                        $segments = count(array_filter(explode('/', $apPath), fn ($s) => $s !== ''));
                        if (($ap['host'] ?? '') === $catHost
                            && ! preg_match('/\/(category|tag|page|about|contact|privacy|terms|#)/i', $apPath)
                            && $segments >= 1) {
                            $articleLinks++;
                        }
                    }
                    $categoryCheck = ['url' => $catUrl, 'statusCode' => $r['status'], 'wordCount' => self::words($catWords), 'articleLinks' => $articleLinks];
                } else {
                    $categoryCheck = ['url' => $catUrl, 'statusCode' => $r['status'], 'wordCount' => 0, 'articleLinks' => 0];
                }
            }

            $dates = [];
            foreach ($articles as $a) {
                $d = $a['datePublished'] ?? null;
                if (is_string($d) && preg_match('/^\d{4}-\d{2}-\d{2}/', $d)) {
                    $dates[] = $d;
                }
            }
            if ($dates !== []) {
                $now = time();
                $day = 86400;
                $parsed = [];
                foreach ($dates as $d) {
                    $ts = strtotime(substr($d, 0, 10) . 'T00:00:00Z');
                    if ($ts !== false) {
                        $parsed[] = $ts;
                    }
                }
                if ($parsed !== []) {
                    $contentFreshness = [
                        'newest' => gmdate('Y-m-d', max($parsed)),
                        'oldest' => gmdate('Y-m-d', min($parsed)),
                        'datedArticles' => count($parsed),
                        'within90d' => count(array_filter($parsed, fn ($t) => $now - $t <= 90 * $day)),
                        'within365d' => count(array_filter($parsed, fn ($t) => $now - $t <= 365 * $day)),
                    ];
                }
            }
            if ($articles !== []) {
                $thin = count(array_filter($articles, fn ($a) => $a['wordCount'] > 0 && $a['wordCount'] < 600));
                $thinArticleRatio = round(($thin / count($articles)) * 100) / 100;
            }
        }

        $estimatedPages = $sitemap['exists'] ? $sitemap['urlCount'] : $homepage['internalLinks'];

        $out = [
            'domain' => $domain,
            'fetchedAt' => now()->toIso8601String(),
            'homepage' => $homepage,
            'robots' => $robots,
            'sitemap' => $sitemap,
            'articles' => $articles,
            'estimatedPages' => $estimatedPages,
            'errors' => $errors,
            'deepScan' => $deep,
        ];
        if ($sitemapsTraversed > 0) {
            $out['sitemapsTraversed'] = $sitemapsTraversed;
        }
        if ($navPageChecks !== []) {
            $out['navPageChecks'] = $navPageChecks;
        }
        $out['categoryCheck'] = $categoryCheck;
        $out['contentFreshness'] = $contentFreshness;
        if ($thinArticleRatio !== null) {
            $out['thinArticleRatio'] = $thinArticleRatio;
        }

        return $out;
    }

    /** All <loc> entries of a sitemap document, entity-decoded and trimmed. */
    private static function collectSitemapLocs(string $xml): array
    {
        preg_match_all('/<loc>(.*?)<\/loc>/s', $xml, $m);

        return array_values(array_map(
            fn ($l) => trim(html_entity_decode($l, ENT_QUOTES | ENT_XML1, 'UTF-8')),
            $m[1] ?? []
        ));
    }

    /**
     * Parallel page fetches (Promise.all parity). Returns one result array per
     * input URL, always the same keys as fetchPage() plus the requested url.
     *
     * @param string[] $urls
     * @return list<array{url: string, ok: bool, status: int, html: string, finalUrl: string}>
     */
    private static function fetchPagesParallel(array $urls): array
    {
        if ($urls === []) {
            return [];
        }
        $responses = Http::pool(function ($pool) use ($urls) {
            foreach (array_values($urls) as $i => $u) {
                $pool->as((string) $i)
                    ->withHeaders(['User-Agent' => self::UA, 'Accept' => 'text/html,application/xhtml+xml'])
                    ->timeout(self::TIMEOUT_SECONDS)
                    ->get($u);
            }
        });

        $out = [];
        foreach (array_values($urls) as $i => $u) {
            $res = $responses[$i] ?? $responses[(string) $i] ?? null;
            if ($res instanceof Response) {
                $out[] = [
                    'url' => $u,
                    'ok' => $res->successful(),
                    'status' => $res->status(),
                    'html' => mb_substr($res->body(), 0, 900000),
                    'finalUrl' => (string) ($res->effectiveUri() ?: $u),
                ];
            } else {
                $out[] = ['url' => $u, 'ok' => false, 'status' => 0, 'html' => '', 'finalUrl' => $u];
            }
        }

        return $out;
    }
}
