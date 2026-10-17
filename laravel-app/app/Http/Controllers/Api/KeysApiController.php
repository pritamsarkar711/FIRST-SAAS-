<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApiKey;
use App\Models\ApiKeyUsage;
use App\Services\Activity;
use App\Services\Credits;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * Port of src/app/api/keys/route.ts (GET index, POST store with
 * create/setCap/revoke actions). destroy() adds the DELETE /api/keys revoke
 * endpoint from routes/web.php with the same revoke semantics.
 */
class KeysApiController extends Controller
{
    private const MAX_ACTIVE_KEYS = 5;

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $keys = ApiKey::where('userId', $user->id)
            ->orderBy('createdAt', 'desc')
            ->get(['id', 'name', 'prefix', 'lastUsedAt', 'requestCount', 'dailyCap', 'revokedAt', 'createdAt']);

        // 14-day usage series (UTC days, gaps included) rolled up per key so the UI can
        // show both the combined chart and a per-key breakdown.
        $sinceDay = now()->utc()->subDays(13)->toDateString();
        $usage = ApiKeyUsage::whereHas('key', fn ($q) => $q->where('userId', $user->id))
            ->where('day', '>=', $sinceDay)
            ->get(['keyId', 'day', 'count']);

        $byDay = [];
        $byKeyDay = [];
        foreach ($usage as $row) {
            $byDay[$row->day] = ($byDay[$row->day] ?? 0) + (int) $row->count;
            $byKeyDay[$row->keyId . '|' . $row->day] = (int) $row->count;
        }

        $days = [];
        for ($i = 13; $i >= 0; $i--) {
            $d = now()->utc()->subDays($i)->toDateString();
            $days[] = ['day' => $d, 'count' => $byDay[$d] ?? 0];
        }

        $perKey = [];
        foreach ($keys as $k) {
            $series = [];
            foreach ($days as $d) {
                $series[] = ['day' => $d['day'], 'count' => $byKeyDay[$k->id . '|' . $d['day']] ?? 0];
            }
            $perKey[$k->id] = $series;
        }

        return response()->json([
            'keys' => $keys,
            'maxActive' => self::MAX_ACTIVE_KEYS,
            'usage' => $days,
            'perKey' => $perKey,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Please sign in first.'], 401);
        }
        if ($user->status === 'SUSPENDED') {
            return response()->json(['error' => 'This account is suspended.'], 403);
        }
        $ip = Credits::clientIp($request);
        if (! Credits::rateLimit('keys:' . $ip, 10, 10 * 60000)['ok']) {
            return response()->json(['error' => 'Too many requests. Try again in a few minutes.'], 429);
        }

        $body = $request->json()->all();
        if (! is_array($body)) {
            $body = [];
        }
        $action = $body['action'] ?? null;

        if ($action === 'create') {
            // z.object({ action: "create", name: trim 2..40, dailyCap: coerce int 1..10000 nullable optional })
            $validator = Validator::make($body, [
                'name' => ['required', 'string', 'min:2', 'max:40'],
                'dailyCap' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:10000'],
            ]);
            if ($validator->fails()) {
                return response()->json(['error' => 'Give the key a short name (2 to 40 characters).'], 400);
            }
            $data = $validator->validated();
            $data['name'] = trim($data['name']);

            $activeCount = ApiKey::where('userId', $user->id)->whereNull('revokedAt')->count();
            if ($activeCount >= self::MAX_ACTIVE_KEYS) {
                return response()->json([
                    'error' => 'You already have ' . self::MAX_ACTIVE_KEYS . ' active keys. Revoke one before creating another.',
                ], 400);
            }

            $raw = $this->createRawApiKey();
            $key = ApiKey::create([
                'userId' => $user->id,
                'name' => $data['name'],
                'prefix' => $this->keyPrefixOf($raw),
                'keyHash' => $this->hashApiKey($raw),
                'dailyCap' => $data['dailyCap'] ?? null,
            ]);

            Activity::log([
                'action' => 'API_KEY_CREATE',
                'actorEmail' => $user->email,
                'userId' => $user->id,
                'detail' => $data['name'] . ' · ' . $key->prefix,
                'ip' => $ip,
            ]);

            // The raw key is returned exactly once. The database only keeps the hash.
            return response()->json([
                'ok' => true,
                'key' => [
                    'id' => $key->id,
                    'name' => $key->name,
                    'prefix' => $key->prefix,
                    'createdAt' => $key->createdAt?->toISOString(),
                ],
                'secret' => $raw,
            ]);
        }

        if ($action === 'setCap') {
            $validator = Validator::make($body, [
                'id' => ['required', 'string', 'min:1', 'max:64'],
                'dailyCap' => ['present', 'nullable', 'integer', 'min:1', 'max:10000'],
            ]);
            if ($validator->fails()) {
                return response()->json(['error' => 'Cap must be between 1 and 10,000 requests per day, or empty for unlimited.'], 400);
            }
            $data = $validator->validated();

            $key = ApiKey::where('id', $data['id'])->where('userId', $user->id)->first();
            if (! $key) {
                return response()->json(['error' => 'Key not found.'], 404);
            }

            $key->forceFill(['dailyCap' => $data['dailyCap']])->save();
            Activity::log([
                'action' => 'API_KEY_UPDATE',
                'actorEmail' => $user->email,
                'userId' => $user->id,
                'detail' => $key->name . ' · daily cap ' . ($data['dailyCap'] === null ? 'removed (unlimited)' : 'set to ' . $data['dailyCap'] . '/day'),
                'ip' => $ip,
            ]);

            return response()->json(['ok' => true]);
        }

        if ($action === 'revoke') {
            $validator = Validator::make($body, [
                'id' => ['required', 'string', 'min:1', 'max:64'],
            ]);
            if ($validator->fails()) {
                return response()->json(['error' => 'Missing key id.'], 400);
            }
            $data = $validator->validated();

            $key = ApiKey::where('id', $data['id'])->where('userId', $user->id)->first();
            if (! $key) {
                return response()->json(['error' => 'Key not found.'], 404);
            }
            if ($key->revokedAt) {
                return response()->json(['ok' => true]);
            }

            $key->forceFill(['revokedAt' => now()])->save();
            Activity::log([
                'action' => 'API_KEY_REVOKE',
                'actorEmail' => $user->email,
                'userId' => $user->id,
                'detail' => $key->name . ' · ' . $key->prefix,
                'ip' => $ip,
            ]);

            return response()->json(['ok' => true]);
        }

        return response()->json(['error' => 'Unknown action.'], 400);
    }

    /** DELETE /api/keys — revoke a key by id (same flow as the revoke action). */
    public function destroy(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Please sign in first.'], 401);
        }
        $ip = Credits::clientIp($request);

        $id = $request->json('id') ?? $request->query('id');
        $validator = Validator::make(['id' => $id], [
            'id' => ['required', 'string', 'min:1', 'max:64'],
        ]);
        if ($validator->fails()) {
            return response()->json(['error' => 'Missing key id.'], 400);
        }
        $id = $validator->validated()['id'];

        $key = ApiKey::where('id', $id)->where('userId', $user->id)->first();
        if (! $key) {
            return response()->json(['error' => 'Key not found.'], 404);
        }
        if ($key->revokedAt) {
            return response()->json(['ok' => true]);
        }

        $key->forceFill(['revokedAt' => now()])->save();
        Activity::log([
            'action' => 'API_KEY_REVOKE',
            'actorEmail' => $user->email,
            'userId' => $user->id,
            'detail' => $key->name . ' · ' . $key->prefix,
            'ip' => $ip,
        ]);

        return response()->json(['ok' => true]);
    }

    // ---------- key helpers (port of src/lib/api-keys.ts) ----------

    /** ak_ + 24 random bytes as base64url (32 chars). */
    private function createRawApiKey(): string
    {
        return 'ak_' . rtrim(strtr(base64_encode(random_bytes(24)), '+/', '-_'), '=');
    }

    private function hashApiKey(string $raw): string
    {
        return hash('sha256', trim($raw));
    }

    private function keyPrefixOf(string $raw): string
    {
        return substr($raw, 0, 11);
    }
}
