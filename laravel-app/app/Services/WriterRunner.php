<?php

namespace App\Services;

use App\Models\ContentJob;

/**
 * Port of src/lib/writer-runner.ts - background pipeline for a ContentJob.
 *
 * DEVIATION: image generation (z-ai SDK in the original) is intentionally NOT
 * ported - there is no z-ai SDK in PHP. The `images` DB column is left NULL
 * (the API returns [] exactly like the original when no images exist) while
 * the AI's `imageBriefs` are kept in the result JSON so the user can still
 * create the described images manually. The {{IMAGE_N}} markers are dropped
 * from contentHtml, same as the original's leftover-marker cleanup.
 */
class WriterRunner
{
    private const STYLE_SUFFIX = [
        'vector' => 'flat vector illustration, minimal geometric shapes, solid colors, soft sage green and warm sand palette, pure white background, clean thin outlines, no text, no letters, no watermark',
        'photo' => 'professional photograph, natural lighting, sharp focus, realistic, high detail, no text overlay, no watermark',
        'brutalist' => 'neo-brutalist style illustration, bold flat colors, thick black outlines, simple geometric shapes, off-white background, no gradients, no text, no watermark',
        'diagram' => 'clean technical infographic diagram, minimal flat style, soft sage green and charcoal palette, white background, simple shapes, minimal labels, no watermark',
    ];

    /** Port of parseLinks(): "url | anchor" lines -> [{url, anchor}]. */
    public static function parseLinks(string $raw): array
    {
        $lines = array_values(array_filter(array_map('trim', explode("\n", $raw)), fn ($l) => $l !== ''));
        $out = [];
        foreach (array_slice($lines, 0, 10) as $line) {
            $parts = array_map('trim', explode('|', $line));
            $entry = ['url' => $parts[0], 'anchor' => $parts[1] ?? ''];
            if (preg_match('#^https?://.+\..+#', $entry['url'])) {
                $out[] = $entry;
            }
        }

        return $out;
    }

    /** Runs the article generation pipeline for a ContentJob. Never throws into callers. */
    public static function run(string $jobId): void
    {
        /** @var ContentJob|null $job */
        $job = ContentJob::find($jobId);
        if (! $job || $job->status !== 'PENDING') {
            return;
        }

        try {
            $job->update(['status' => 'RUNNING']);

            $input = [];
            try {
                $decoded = json_decode((string) ($job->input ?: '{}'), true);
                if (is_array($decoded)) {
                    $input = $decoded;
                }
            } catch (\Throwable) {
                $input = [];
            }

            $keyword = trim((string) ($input['keyword'] ?: $job->keyword));
            $words = max(800, min(4000, (int) ($input['words'] ?? 0) ?: 2500));
            $style = self::STYLE_SUFFIX[(string) ($input['imageStyle'] ?? 'vector')] ?? self::STYLE_SUFFIX['vector'];

            $prompts = Settings::get('prompts', Prompts::defaults());
            $master = $job->type === 'AFFILIATE'
                ? ((string) ($prompts['affiliate'] ?? '') ?: Prompts::AFFILIATE_DEFAULT)
                : ((string) ($prompts['writer'] ?? '') ?: Prompts::WRITER_DEFAULT);

            $system = $master
                . "\n\nLENGTH: aim for {$words} words (about " . (int) round($words / 300) . " substantial sections)."
                . "\nIMAGE STYLE for imageBriefs prompts: {$style}";

            $parts = ["Keyword: {$keyword}"];
            if (! empty($input['audience'])) {
                $parts[] = 'Target reader: ' . (string) $input['audience'];
            }
            if (! empty($input['internalLinks']) && is_array($input['internalLinks'])) {
                $lines = [];
                foreach ($input['internalLinks'] as $l) {
                    $l = is_array($l) ? $l : [];
                    $anchor = ((string) ($l['anchor'] ?? '')) ?: 'natural';
                    $lines[] = '- ' . ($l['url'] ?? '') . " (anchor: {$anchor})";
                }
                $parts[] = "Internal links to weave in naturally (use these URLs and anchors):\n" . implode("\n", $lines);
            }
            if ($job->type === 'AFFILIATE') {
                if (! empty($input['affiliateLinks']) && is_array($input['affiliateLinks'])) {
                    $lines = [];
                    foreach ($input['affiliateLinks'] as $l) {
                        $l = is_array($l) ? $l : [];
                        $lines[] = '- ' . ($l['label'] ?? '') . ': ' . ($l['url'] ?? '');
                    }
                    $parts[] = "Affiliate links to recommend (use ONLY these, with descriptive anchors):\n" . implode("\n", $lines);
                } else {
                    $parts[] = 'No affiliate links provided: write a general buying guide and note where the reader should compare options, but do not invent product URLs.';
                }
            }
            if (! empty($input['siteName'])) {
                $parts[] = 'The article will be published on: ' . (string) $input['siteName'];
            }
            if (! empty($input['notes'])) {
                $parts[] = 'Extra instructions from the publisher: ' . mb_substr((string) $input['notes'], 0, 500);
            }

            $res = Ai::json([
                'system' => $system,
                'user' => implode("\n\n", $parts),
                'mode' => $job->mode === 'PREMIUM' ? 'premium' : 'standard',
                'writer' => true,
                'maxTokens' => $job->mode === 'PREMIUM' ? 16000 : 10000,
                'temperature' => 0.55,
            ]);
            $data = is_array($res['data']) ? $res['data'] : [];

            // Clean content HTML: drop fences, scripts and inline event handlers
            $html = (string) ($data['contentHtml'] ?? '');
            $html = preg_replace('/^```html\s*/i', '', $html) ?? $html;
            $html = preg_replace('/```\s*$/i', '', $html) ?? $html;
            $html = trim($html);
            $html = preg_replace('/<script[\s\S]*?<\/script>/i', '', $html) ?? $html;
            $html = preg_replace('/on\w+="[^"]*"/i', '', $html) ?? $html;

            $slugFallback = mb_substr(preg_replace('/[^a-z0-9]+/', '-', strtolower($keyword)) ?? $keyword, 0, 60);

            $faqs = [];
            if (is_array($data['faqs'] ?? null)) {
                foreach (array_slice(array_values($data['faqs']), 0, 12) as $f) {
                    $f = is_array($f) ? $f : [];
                    $faqs[] = [
                        'q' => mb_substr((string) ($f['q'] ?? ''), 0, 300),
                        'a' => mb_substr((string) ($f['a'] ?? ''), 0, 1200),
                    ];
                }
            }

            $imageBriefs = [];
            if (is_array($data['imageBriefs'] ?? null)) {
                foreach (array_slice(array_values($data['imageBriefs']), 0, 3) as $b) {
                    $b = is_array($b) ? $b : [];
                    $imageBriefs[] = [
                        'title' => mb_substr((string) ($b['title'] ?? ''), 0, 120),
                        'alt' => mb_substr((string) ($b['alt'] ?? ''), 0, 200),
                        'prompt' => (string) ($b['prompt'] ?? ''),
                        'placement' => (string) ($b['placement'] ?? ''),
                    ];
                }
            }

            $wordCount = (int) ($data['wordCount'] ?? 0);
            if ($wordCount <= 0) {
                $split = preg_split('/\s+/', trim($html), -1, PREG_SPLIT_NO_EMPTY);
                $wordCount = $split === false ? 0 : count($split);
            }

            $result = [
                'title' => mb_substr((string) ($data['title'] ?? $keyword), 0, 200),
                'slug' => mb_substr((string) ($data['slug'] ?? $slugFallback), 0, 60),
                'metaTitle' => mb_substr((string) ($data['metaTitle'] ?: ($data['title'] ?? $keyword)), 0, 70),
                'metaDescription' => mb_substr((string) ($data['metaDescription'] ?? ''), 0, 160),
                'excerpt' => mb_substr((string) ($data['excerpt'] ?? ''), 0, 300),
                'focusKeyword' => mb_substr((string) ($data['focusKeyword'] ?? $keyword), 0, 100),
                'wordCount' => $wordCount,
                'contentHtml' => $html,
                'faqs' => $faqs,
                'imageBriefs' => $imageBriefs,
            ];

            // Images are NOT generated (no z-ai in PHP). Drop leftover
            // {{IMAGE_N}} markers from the final HTML, like the original does
            // for unreplaced markers.
            $result['contentHtml'] = (string) preg_replace('/\{\{\s*IMAGE_\d\s*\}\}/', '', $result['contentHtml']);

            $resultJson = json_encode($result, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            if ($resultJson === false) {
                $resultJson = json_encode($result);
            }

            // `images` stays NULL -> the API layer returns [] exactly like the
            // original did when no images existed.
            $job->update([
                'status' => 'DONE',
                'result' => $resultJson, // JSON STRING - the client JSON.parses it
                'images' => null,
            ]);
        } catch (\Throwable $e) {
            try {
                Credits::add((string) $job->userId, (int) $job->creditsUsed);
            } catch (\Throwable) {
            }
            $message = $e instanceof \Exception || $e instanceof \Error
                ? $e->getMessage()
                : 'Generation failed. Credits were refunded.';
            if ($message === '') {
                $message = 'Generation failed. Credits were refunded.';
            }
            try {
                $job->update(['status' => 'FAILED', 'error' => mb_substr($message, 0, 500)]);
            } catch (\Throwable) {
            }
        }
    }
}
