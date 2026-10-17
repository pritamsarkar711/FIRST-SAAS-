<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Audit;
use App\Models\Payment;
use App\Models\User;
use App\Models\WatchItem;
use App\Services\Activity;
use App\Services\SafeUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Port of src/app/api/export/audits/route.ts, export/domain/route.ts and
 * export/admin/route.ts - CSV downloads streamed with the exact same rows,
 * quoting rules and headers as the original.
 */
class ExportApiController extends Controller
{
    /** GET /api/export/audits - the signed-in user's audit history as CSV. */
    public function audits(Request $request): StreamedResponse|JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $audits = Audit::where('userId', $user->id)
            ->orderByDesc('createdAt')
            ->take(2000)
            ->get(['id', 'domain', 'target', 'mode', 'status', 'probability', 'verdict', 'creditsUsed', 'batchId', 'watchItemId', 'createdAt']);

        $rows = [
            ['Date', 'Domain', 'Network', 'Mode', 'Status', 'Approval probability %', 'Verdict', 'Credits used', 'Batch', 'Scheduled check', 'Report id'],
        ];
        foreach ($audits as $a) {
            $rows[] = [
                $a->createdAt?->toISOString(),
                $a->domain,
                $a->target,
                $a->mode,
                $a->status,
                $a->status === 'DONE' ? $a->probability : null,
                $a->verdict,
                $a->creditsUsed,
                $a->batchId ? 'yes' : 'no',
                $a->watchItemId ? 'yes' : 'no',
                $a->id,
            ];
        }

        Activity::log([
            'action' => 'EXPORT_AUDITS',
            'userId' => (string) $user->id,
            'actorEmail' => (string) $user->email,
            'detail' => $audits->count() . ' rows',
        ]);

        return self::csvResponse('adaudit-history-' . now()->toDateString() . '.csv', $rows);
    }

    /** GET /api/export/domain?domain=... - per-domain score trend CSV. */
    public function domain(Request $request): StreamedResponse|JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $raw = (string) $request->query('domain', '');
        $domain = SafeUrl::normalizeDomain($raw);
        if ($domain === '' || ! preg_match('/^[a-z0-9.-]+\.[a-z]{2,}$/', $domain)) {
            return response()->json(['error' => 'Invalid domain'], 400);
        }

        $audits = Audit::where('userId', $user->id)
            ->whereIn('domain', [$domain, "www.{$domain}"])
            ->orderBy('createdAt')
            ->get(['id', 'domain', 'target', 'mode', 'status', 'probability', 'verdict', 'creditsUsed', 'watchItemId', 'batchId', 'createdAt']);
        if ($audits->isEmpty()) {
            return response()->json(['error' => 'No audits for this domain'], 404);
        }

        // Delta vs the previous completed check, so the sheet reads as a trend
        $prev = null;
        $rows = [
            ['Date', 'Domain', 'Network', 'Mode', 'Status', 'Approval probability %', 'Change vs previous', 'Verdict', 'Credits used', 'Batch', 'Scheduled check', 'Report id'],
        ];
        foreach ($audits as $a) {
            $change = null;
            if ($a->status === 'DONE') {
                $change = $prev === null
                    ? 'first check'
                    : (($a->probability - $prev >= 0 ? '+' : '') . ($a->probability - $prev));
                $prev = $a->probability;
            }
            $rows[] = [
                $a->createdAt?->toISOString(),
                $a->domain,
                $a->target,
                $a->mode,
                $a->status,
                $a->status === 'DONE' ? $a->probability : null,
                $change,
                $a->verdict,
                $a->creditsUsed,
                $a->batchId ? 'yes' : 'no',
                $a->watchItemId ? 'yes' : 'no',
                $a->id,
            ];
        }

        Activity::log([
            'action' => 'EXPORT_AUDITS',
            'userId' => (string) $user->id,
            'actorEmail' => (string) $user->email,
            'detail' => "{$domain} trend, {$audits->count()} rows",
        ]);

        return self::csvResponse('adaudit-trend-' . $domain . '-' . now()->toDateString() . '.csv', $rows);
    }

    /** GET /api/export/admin?type=users|payments|audits|watchlist (admin API). */
    public function admin(Request $request): StreamedResponse|JsonResponse
    {
        $admin = $request->user();
        if (! $admin) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }
        if ($admin->role !== 'ADMIN') {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $type = (string) $request->query('type', 'users');
        $rows = [];
        $name = $type;

        if ($type === 'users') {
            $users = User::orderByDesc('createdAt')->take(5000)
                ->get(['id', 'email', 'name', 'role', 'status', 'credits', 'referralCode', 'twoFactorEnabled', 'createdAt']);
            $rows[] = ['Joined', 'Email', 'Name', 'Role', 'Status', 'Credits', 'Referral code', '2FA enabled'];
            foreach ($users as $u) {
                $rows[] = [
                    $u->createdAt?->toISOString(), $u->email, $u->name, $u->role, $u->status, $u->credits, $u->referralCode,
                    $u->twoFactorEnabled ? 'yes' : 'no',
                ];
            }
        } elseif ($type === 'payments') {
            $payments = Payment::with('user:id,email')->orderByDesc('createdAt')->take(5000)->get();
            $rows[] = ['Created', 'User', 'Plan', 'Amount USD', 'Amount BDT', 'Gateway', 'TrxID', 'Sender', 'Status', 'Note'];
            foreach ($payments as $p) {
                $rows[] = [
                    $p->createdAt?->toISOString(), $p->user?->email, $p->planName,
                    number_format((float) $p->amount, 2, '.', ''),
                    $p->amountBdt !== null ? number_format((float) $p->amountBdt, 2, '.', '') : null,
                    $p->gateway, $p->txId, $p->senderInfo, $p->status, $p->note,
                ];
            }
        } elseif ($type === 'audits') {
            $audits = Audit::with('user:id,email')->orderByDesc('createdAt')->take(5000)->get();
            $rows[] = ['Created', 'User', 'Domain', 'Network', 'Mode', 'Status', 'Probability %', 'Verdict', 'Credits used', 'Scheduled'];
            foreach ($audits as $a) {
                $rows[] = [
                    $a->createdAt?->toISOString(), $a->user?->email, $a->domain, $a->target, $a->mode, $a->status,
                    $a->status === 'DONE' ? $a->probability : null, $a->verdict, $a->creditsUsed, $a->watchItemId ? 'yes' : 'no',
                ];
            }
        } elseif ($type === 'watchlist') {
            $items = WatchItem::with('user:id,email')->orderByDesc('createdAt')->take(5000)->get();
            $name = 'monitors';
            $rows[] = ['Added', 'User', 'Domain', 'Network', 'Mode', 'Interval days', 'Active', 'Checks run', 'Last score', 'Next run'];
            foreach ($items as $w) {
                $rows[] = [
                    $w->createdAt?->toISOString(), $w->user?->email, $w->domain, $w->target, $w->mode, $w->intervalDays,
                    $w->active ? 'yes' : 'no', $w->runs, $w->lastScore, $w->nextRunAt?->toISOString(),
                ];
            }
        } else {
            return response()->json(['error' => 'Unknown export type.'], 400);
        }

        Activity::log([
            'action' => 'ADMIN_EXPORT',
            'actorEmail' => (string) $admin->email,
            'detail' => $name,
        ]);

        return self::csvResponse('adaudit-' . $name . '-' . now()->toDateString() . '.csv', $rows);
    }

    // ---------- CSV helpers (identical rules to the original) ----------

    private static function csvCell(mixed $v): string
    {
        $s = $v === null ? '' : (string) $v;

        return preg_match('/[",\n]/', $s) ? '"' . str_replace('"', '""', $s) . '"' : $s;
    }

    /** Streams the rows as UTF-8 CSV (BOM + CRLF), matching toCsv() exactly. */
    private static function csvResponse(string $filename, array $rows): StreamedResponse
    {
        return response()->streamDownload(function () use ($rows) {
            echo "\u{FEFF}";
            $first = true;
            foreach ($rows as $row) {
                echo ($first ? '' : "\r\n") . implode(',', array_map(self::class . '::csvCell', array_values($row)));
                $first = false;
            }
        }, $filename, [
            'Content-Type' => 'text/csv; charset=utf-8',
            'Cache-Control' => 'no-store',
        ]);
    }
}
