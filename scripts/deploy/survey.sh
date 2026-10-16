#!/usr/bin/env bash
# Read-only survey of the Hostinger shared server. Prints everything the
# deployment needs to know (tools, paths, resources). Safe to run any time.
echo "=== AUDIT FORM - HOSTINGER SERVER SURVEY $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
echo "-- account: $(whoami) @ $(hostname)"
echo "-- pwd: $(pwd)"
echo "-- home listing:"
ls -la ~ 2>/dev/null | head -30
echo
echo "-- domains layout:"
ls -d ~/domains/*/ 2>/dev/null || echo "  (no ~/domains)"
for d in ~/domains/*/; do
  [ -d "$d" ] || continue
  echo "  [$d]"
  ls -la "$d" 2>/dev/null | head -8
done
echo
echo "-- tool availability:"
for c in node npm npx pm2 bun yarn git rsync mysql mysqldump curl wget unzip zip php composer nohup setsid screen tmux crontab sqlite3; do
  if p=$(command -v "$c" 2>/dev/null); then
    v=$("$c" --version 2>&1 | head -1 || true)
    echo "  $c -> $p  ($v)"
  else
    echo "  $c -> MISSING"
  fi
done
echo
echo "-- node in common extra locations:"
ls "$HOME/bin" 2>/dev/null | grep -iE '^node|^npm|^npx|^pm2' || echo "  (none in ~/bin)"
ls /usr/local/bin 2>/dev/null | grep -iE '^node|^npm|^npx|^pm2' || echo "  (none in /usr/local/bin)"
find "$HOME" -maxdepth 3 -name "node" -type f 2>/dev/null | head -5
echo
echo "-- running processes (litespeed/node hints):"
ps aux 2>/dev/null | grep -viE 'grep|ps aux' | grep -iE 'litespeed|lsphp|node|mysqld' | head -8 || echo "  (none visible)"
echo
echo "-- crontab:"
crontab -l 2>&1 | head -12 || true
echo
echo "-- resources:"
df -h "$HOME" 2>/dev/null | tail -2
free -m 2>/dev/null | head -3 || echo "  (free not available)"
echo
echo "-- existing node processes of this user:"
pgrep -af "node" 2>/dev/null | head -6 || echo "  (none)"
echo
echo "-- listening ports of this user:"
ss -tlnp 2>/dev/null | head -10 || netstat -tlnp 2>/dev/null | head -10 || echo "  (ss/netstat not available)"
echo "=== SURVEY COMPLETE ==="
