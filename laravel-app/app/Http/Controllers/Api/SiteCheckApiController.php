<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Activity;
use App\Services\Crawler;
use App\Services\Credits;
use App\Services\SafeUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

/**
 * Port of src/app/api/tools/site-check/route.ts - free public site check
 * (no signup): verifies the surface signals every ad network reviewer sees
 * first. Rate limited per IP, SSRF-guarded, read-only GETs.
 */
class SiteCheckApiController extends Controller
{
    private const TIMEOUT_SECONDS = 8;
    private const MAX_BYTES = 400000;
    private const UA = 'Mozilla/5.0 (compatible; Audit FormSiteCheck/1.0; +https://adaudit.app/bot)';

    /**
     * The original Next.js handler was POST with a JSON body; the Laravel route
     * contract exposes it as GET /api/tools/site-check, so the domain is read
     * from the query string OR the JSON body.
     */
    public function run(Request $request): JsonResponse
    {
        $limited = Credits::rateLimit('sitecheck:' . Credits::clientIp($request), 10, 10 * 60_000);
        if (! $limited['ok']) {
            return response()->json(
                ['error' => 'Too many checks from this address. Try again in ' . (int) ceil(($limited['retryAfter'] ?? 60) / 60) . ' minutes.'],
                429
            );
        }

        $raw = (string) $request->input('domain', '');
        if (trim($raw) === '' || mb_strlen(trim($raw)) < 3 || mb_strlen(trim($raw)) > 200) {
            return response()->json(['error' => 'Enter a domain, e.g. yourblog.com'], 400);
        }

        $domain = SafeUrl::normalizeDomain($raw);
        if (! preg_match('/^[a-z0-9.-]+\.[a-z]{2,}$/', $domain) || strlen($domain) > 253) {
            return response()->json(['error' => 'That does not look like a real domain. Example: yourblog.com'], 400);
        }

        try {
            SafeUrl::assertPublicUrl($domain);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e instanceof \Exception || $e instanceof \Error ? $e->getMessage() : 'This domain cannot be checked'], 400);
        }

        $checks = [];

        // 1. Homepage reachability over HTTPS
        $home = self::fetchText("https://{$domain}/");
        if (! $home['ok'] || $home['body'] === '') {
            $checks[] = ['id' => 'home', 'label' => 'Homepage loads over HTTPS', 'status' => 'risk', 'detail' => 'The site could not be reached over HTTPS. AdSense review starts with a reachable homepage.'];
            Activity::log(['action' => 'TOOL_SITECHECK', 'actorEmail' => 'anonymous@' . Credits::clientIp($request), 'detail' => "{$domain}: unreachable"]);
            $failed = ['domain' => $domain, 'checks' => $checks, 'passed' => 0, 'total' => 8];

            return response()->json($failed);
        }
        $checks[] = [
            'id' => 'home',
            'label' => 'Homepage loads over HTTPS',
            'status' => 'ok',
            'detail' => 'Reachable in ' . $home['ms'] . ' ms' . (str_starts_with($home['finalUrl'], 'https://') ? '' : ' (redirects to HTTP, which reviewers penalize)') . '.',
        ];

        $html = $home['body'];

        // 2. Title + meta description present
        $title = '';
        if (preg_match('/<title[^>]*>([^<]{1,200})<\/title>/i', $html, $m)) {
            $title = trim($m[1]);
        }
        $desc = '';
        if (preg_match('/<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']{1,300})["\']/i', $html, $m)) {
            $desc = trim($m[1]);
        }
        $checks[] = [
            'id' => 'meta',
            'label' => 'Title and meta description',
            'status' => $title !== '' && $desc !== '' ? 'ok' : ($title !== '' ? 'warn' : 'risk'),
            'detail' => $title === ''
                ? 'No title tag found. Reviewers and search engines both need one.'
                : ($desc !== ''
                    ? 'Title "' . mb_substr($title, 0, 70) . '" and a meta description are both present.'
                    : 'A title exists but the meta description is missing. Search traffic suffers without it.'),
        ];

        // 3. Mobile viewport
        $viewport = (bool) preg_match('/<meta[^>]+name=["\']viewport["\']/i', $html);
        $checks[] = [
            'id' => 'viewport',
            'label' => 'Mobile viewport declared',
            'status' => $viewport ? 'ok' : 'risk',
            'detail' => $viewport
                ? 'The page declares a viewport, so it renders on phones. AdSense requires mobile-friendly pages.'
                : 'No viewport meta tag. Without it the site fails the mobile-friendly bar on phones.',
        ];

        // 4. Mixed content: insecure http:// subresources on an https:// page
        if (str_starts_with($home['finalUrl'], 'https://')) {
            $mixedRefs = 0;
            if (preg_match_all('/<(?:img|script|iframe|source|video|audio)\b[^>]*?\bsrc=["\']http:\/\/[^"\']+["\']/i', $html, $mm)) {
                $mixedRefs = count($mm[0]);
            }
            $checks[] = [
                'id' => 'mixed',
                'label' => 'No mixed content on the homepage',
                'status' => $mixedRefs === 0 ? 'ok' : 'warn',
                'detail' => $mixedRefs === 0
                    ? 'Every image, script and frame on the homepage loads over HTTPS. Nothing for browsers to block or flag.'
                    : "{$mixedRefs} resource" . ($mixedRefs === 1 ? '' : 's') . ' on the homepage still load' . ($mixedRefs === 1 ? 's' : '') . ' over plain HTTP. Browsers block or flag mixed content, which makes the site look unfinished to reviewers.',
            ];
        } else {
            $checks[] = [
                'id' => 'mixed',
                'label' => 'No mixed content on the homepage',
                'status' => 'warn',
                'detail' => 'The homepage itself is not served over HTTPS, so every resource on it is insecure. Move the whole site to HTTPS first.',
            ];
        }

        // 5. AdSense script already present
        $hasAdsense = (bool) preg_match('/adsbygoogle\.js|pagead2\.googlesyndication\.com|google_ad_client|ca-pub-\d{8,}/i', $html);
        $checks[] = [
            'id' => 'adsense',
            'label' => 'AdSense script on the page',
            'status' => $hasAdsense ? 'ok' : 'warn',
            'detail' => $hasAdsense
                ? 'An AdSense tag is already serving on this page.'
                : 'No AdSense tag found yet. That is fine before approval; it must be added once the account is activated.',
        ];

        // 6. ads.txt
        $adsTxt = self::fetchText("https://{$domain}/ads.txt", 6);
        $adsTxtValid = $adsTxt['ok'] && (bool) preg_match('/google\.com[^,\n]*,\s*pub-\d+/i', $adsTxt['body']);
        $checks[] = [
            'id' => 'adstxt',
            'label' => 'ads.txt with your publisher ID',
            'status' => $adsTxtValid ? 'ok' : 'warn',
            'detail' => $adsTxtValid
                ? 'ads.txt exists and authorizes a Google publisher ID.'
                : ($hasAdsense
                    ? ($adsTxt['ok']
                        ? 'ads.txt exists but does not reference a Google pub- ID. Once approved, add: google.com, pub-XXXX, DIRECT, f08c47fec0942fa0.'
                        : 'No ads.txt found. After approval, add one at the domain root or ad revenue can be withheld.')
                    : 'No ads.txt yet. Needed after approval, not before.'),
        ];

        // 7. robots.txt + sitemap
        $robots = self::fetchText("https://{$domain}/robots.txt", 6);
        $sitemapInRobots = $robots['ok'] && (bool) preg_match('/sitemap:/i', $robots['body']);
        $sitemap = self::fetchText("https://{$domain}/sitemap.xml", 6);
        $sitemapOk = $sitemap['ok'] && (bool) preg_match('/<(urlset|sitemapindex)/i', $sitemap['body']);
        $checks[] = [
            'id' => 'crawl',
            'label' => 'robots.txt and XML sitemap',
            'status' => $robots['ok'] && $sitemapOk ? 'ok' : ($robots['ok'] || $sitemapOk ? 'warn' : 'risk'),
            'detail' => $robots['ok'] && $sitemapOk
                ? 'robots.txt is live' . ($sitemapInRobots ? ' and declares the sitemap' : '') . ', and sitemap.xml parses as a real sitemap.'
                : ($robots['ok'] || $sitemapOk
                    ? 'Found ' . ($robots['ok'] ? 'robots.txt' : 'sitemap.xml') . ' but not both. Submitting a sitemap speeds up indexing, which reviewers like to see.'
                    : 'Neither robots.txt nor sitemap.xml responded. Crawlers index such sites slowly and unevenly.'),
        ];

        // 8. Policy pages open for real (about / contact / privacy / terms)
        $policyTargets = [
            ['about', '/\/about(-us|-me)?\/?(\?|#|$)/i'],
            ['contact', '/\/contact(-us|-me)?\/?(\?|#|$)/i'],
            ['privacy', '/\/privacy(-policy)?\/?(\?|#|$)/i'],
            ['terms', '/\/terms(-of(-use|-service))?\/?(\?|#|$)/i'],
        ];
        $policyFound = [];
        $seen = [];
        if (preg_match_all('/<a\b[^>]*href=["\']([^"\'#\s]+)["\']/i', $html, $links)) {
            foreach ($links[1] as $href) {
                $low = strtolower($href);
                if (str_starts_with($low, 'mailto:') || str_starts_with($low, 'tel:') || str_starts_with($low, 'javascript:')) {
                    continue;
                }
                $abs = Crawler::resolveUrl($href, $home['finalUrl']);
                if ($abs === null) {
                    continue;
                }
                $absParts = parse_url($abs) ?: [];
                if (($absParts['host'] ?? '') !== (parse_url($home['finalUrl'], PHP_URL_HOST) ?: '') || isset($seen[$absParts['path'] ?? '/'])) {
                    continue;
                }
                $p = $absParts['path'] ?? '/';
                foreach ($policyTargets as [$path, $re]) {
                    if (preg_match($re, $p) && ! in_array($path, array_column($policyFound, 'path'), true)) {
                        $seen[$p] = true;
                        $policyFound[] = ['path' => $path, 'url' => $abs];
                    }
                }
                if (count($policyFound) === 4) {
                    break;
                }
            }
        }

        if (count($policyFound) === 0) {
            $checks[] = [
                'id' => 'policy',
                'label' => 'About, Contact, Privacy and Terms pages',
                'status' => 'risk',
                'detail' => 'None of these pages could be found in the homepage links. AdSense reviewers look for all of them, especially a privacy policy.',
            ];
        } else {
            $opened = [];
            $responses = self::fetchTextsParallel(array_column($policyFound, 'url'), 6);
            foreach ($responses as $i => $r) {
                $path = $policyFound[$i]['path'];
                if (! $r['ok'] || $r['body'] === '') {
                    $opened[] = ['path' => $path, 'words' => 0, 'reachable' => false];
                    continue;
                }
                $text = $r['body'];
                $text = preg_replace('/<script[\s\S]*?<\/script>/i', ' ', $text) ?? $text;
                $text = preg_replace('/<style[\s\S]*?<\/style>/i', ' ', $text) ?? $text;
                $text = preg_replace('/<nav[\s\S]*?<\/nav>/i', ' ', $text) ?? $text;
                $text = preg_replace('/<footer[\s\S]*?<\/footer>/i', ' ', $text) ?? $text;
                $text = preg_replace('/<[^>]+>/', ' ', $text) ?? $text;
                $text = preg_replace('/&[a-z]+;/i', ' ', $text) ?? $text;
                $text = trim((string) preg_replace('/\s+/', ' ', $text));
                $words = $text === '' ? 0 : count(explode(' ', $text));
                $opened[] = ['path' => $path, 'words' => $words, 'reachable' => true];
            }

            $good = count(array_filter($opened, fn ($p) => $p['reachable'] && $p['words'] >= 100));
            $thin = array_filter($opened, fn ($p) => $p['reachable'] && $p['words'] < 100);
            $missing = array_values(array_filter(array_column($policyTargets, 0), fn ($p) => ! in_array($p, array_column($policyFound, 'path'), true)));
            $allGood = $good === count($policyFound) && count($missing) === 0;

            $detail = $allGood
                ? 'All ' . count($opened) . ' policy pages open with real content (' . implode(', ', array_map(fn ($p) => "{$p['path']}: " . number_format($p['words']) . ' words', $opened)) . ').'
                : ($good >= 1
                    ? "{$good} of the policy pages found open with real content."
                        . (count($missing) > 0 ? ' Not linked from the homepage: ' . implode(', ', $missing) . '.' : '')
                        . (count($thin) > 0 ? ' Too thin: ' . implode(', ', array_column($thin, 'path')) . '.' : '')
                        . ' Reviewers read these, so fill the gaps.'
                    : 'Policy page links exist, but none of them opened with readable content. Reviewers treat empty legal pages as a red flag.');

            $checks[] = [
                'id' => 'policy',
                'label' => 'About, Contact, Privacy and Terms pages',
                'status' => $allGood ? 'ok' : ($good >= 1 ? 'warn' : 'risk'),
                'detail' => $detail,
            ];
        }

        $passed = count(array_filter($checks, fn ($c) => $c['status'] === 'ok'));
        Activity::log(['action' => 'TOOL_SITECHECK', 'actorEmail' => 'anonymous@' . Credits::clientIp($request), 'detail' => "{$domain}: {$passed}/" . count($checks) . ' passed']);

        return response()->json([
            'domain' => $domain,
            'checks' => $checks,
            'passed' => $passed,
            'total' => count($checks),
        ]);
    }

    /** @return array{ok: bool, status: int, body: string, finalUrl: string, ms: int} */
    private static function fetchText(string $url, int $timeoutSeconds = self::TIMEOUT_SECONDS): array
    {
        $started = (int) floor(microtime(true) * 1000);
        try {
            $res = Http::withHeaders(['User-Agent' => self::UA])
                ->timeout($timeoutSeconds)
                ->get($url);

            return [
                'ok' => $res->successful(),
                'status' => $res->status(),
                'body' => mb_substr($res->body(), 0, self::MAX_BYTES),
                'finalUrl' => (string) ($res->effectiveUri() ?: $url),
                'ms' => (int) floor(microtime(true) * 1000) - $started,
            ];
        } catch (\Throwable) {
            return ['ok' => false, 'status' => 0, 'body' => '', 'finalUrl' => $url, 'ms' => (int) floor(microtime(true) * 1000) - $started];
        }
    }

    /**
     * @param string[] $urls
     * @return list<array{ok: bool, status: int, body: string, finalUrl: string, ms: int}>
     */
    private static function fetchTextsParallel(array $urls, int $timeoutSeconds = self::TIMEOUT_SECONDS): array
    {
        if ($urls === []) {
            return [];
        }
        $responses = Http::pool(function ($pool) use ($urls, $timeoutSeconds) {
            foreach (array_values($urls) as $i => $u) {
                $pool->as((string) $i)->withHeaders(['User-Agent' => self::UA])->timeout($timeoutSeconds)->get($u);
            }
        });

        $out = [];
        foreach (array_values($urls) as $i => $u) {
            $res = $responses[$i] ?? $responses[(string) $i] ?? null;
            if ($res instanceof \Illuminate\Http\Client\Response) {
                $out[] = [
                    'ok' => $res->successful(),
                    'status' => $res->status(),
                    'body' => mb_substr($res->body(), 0, self::MAX_BYTES),
                    'finalUrl' => (string) ($res->effectiveUri() ?: $u),
                    'ms' => 0,
                ];
            } else {
                $out[] = ['ok' => false, 'status' => 0, 'body' => '', 'finalUrl' => $u, 'ms' => 0];
            }
        }

        return $out;
    }
}
