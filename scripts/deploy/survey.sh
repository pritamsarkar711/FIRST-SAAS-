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
  echo "  all supervisor lines (exit codes!):"
  grep "\[supervisor\]" "$HOME/auditform/app.log" 2>/dev/null | tail -6 | sed 's/^/    /'
  echo "  last 30 app log lines:"
  tail -n 30 "$HOME/auditform/app.log" 2>/dev/null | sed 's/^/    /'
  echo "  LIVE unix-socket probe:"
  if [ -S "$HOME/auditform/app.sock" ]; then
    echo "    socket exists: $(curl -s --unix-socket "$HOME/auditform/app.sock" --max-time 20 -o /dev/null -w '%{http_code}' http://localhost/ 2>/dev/null || echo 000)"
  else
    echo "    socket file MISSING"
  fi
  APP_PID=$(pgrep -f "auditform/app/server.js" | head -1)
  echo "  app process state (pid=$APP_PID):"
  [ -n "$APP_PID" ] && ps -o pid,stat,rss,vsz,nlwp,etime -p "$APP_PID" 2>/dev/null | sed 's/^/    /'
  [ -n "$APP_PID" ] && grep -iE "threads|vmrss" /proc/"$APP_PID"/status 2>/dev/null | sed 's/^/    /'
  echo "  port 3000 (hex 0BB8) in /proc/net/tcp*:"
  grep -i ":0BB8" /proc/net/tcp /proc/net/tcp6 2>/dev/null | sed 's/^/    /' || echo "    (no LISTEN entry for port 3000)"
  echo "  exact connect error:"
  curl -sv --max-time 6 http://127.0.0.1:3000/ 2>&1 | grep -E "Failed|refused|timed out|Connected|HTTP" | head -4 | sed 's/^/    /'
  echo "  trivial bun TCP bind test (port 3999):"
  (cd "$HOME/auditform/app" && timeout 8 bun -e "Bun.serve({hostname:'127.0.0.1',port:3999,fetch:()=>new Response('bind-ok')}); setTimeout(()=>process.exit(0),3000);" >/tmp/bindtest.log 2>&1 & sleep 2; BT=$(curl -s --max-time 4 http://127.0.0.1:3999/ 2>/dev/null || echo FAIL); echo "    bind test result: $BT"; wait 2>/dev/null) | head -3
  cat /tmp/bindtest.log 2>/dev/null | head -3 | sed 's/^/    /'
  echo "  bind 0.0.0.0:3999 + curl via PUBLIC IP (escape hatch test):"
  (cd "$HOME/auditform/app" && timeout 9 bun -e "Bun.serve({hostname:'0.0.0.0',port:3999,fetch:()=>new Response('bind-public-ok')}); setTimeout(()=>process.exit(0),4000);" >/tmp/bindpub.log 2>&1 & sleep 2; BP=$(curl -s --max-time 5 "http://${PUBLIC_IP:-127.0.0.1}:3999/" 2>/dev/null || echo FAIL); echo "    public-IP bind result: $BP"; wait 2>/dev/null) | head -3
  cat /tmp/bindpub.log 2>/dev/null | head -3 | sed 's/^/    /'
  echo "  bind 0.0.0.0:3999 + curl via 127.0.0.1:"
  (cd "$HOME/auditform/app" && timeout 9 bun -e "Bun.serve({hostname:'0.0.0.0',port:3999,fetch:()=>new Response('bind-any-loop-ok')}); setTimeout(()=>process.exit(0),4000);" >/tmp/bindany.log 2>&1 & sleep 2; BA=$(curl -s --max-time 4 http://127.0.0.1:3999/ 2>/dev/null || echo FAIL); echo "    any-bind loopback result: $BA"; wait 2>/dev/null) | head -3
  echo "  managed node binaries (hPanel Node app runtime) - DEEP search:"
  find /opt/alt /opt/plesk /usr/local /opt -maxdepth 7 -name "node" -type f 2>/dev/null | grep -vE "modules|\.cache" | head -8 | sed 's/^/    /'
  ls -d /opt/alt/* 2>/dev/null | head -10 | sed 's/^/    /'
  ls -d "$HOME"/nodevenv* 2>/dev/null | head -3 | sed 's/^/    /'
  echo "  bun memory + repeated-request abort test (unix socket, 2 requests 6s apart):"
  T=$(mktemp -d)
  (cd "$HOME/auditform/app" && timeout 20 bun -e "
const http=require('http');
const s=http.createServer((q,r)=>{r.end('alive')});
s.listen({path:'$T/rep.sock'});
setInterval(()=>{},1000);
setTimeout(()=>process.exit(0),15000);" >/tmp/rep.log 2>&1 & sleep 2; R1=$(curl -s --unix-socket "$T/rep.sock" --max-time 4 http://localhost/ 2>/dev/null || echo FAIL); sleep 6; R2=$(curl -s --unix-socket "$T/rep.sock" --max-time 4 http://localhost/ 2>/dev/null || echo FAIL); sleep 6; R3=$(curl -s --unix-socket "$T/rep.sock" --max-time 4 http://localhost/ 2>/dev/null || echo FAIL); echo "    req1=$R1 req2=$R2 req3=$R3"; wait 2>/dev/null) | head -3
  echo "    rep-test stderr:"; head -5 /tmp/rep.log 2>/dev/null | sed 's/^/      /'
  rm -rf "$T"
  echo "  UNIX-socket capability (the no-TCP path):"
  T=$(mktemp -d)
  (cd "$HOME/auditform/app" && timeout 8 bun -e "
const http=require('http');
const s=http.createServer((q,r)=>{r.end('unix-node-ok')});
s.listen('$T/t1.sock','127.0.0.1');
setTimeout(()=>process.exit(0),4000);" >/tmp/unix1.log 2>&1 & sleep 2; U1=$(curl -s --unix-socket "$T/t1.sock" --max-time 4 http://localhost/ 2>/dev/null || echo FAIL); echo "    bun node-style listen(path,host): $U1"; wait 2>/dev/null) | head -2
  head -3 /tmp/unix1.log 2>/dev/null | sed 's/^/    /'
  (cd "$HOME/auditform/app" && timeout 8 bun -e "
const http=require('http');
const s=http.createServer((q,r)=>{r.end('unix-obj-ok')});
s.listen({path:'$T/t2.sock'});
setTimeout(()=>process.exit(0),4000);" >/tmp/unix2.log 2>&1 & sleep 2; U2=$(curl -s --unix-socket "$T/t2.sock" --max-time 4 http://localhost/ 2>/dev/null || echo FAIL); echo "    bun listen({path}): $U2"; wait 2>/dev/null) | head -2
  head -3 /tmp/unix2.log 2>/dev/null | sed 's/^/    /'
  php -r '
$c = curl_init("http://localhost/");
curl_setopt($c, CURLOPT_UNIX_SOCKET_PATH, "'"$T"'/t1.sock");
curl_setopt($c, CURLOPT_RETURNTRANSFER, true);
curl_setopt($c, CURLOPT_HEADER, true);
curl_setopt($c, CURLOPT_TIMEOUT, 4);
$r = curl_exec($c);
echo $r === false ? ("    php unix curl: FAIL errno ".curl_errno($c)."\n") : "    php unix curl: OK\n";
' 2>&1 | head -2
  rm -rf "$T"
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
