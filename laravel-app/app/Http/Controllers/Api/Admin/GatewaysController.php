<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\GatewayConfig;
use App\Services\Activity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * Port of src/app/api/admin/gateways/route.ts (POST handler 1:1, exposed
 * through PATCH per the routes/web.php contract).
 */
class GatewaysController extends Controller
{
    public function index(): JsonResponse
    {
        $gateways = GatewayConfig::orderBy('sortOrder')->get();

        return response()->json(['gateways' => $gateways]);
    }

    public function update(Request $request): JsonResponse
    {
        /** @var \App\Models\User $admin */
        $admin = $request->user();

        $data = $request->json()->all();
        if (! is_array($data)) {
            return response()->json(['error' => 'Invalid gateway data.'], 400);
        }

        $validator = Validator::make($data, [
            'id' => ['required', 'string', 'min:1'],
            'enabled' => ['nullable', 'boolean'],
            'mode' => ['nullable', 'in:MANUAL,API'],
            'instructions' => ['nullable', 'string', 'max:1000'],
            'config' => ['nullable', 'string', 'max:4000'],
        ]);
        if ($validator->fails()) {
            return response()->json(['error' => 'Invalid gateway data.'], 400);
        }

        $d = $validator->validated();
        $config = $d['config'] ?? null;
        if ($config !== null) {
            json_decode($config);
            if (json_last_error() !== JSON_ERROR_NONE) {
                return response()->json(['error' => 'Config must be valid JSON (API keys and settings).'], 400);
            }
        }

        $gateway = GatewayConfig::find($d['id']);
        if (! $gateway) {
            return response()->json(['error' => 'Gateway not found.'], 404);
        }

        $changes = [];
        if (array_key_exists('enabled', $d)) {
            $changes['enabled'] = (bool) $d['enabled'];
        }
        if (array_key_exists('mode', $d) && $d['mode'] !== null) {
            $changes['mode'] = $d['mode'];
        }
        if (array_key_exists('instructions', $d) && $d['instructions'] !== null) {
            $changes['instructions'] = $d['instructions'];
        }
        if ($config !== null) {
            $changes['config'] = $config;
        }
        $gateway->fill($changes)->save();

        $verb = ($d['enabled'] ?? null) === true ? 'enabled' : (($d['enabled'] ?? null) === false ? 'disabled' : 'updated');
        Activity::log([
            'action' => 'GATEWAY_SAVE',
            'actorEmail' => $admin->email,
            'detail' => $d['id'] . ' · ' . $verb,
        ]);

        return response()->json(['ok' => true]);
    }
}
