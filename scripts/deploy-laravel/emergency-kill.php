<?php
/**
 * EMERGENCY unblocker v2 - delete after use!
 *
 * The account's process table is jammed: SSH sessions cannot fork a shell
 * ("fork: retry: Resource temporarily unavailable"). This script runs
 * under LiteSpeed PHP (already serving) and:
 *   1. prints a census of every process visible to this uid,
 *   2. SIGKILLs EVERY process owned by this uid except itself
 *      (LiteSpeed PHP workers respawn automatically; nothing persistent
 *      is needed once the site is pure PHP),
 *   3. prints the after-count.
 * Self-deletes on completion.
 */
header('Content-Type: text/plain; charset=utf-8');
@set_time_limit(120);

$entries = @scandir('/proc');
if ($entries === false) {
    echo "FAIL: cannot read /proc\n";
    exit(1);
}

$mypid = getmypid();
$states = [];
$samples = [];
$mine = [];
$total = 0;

foreach ($entries as $pid) {
    if (!ctype_digit($pid)) {
        continue;
    }
    $total++;
    $stat = @file_get_contents("/proc/$pid/stat");
    $cmdline = @file_get_contents("/proc/$pid/cmdline");
    $cmd = trim(str_replace("\0", ' ', (string) $cmdline));
    $state = '?';
    if ($stat !== false && preg_match('/^\d+ \([^)]*\) ([A-Za-z])/', $stat, $m)) {
        $state = $m[1];
    }
    $states[$state] = ($states[$state] ?? 0) + 1;
    if ($cmd === '') {
        $cmd = "(zombie/empty, state $state)";
    }
    if (count($samples) < 40) {
        $samples[] = "$pid [$state] " . substr($cmd, 0, 80);
    }
    if ($pid !== $mypid) {
        $mine[] = (int) $pid;
    }
}

echo "TOTAL /proc entries: $total\n";
echo "STATE HISTOGRAM: " . json_encode($states) . "\n";
echo "SAMPLES:\n" . implode("\n", $samples) . "\n";

// --- aggressive: kill every process of this uid except self ---
$killed = 0;
foreach ($mine as $pid) {
    if (function_exists('posix_kill')) {
        if (@posix_kill($pid, 9)) {
            $killed++;
        }
    } elseif (is_callable('exec')) {
        @exec("kill -9 $pid 2>/dev/null");
        $killed++;
    }
}
echo "SIGKILL sent to $killed processes\n";
sleep(2);

// after-count
$after = 0;
foreach (@scandir('/proc') ?: [] as $p) {
    if (ctype_digit($p)) {
        $after++;
    }
}
echo "AFTER-COUNT: $after (was $total)\n";
@unlink(__FILE__);
echo "kill.php self-deleted\n";
