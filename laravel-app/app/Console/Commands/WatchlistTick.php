<?php

namespace App\Console\Commands;

use App\Services\Activity;
use App\Services\Digest;
use App\Services\Watchlist;
use Illuminate\Console\Command;

class WatchlistTick extends Command
{
    /**
     * Usage: php artisan watchlist:tick
     * Scheduled in routes/console.php (everyTenMinutes). Hostinger cron:
     * every 10-15 min `php artisan schedule:run` (or this command directly).
     */
    protected $signature = 'watchlist:tick';

    protected $description = 'Run due monitored audits (watchlist scheduler tick)';

    public function handle(): int
    {
        $result = Watchlist::tickWatchlist([]);

        $this->info("watchlist tick: ran={$result['ran']} skipped={$result['skipped']} checked={$result['checked']}");

        // Weekly digest rides on the automation tick; failures are non-fatal
        // (same behaviour as the keyed /api/watchlist/tick automation path).
        try {
            if (class_exists(Digest::class) && method_exists(Digest::class, 'maybeSendDigests')) {
                $digest = Digest::maybeSendDigests();
                if (($digest['sent'] ?? 0) > 0) {
                    Activity::log([
                        'action' => 'DIGEST_SENT',
                        'actorEmail' => 'automation',
                        'detail' => "{$digest['sent']} monitoring digest email(s) sent",
                    ]);
                    $this->info("digest: sent={$digest['sent']}");
                }
            }
        } catch (\Throwable $e) {
            $this->warn('digest skipped: ' . $e->getMessage());
        }

        return self::SUCCESS;
    }
}
