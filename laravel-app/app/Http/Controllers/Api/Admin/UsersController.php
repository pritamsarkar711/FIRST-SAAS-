<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Activity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Port of src/app/api/admin/users/route.ts (1:1).
 * GET  /api/admin/users  -> index
 * POST /api/admin/users  -> store (suspend/activate/credits/role/2fa/delete actions)
 * PATCH is accepted for POST-shaped actions to be method-agnostic; the
 * routes/web.php contract maps PATCH here too.
 */
class UsersController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = trim(mb_strtolower((string) $request->query('q', '')));

        $users = User::query()
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($w) use ($q) {
                    $w->where('email', 'like', "%{$q}%")
                        ->orWhere('name', 'like', "%{$q}%");
                });
            })
            ->orderByDesc('createdAt')
            ->limit(100)
            ->withCount(['audits', 'payments'])
            ->get([
                'id', 'email', 'name', 'role', 'status', 'credits',
                'referralCode', 'createdAt', 'twoFactorEnabled',
            ]);

        return response()->json([
            'users' => $users->map(function (User $u) {
                return [
                    'id' => $u->id,
                    'email' => $u->email,
                    'name' => $u->name,
                    'role' => $u->role,
                    'status' => $u->status,
                    'credits' => (int) $u->credits,
                    'referralCode' => $u->referralCode,
                    'createdAt' => $u->createdAt,
                    'twoFactorEnabled' => (bool) $u->twoFactorEnabled,
                    '_count' => [
                        'audits' => (int) $u->audits_count,
                        'payments' => (int) $u->payments_count,
                    ],
                ];
            }),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();

        $data = $request->json()->all();
        if (! is_array($data)) {
            return response()->json(['error' => 'Invalid action.'], 400);
        }

        $id = (string) ($data['id'] ?? '');
        $action = (string) ($data['action'] ?? '');
        $amount = $data['amount'] ?? null;
        if ($id === '' || ! in_array($action, [
            'suspend', 'activate', 'addCredits', 'setCredits',
            'makeAdmin', 'removeAdmin', 'reset2fa', 'delete',
        ], true) || ($amount !== null && ! is_numeric($amount))) {
            return response()->json(['error' => 'Invalid action.'], 400);
        }
        $amount = $amount === null ? null : (int) $amount;

        $target = User::find($id);
        if (! $target) {
            return response()->json(['error' => 'User not found.'], 404);
        }

        $log = function (string $action, string $detail) use ($admin, $target) {
            Activity::log([
                'action' => $action,
                'actorEmail' => $admin->email,
                'userId' => $target->id,
                'detail' => $detail,
            ]);
        };

        switch ($action) {
            case 'suspend':
                $target->forceFill(['status' => 'SUSPENDED'])->save();
                $log('USER_SUSPEND', $target->email);
                break;
            case 'activate':
                $target->forceFill(['status' => 'ACTIVE'])->save();
                $log('USER_UNSUSPEND', $target->email);
                break;
            case 'addCredits':
                if (! $amount) {
                    return response()->json(['error' => 'Amount required.'], 400);
                }
                $target->increment('credits', $amount);
                $log('USER_CREDITS_ADJUST', "{$target->email} +{$amount} credits");
                break;
            case 'setCredits':
                if ($amount === null || $amount < 0) {
                    return response()->json(['error' => 'Amount required.'], 400);
                }
                $oldCredits = (int) $target->credits;
                $target->forceFill(['credits' => $amount])->save();
                $log('USER_CREDITS_ADJUST', "{$target->email} set to {$amount} credits (was {$oldCredits})");
                break;
            case 'makeAdmin':
                $target->forceFill(['role' => 'ADMIN'])->save();
                $log('USER_ROLE_CHANGE', "{$target->email} promoted to admin");
                break;
            case 'removeAdmin':
                if ($target->id === $admin->id) {
                    return response()->json(['error' => 'You cannot remove your own admin role.'], 400);
                }
                $target->forceFill(['role' => 'USER'])->save();
                $log('USER_ROLE_CHANGE', "{$target->email} demoted to user");
                break;
            case 'reset2fa':
                $target->forceFill(['twoFactorEnabled' => false, 'twoFactorSecret' => null])->save();
                $log('AUTH_2FA_DISABLE', "Admin reset 2FA for {$target->email}");
                break;
            case 'delete':
                if ($target->id === $admin->id) {
                    return response()->json(['error' => 'You cannot delete your own account.'], 400);
                }
                $target->delete();
                $log('USER_DELETE', $target->email);
                break;
        }

        return response()->json(['ok' => true]);
    }

    /**
     * PATCH /api/admin/users - same action payload as POST (route contract).
     */
    public function update(Request $request): JsonResponse
    {
        return $this->store($request);
    }
}
