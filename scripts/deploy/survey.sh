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

echo "-- app dir diagnostics:"
if [ -d "$HOME/auditform/app" ]; then
  echo "  pdfkit standard-fonts files:"
  ls "$HOME/auditform/app/node_modules/pdfkit/js/standard-fonts/" 2>/dev/null | head -6 || echo "    (missing)"
  echo "  pdfkit package.json present: $([ -f "$HOME/auditform/app/node_modules/pdfkit/package.json" ] && echo yes || echo NO)"
  echo "  runtime require test (bun):"
  (cd "$HOME/auditform/app" && bun -e "try{const p=require('pdfkit');console.log('    pdfkit require OK:',typeof p)}catch(e){console.log('    pdfkit require FAIL:',e.message)}" 2>&1 | head -3)
  (cd "$HOME/auditform/app" && bun -e "try{const p=require('@react-pdf/renderer');console.log('    renderer require OK:',typeof p)}catch(e){console.log('    renderer require FAIL:',e.message)}" 2>&1 | head -3)
  echo "  app process running:"; pgrep -af "auditform/app/server.js" | head -2 || echo "    (not running)"
  echo "  last app log lines:"; tail -n 6 "$HOME/auditform/app.log" 2>/dev/null | sed 's/^/    /'
  echo "  DIRECT local health (127.0.0.1:3000):"
  for i in 1 2 3; do
    echo "    try $i: $(curl -s -o /dev/null -w '%{http_code}' --max-time 20 http://127.0.0.1:3000/ 2>/dev/null || echo 000)"
    sleep 2
  done
  echo "  supervisor process:"; pgrep -af "auditform/run-app.sh" | head -2 || echo "    (not running)"
  echo "  supervisor restart markers in log: $(grep -c '\[supervisor\]' "$HOME/auditform/app.log" 2>/dev/null || echo 0)"
else
  echo "  (no ~/auditform/app yet)"
fi
echo
echo "-- LiteSpeed proxy diagnostics:"
DOCROOT=$(ls -d "$HOME"/domains/*/public_html 2>/dev/null | head -1)
if [ -n "$DOCROOT" ] && [ -f "$DOCROOT/.htaccess" ]; then
  echo "  .htaccess in $DOCROOT (first 15 lines):"
  head -n 15 "$DOCROOT/.htaccess" | sed 's/^/    /'
fi
PUBLIC_URL="${PUBLIC_URL:-}"
if [ -n "$PUBLIC_URL" ]; then
  echo "  public URL from THIS server: $(curl -s -o /dev/null -w '%{http_code}' --max-time 25 -L "$PUBLIC_URL" 2>/dev/null || echo 000)"
fi
echo "  ulimits: $(ulimit -a 2>/dev/null | grep -iE 'max memory|virtual memory|open files' | tr '\n' '; ')"
echo "=== SURVEY COMPLETE ==="
