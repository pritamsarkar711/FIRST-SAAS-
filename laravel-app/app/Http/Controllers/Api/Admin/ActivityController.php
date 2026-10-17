<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Port of src/app/api/admin/activity/route.ts (1:1): grouped action filters,
 * search across actor/detail/ip, 50 rows per page.
 */
class ActivityController extends Controller
{
    /** @var array<string, string[]> */
    private const GROUPS = [
        'auth' => ['AUTH_LOGIN', 'AUTH_LOGIN_FAILED', 'AUTH_2FA_CHALLENGE', 'AUTH_REGISTER', 'AUTH_LOGOUT', 'AUTH_PASSWORD_CHANGE', 'AUTH_2FA_ENABLE', 'AUTH_2FA_DISABLE', 'ADMIN_LOGIN', 'API_KEY_CREATE', 'API_KEY_REVOKE'],
        'audits' => ['AUDIT_START', 'AUDIT_BATCH_START', 'AUDIT_DELETE', 'AUDIT_SHARE', 'API_AUDIT_START'],
        'monitoring' => ['WATCH_ADD', 'WATCH_UPDATE', 'WATCH_REMOVE', 'WATCH_RUN', 'DIGEST_SENT', 'DIGEST_SKIP'],
        'tools' => ['WRITER_START', 'INDEXER_SUBMIT', 'TOOL_SITECHECK'],
        'billing' => ['CHECKOUT_SUBMIT', 'STRIPE_VERIFY', 'STRIPE_MISMATCH', 'PAYPAL_VERIFY', 'PAYPAL_MISMATCH', 'SSLCZ_VERIFY', 'SSLCZ_MISMATCH', 'PAYMENT_APPROVE', 'PAYMENT_REJECT'],
        'affiliate' => ['WITHDRAW_REQUEST', 'WITHDRAW_APPROVE', 'WITHDRAW_REJECT', 'WITHDRAW_COMPLETE'],
        'users' => ['USER_CREDITS_ADJUST', 'USER_SUSPEND', 'USER_UNSUSPEND', 'USER_DELETE', 'USER_ROLE_CHANGE'],
        'admin' => ['PLAN_SAVE', 'GATEWAY_SAVE', 'SETTINGS_SAVE', 'BLOG_PUBLISH', 'ADMIN_EXPORT', 'SMTP_TEST'],
    ];

    public function index(Request $request): JsonResponse
    {
        $group = (string) ($request->query('group') ?: 'all');
        $q = trim(mb_strtolower((string) $request->query('q', '')));
        $page = max(1, (int) ($request->query('page') ?: 1));
        $perPage = 50;

        $actions = self::GROUPS[$group] ?? null;

        $query = ActivityLog::query();
        if ($actions !== null) {
            $query->whereIn('action', $actions);
        }
        if ($q !== '') {
            $query->where(function ($w) use ($q) {
                $w->where('actorEmail', 'like', "%{$q}%")
                    ->orWhere('detail', 'like', "%{$q}%")
                    ->orWhere('ip', 'like', "%{$q}%");
            });
        }

        $total = (clone $query)->count();
        $rows = $query->orderByDesc('createdAt')
            ->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get();

        return response()->json([
            'rows' => $rows,
            'total' => $total,
            'page' => $page,
            'perPage' => $perPage,
            'pages' => max(1, (int) ceil($total / $perPage)),
        ]);
    }
}
