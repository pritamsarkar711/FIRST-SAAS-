<?php
/**
 * EMERGENCY unblocker - delete after use!
 *
 * The legacy Node.js supervisor (crash-loop) left the account's process
 * table exhausted: SSH sessions cannot fork a shell. This script runs
 * under LiteSpeed PHP (already serving) and kills the legacy stack using
 * ONLY syscalls - scandir(/proc) + posix_kill - zero forks needed.
 *
 * Usage: https://<site>/kill.php  (self-deletes on success)
 */
header('Content-Type: text/plain; charset=utf-8');

$patterns = ['auditform', 'run-app', 'app/server.js', 'bun '];
$killed = [];
$me = function_exists('posix_getuid') ? posix_getuid() : -1;

$entries = @scandir('/proc');
if ($entries === false) {
    echo "FAIL: cannot read /proc\n";
    exit(1);
}

foreach ($entries as $pid) {
    if (!ctype_digit($pid)) {
        continue;
    }
    $pid = (int) $pid;
    if ($pid === getmypid()) {
        continue;
    }
    $cmdline = @file_get_contents("/proc/$pid/cmdline");
    if ($cmdline === false || $cmdline === '') {
        continue; // zombie or kernel thread - will be reaped once parent dies
    }
    $cmd = str_replace("\0", ' ', $cmdline);
    $match = false;
    foreach ($patterns as $p) {
        if (stripos($cmd, $p) !== false) {
            $match = true;
            break;
        }
    }
    if (! $match) {
        continue;
    }
    if (function_exists('posix_kill')) {
        if (@posix_kill($pid, 9)) {
            $killed[] = $pid . ': ' . substr($cmd, 0, 70);
        }
    } elseif (is_callable('exec')) {
        @exec("kill -9 $pid 2>/dev/null");
        $killed[] = $pid . ': ' . substr($cmd, 0, 70);
    }
}

echo 'KILLED ' . count($killed) . " legacy processes\n";
echo implode("\n", array_slice($killed, 0, 80)) . "\n";

// self-delete so the backdoor never lingers
@unlink(__FILE__);
echo "kill.php self-deleted\n";
