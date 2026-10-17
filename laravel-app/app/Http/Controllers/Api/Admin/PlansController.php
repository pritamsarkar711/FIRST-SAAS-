<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Plan;
use App\Services\Activity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * Port of src/app/api/admin/plans/route.ts.
 * GET / POST / DELETE are 1:1. PATCH (declared by the routes/web.php
 * contract, not present in the original) saves with the same payload.
 */
class PlansController extends Controller
{
    public function index(): JsonResponse
    {
        $plans = Plan::orderBy('sortOrder')->get();

        return response()->json(['plans' => $plans]);
    }

    public function store(Request $request): JsonResponse
    {
        return $this->save($request);
    }

    /** PATCH alias - same payload and behaviour as POST. */
    public function update(Request $request): JsonResponse
    {
        return $this->save($request);
    }

    private function save(Request $request): JsonResponse
    {
        /** @var \App\Models\User $admin */
        $admin = $request->user();

        $data = $request->json()->all();
        if (! is_array($data)) {
            return response()->json(['error' => 'Invalid plan data.'], 400);
        }

        $validator = Validator::make($data, [
            'id' => ['nullable', 'string', 'min:1'],
            'name' => ['required', 'string', 'min:2', 'max:40'],
            'slug' => ['required', 'string', 'min:2', 'max:40', 'regex:/^[a-z0-9-]+$/'],
            'description' => ['nullable', 'string', 'max:200'],
            'priceUsd' => ['required', 'numeric', 'min:0', 'max:100000'],
            'credits' => ['required', 'integer', 'min:0', 'max:1000000'],
            'monitorLimit' => ['nullable', 'integer', 'min:0', 'max:500'],
            'featuresRaw' => ['nullable', 'string', 'max:2000'],
            'badge' => ['nullable', 'string', 'max:30'],
            'active' => ['required', 'boolean'],
            'sortOrder' => ['nullable', 'integer', 'min:0', 'max:99'],
        ]);

        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()->first() ?: 'Invalid plan data.'], 400);
        }

        $d = $validator->validated();
        $features = json_encode(
            array_values(array_filter(array_map('trim', explode("\n", (string) ($d['featuresRaw'] ?? ''))), fn ($f) => $f !== ''))
        );
        if ($features === false) {
            $features = '[]';
        }

        $payload = [
            'name' => $d['name'],
            'slug' => $d['slug'],
            'description' => ($d['description'] ?? '') !== '' ? $d['description'] : null,
            'priceUsd' => (float) $d['priceUsd'],
            'credits' => (int) $d['credits'],
            'monitorLimit' => isset($d['monitorLimit']) && is_numeric($d['monitorLimit']) ? (int) $d['monitorLimit'] : null,
            'features' => $features,
            'badge' => ($d['badge'] ?? '') !== '' ? $d['badge'] : null,
            'active' => (bool) $d['active'],
            'sortOrder' => (int) ($d['sortOrder'] ?? 0),
        ];

        if (! empty($d['id'])) {
            $existing = Plan::find($d['id']);
            if (! $existing) {
                return response()->json(['error' => 'Plan not found.'], 404);
            }
            $existing->fill($payload)->save();
            Activity::log([
                'action' => 'PLAN_SAVE',
                'actorEmail' => $admin->email,
                'detail' => "Updated plan {$d['name']} (\${$d['priceUsd']} / {$d['credits']} credits)",
            ]);
        } else {
            Plan::create($payload);
            Activity::log([
                'action' => 'PLAN_SAVE',
                'actorEmail' => $admin->email,
                'detail' => "Created plan {$d['name']} (\${$d['priceUsd']} / {$d['credits']} credits)",
            ]);
        }

        return response()->json(['ok' => true]);
    }

    public function destroy(Request $request): JsonResponse
    {
        $id = (string) $request->query('id', '');
        if ($id === '') {
            return response()->json(['error' => 'Plan id required.'], 400);
        }

        $inUse = Payment::where('planId', $id)->count();
        if ($inUse > 0) {
            Plan::whereKey($id)->update(['active' => false]);

            return response()->json(['ok' => true, 'message' => 'Plan has payments, so it was deactivated instead of deleted.']);
        }

        Plan::whereKey($id)->delete();

        return response()->json(['ok' => true]);
    }
}
