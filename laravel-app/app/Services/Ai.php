<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Port of src/lib/ai.ts - OpenRouter chat client.
 *
 * The original had a z-ai-web-dev-sdk fallback when no OpenRouter key was
 * configured; the PHP port is OpenRouter only (no z-ai SDK exists here), so a
 * missing/short key throws instead of falling back. Return shapes are kept.
 */
class Ai
{
    public const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
    public const TIMEOUT_SECONDS = 300; // AbortSignal.timeout(300_000) in ai.ts
    private const ZAI_MODELS = [
        'normal' => 'glm-4-flash',
        'standard' => 'glm-4-plus',
        'premium' => 'glm-4-plus',
    ];

    /** @return array<string, mixed> the 'ai' settings (openrouterKey + models). */
    public static function settings(): array
    {
        $ai = Settings::get('ai', Settings::aiDefaults());

        return is_array($ai) ? $ai : Settings::aiDefaults();
    }

    /** Port of modelForMode(). */
    public static function modelForMode(array $ai, string $mode, bool $writer = false): string
    {
        $defaults = Settings::aiDefaults();
        if ($writer) {
            $key = $mode === 'normal' ? 'standard' : $mode;
            $models = is_array($ai['writerModels'] ?? null) ? $ai['writerModels'] : [];

            return (string) ($models[$key] ?? $defaults['writerModels']['standard']);
        }
        $models = is_array($ai['models'] ?? null) ? $ai['models'] : [];

        return (string) ($models[$mode] ?? $defaults['models']['standard']);
    }

    /**
     * Port of openRouterChat(). Returns the assistant text content.
     *
     * @throws \RuntimeException on HTTP/empty-completion errors
     */
    public static function openRouterChat(array $ai, array $args, string $model): string
    {
        $res = Http::withHeaders([
            'Authorization' => 'Bearer ' . (string) ($ai['openrouterKey'] ?? ''),
            'Content-Type' => 'application/json',
            'HTTP-Referer' => (string) (config('app.url') ?: 'https://adaudit.app'),
            'X-Title' => 'Audit Form',
        ])
            ->timeout(self::TIMEOUT_SECONDS)
            ->connectTimeout(15)
            ->post(self::ENDPOINT, [
                'model' => $model,
                'max_tokens' => (int) ($args['maxTokens'] ?? 8000),
                'temperature' => (float) ($args['temperature'] ?? 0.4),
                'messages' => [
                    ['role' => 'system', 'content' => (string) $args['system']],
                    ['role' => 'user', 'content' => (string) $args['user']],
                ],
            ]);

        if (! $res->successful()) {
            $text = mb_substr($res->body(), 0, 300);

            throw new \RuntimeException("OpenRouter error {$res->status()}: {$text}");
        }

        $data = $res->json();
        $content = $data['choices'][0]['message']['content'] ?? null;
        if (! is_string($content) || $content === '') {
            throw new \RuntimeException('Empty completion from OpenRouter');
        }

        return $content;
    }

    /**
     * Port of llmComplete(): { text, provider, model }.
     * The z-ai fallback is intentionally dropped - an OpenRouter key is required.
     */
    public static function chat(array $args): array
    {
        $ai = self::settings();
        $mode = (string) ($args['mode'] ?? 'standard');
        $writer = (bool) ($args['writer'] ?? false);
        $model = self::modelForMode($ai, $mode, $writer);

        $key = trim((string) ($ai['openrouterKey'] ?? ''));
        if ($key !== '' && mb_strlen($key) > 10) {
            return [
                'text' => self::openRouterChat($ai, $args, $model),
                'provider' => 'openrouter',
                'model' => $model,
            ];
        }

        throw new \RuntimeException('No OpenRouter API key configured. Add one in the admin settings.');
    }

    /**
     * Port of llmJson(): runs the completion and robustly extracts the first
     * balanced JSON object. Retries once on parse failure.
     *
     * @return array{data: mixed, provider: string, model: string}
     * @throws \Throwable
     */
    public static function json(array $args): array
    {
        $lastErr = null;
        for ($attempt = 0; $attempt < 2; $attempt++) {
            try {
                $callArgs = $args;
                if ($attempt === 1) {
                    $callArgs['system'] = $args['system']
                        . "\n\nCRITICAL: your previous reply was not parseable JSON. Return ONLY the raw JSON object this time, nothing else.";
                }
                $res = self::chat($callArgs);
                $data = self::extractJson($res['text']);
                if ($data !== null) {
                    return ['data' => $data, 'provider' => $res['provider'], 'model' => $res['model']];
                }
                throw new \RuntimeException('JSON extraction failed');
            } catch (\Throwable $e) {
                $lastErr = $e;
            }
        }

        throw $lastErr ?? new \RuntimeException('AI request failed');
    }

    /**
     * Port of extractJson(): finds the first balanced {...} block (string aware)
     * and decodes it. Returns null when nothing parseable exists.
     */
    public static function extractJson(?string $text): mixed
    {
        if (! $text) {
            return null;
        }
        $t = trim($text);
        $t = preg_replace('/^```(?:json)?\s*/i', '', $t) ?? $t;
        $t = preg_replace('/```\s*$/i', '', $t) ?? $t;

        $start = strpos($t, '{');
        if ($start === false) {
            return null;
        }

        $depth = 0;
        $inStr = false;
        $esc = false;
        $end = -1;
        $len = strlen($t);
        for ($i = $start; $i < $len; $i++) {
            $ch = $t[$i];
            if ($esc) {
                $esc = false;
                continue;
            }
            if ($ch === '\\') {
                $esc = true;
                continue;
            }
            if ($ch === '"') {
                $inStr = ! $inStr;
                continue;
            }
            if ($inStr) {
                continue;
            }
            if ($ch === '{') {
                $depth++;
            } elseif ($ch === '}') {
                $depth--;
                if ($depth === 0) {
                    $end = $i;
                    break;
                }
            }
        }
        if ($end === -1) {
            return null;
        }

        try {
            $decoded = json_decode(substr($t, $start, $end - $start + 1), true, 512);

            // json_decode(null) style failures return null - same contract as the TS port.
            return $decoded;
        } catch (\Throwable $e) {
            Log::warning('extractJson decode failed: ' . $e->getMessage());

            return null;
        }
    }
}
