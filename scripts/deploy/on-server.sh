#!/usr/bin/env bash
# Runs ON the Hostinger server after the GitHub Actions runner has rsynced
# the standalone build.
#
# ARCHITECTURE (after platform discovery):
#   Hostinger shared refuses ALL tenant TCP connections (loopback included),
#   so a .htaccess [P] proxy to 127.0.0.1:3000 can never work there.
#   Instead the app listens on a UNIX DOMAIN SOCKET (Node treats
#   server.listen("/path.sock") as a unix listener; PORT env passes straight
#   through to it), and LiteSpeed - which serves PHP natively - forwards
#   requests through docroot/index.php (PHP-curl over the unix socket).
#   Static assets (.next/static, public/) are copied into the docroot and
#   served directly by LiteSpeed for speed.
#
# NOTE: Hostinger shared servers ship BUN (/usr/bin/bun) but no node/npm/npx,
# so the app runs with bun (node preferred automatically if present).
set -u
APP="$HOME/auditform/app"
LOG="$HOME/auditform/app.log"
SUP="$HOME/auditform/run-app.sh"
SOCK="$HOME/auditform/app.sock"

# Locate a runtime: prefer real node (fast boot, stable unix sockets, no JSC
# aborts). CloudLinux ships node for hPanel Node apps at /opt/alt/alt-nodejsXX
# (confirmed by survey v6); bun (/usr/bin/bun) is the last-resort fallback.
RUNTIME=""
for c in node /usr/local/bin/node /usr/bin/node "$HOME/bin/node" \
         /opt/alt/alt-nodejs22/root/usr/bin/node \
         /opt/alt/alt-nodejs24/root/usr/bin/node \
         /opt/alt/alt-nodejs20/root/usr/bin/node \
         /opt/alt/alt-nodejs18/root/usr/bin/node \
         bun; do
  if [ -x "$c" ] || command -v "$c" >/dev/null 2>&1; then RUNTIME="$(command -v "$c" 2>/dev/null || echo "$c")"; break; fi
done
[ -n "$RUNTIME" ] || { echo "FATAL: no bun or node runtime found on server"; exit 1; }
case "$RUNTIME" in
  *bun) NODE_FLAGS="" ;;
  *)    NODE_FLAGS="--unhandled-rejections=warn --max-old-space-size=384" ;;
esac
echo "-- runtime: $RUNTIME ($("$RUNTIME" --version 2>&1 | head -1)) flags:[$NODE_FLAGS]"

echo "=== ON-SERVER DEPLOY $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
mkdir -p "$APP"
cd "$APP" || { echo "FATAL: cannot cd $APP"; exit 1; }
echo "-- app dir contents:"
ls -la | head -10

# 1) Environment file (uploaded by CI as .env.production)
if [ -f .env.production ]; then
  mv -f .env.production .env
  chmod 600 .env
  echo "-- .env installed"
fi
[ -f .env ] || { echo "FATAL: .env missing"; exit 1; }

# 2) Rebuild the database schema DETERMINISTICALLY (drop-all then clean init;
#    re-running CREATE TABLE over a partial prior init fails with errno 121).
echo "-- database schema (MySQL): drop-all then clean init --"
set -a; . ./.env; set +a
if command -v mysql >/dev/null 2>&1 && [ -f db-init.sql ] && [ -n "${DB_NAME:-}" ] && [ -n "${DB_USER:-}" ]; then
  M() { MYSQL_PWD="${DB_PASSWORD:-}" mysql -h "${DB_HOST:-localhost}" -u "$DB_USER" "$DB_NAME" "$@"; }
  OBJECTS=$(M -N -e "SHOW FULL TABLES;" 2>/dev/null | awk '{print "`"$1"`"}' | paste -sd, -)
  if [ -n "$OBJECTS" ]; then
    M -e "SET FOREIGN_KEY_CHECKS=0; DROP TABLE IF EXISTS $OBJECTS; SET FOREIGN_KEY_CHECKS=1;" >/dev/null 2>&1 \
      && echo "DB RESET: dropped pre-existing objects" \
      || echo "DB RESET WARN: drop failed (continuing)"
  else
    echo "DB RESET: database already empty"
  fi
  M --force < db-init.sql > /tmp/dbinit.log 2>&1
  REAL_ERRORS=$(grep -iE "error" /tmp/dbinit.log 2>/dev/null | grep -vicE "already exists|duplicate key name" || true)
  TABLE_COUNT=$(M -N -e "SHOW TABLES;" 2>/dev/null | wc -l)
  echo "DB INIT: applied (real errors: ${REAL_ERRORS:-0}, tables now: ${TABLE_COUNT:-0})"
  [ "${REAL_ERRORS:-0}" != "0" ] && grep -iE "error" /tmp/dbinit.log | grep -viE "already exists|duplicate key name" | head -4
else
  echo "DB INIT: SKIPPED (mysql client, db-init.sql or DB creds missing)"
fi

# 2.5) Make pdfkit standard-font resolution ABSOLUTE on the server (bun cannot
#      resolve bare/relative specifiers from anonymous module parents).
PDFKIT_JS="$APP/node_modules/pdfkit/js"
if [ -d "$PDFKIT_JS/standard-fonts" ]; then
  for f in "$PDFKIT_JS/pdfkit.js" "$PDFKIT_JS/pdfkit.node.mjs" "$PDFKIT_JS/pdfkit.browser.mjs"; do
    [ -f "$f" ] && sed -i "s|'pdfkit/js/standard-fonts/|'$PDFKIT_JS/standard-fonts/|g; s|\"pdfkit/js/standard-fonts/|\"$PDFKIT_JS/standard-fonts/|g" "$f"
  done
  grep -rl "pdfkit/js/standard-fonts/" "$APP/.next/server" 2>/dev/null | while read -r f; do
    sed -i "s|'pdfkit/js/standard-fonts/|'$PDFKIT_JS/standard-fonts/|g" "$f"
  done
  echo "-- pdfkit fonts: absolute-path resolution installed"
else
  echo "-- pdfkit fonts: standard-fonts dir missing in standalone (unexpected)"
fi

# 2.6) Teach the standalone server to listen on the UNIX socket.
#      The generated server.js does `parseInt(process.env.PORT, 10) || 3000`,
#      which turns a socket path into NaN -> 3000. Patch it to pass a '/'-prefixed
#      PORT through as a string, and patch start-server.js to use listen({path})
#      for path values (both forms verified working under bun on this server).
if grep -q "const currentPort = parseInt(process.env.PORT, 10) || 3000" "$APP/server.js" 2>/dev/null; then
  sed -i "s#const currentPort = parseInt(process.env.PORT, 10) || 3000#const currentPort = (process.env.PORT \&\& String(process.env.PORT).startsWith('/')) ? process.env.PORT : (parseInt(process.env.PORT, 10) || 3000)#" "$APP/server.js"
  echo "-- server.js: unix-socket PORT passthrough patched"
fi
for SJ in "$APP/node_modules/next/dist/server/lib/start-server.js" "$APP/node_modules/next/dist/esm/server/lib/start-server.js"; do
  if [ -f "$SJ" ] && grep -q "server.listen(port, hostname);" "$SJ"; then
    sed -i "s#server.listen(port, hostname);#server.listen(typeof process.env.PORT === 'string' \&\& process.env.PORT.startsWith('/') ? { path: process.env.PORT } : port, hostname);#g" "$SJ"
    case "$SJ" in
      */dist/esm/*) SJ_LABEL="esm/start-server.js" ;;
      *)            SJ_LABEL="dist/start-server.js" ;;
    esac
    echo "-- $SJ_LABEL: listen({path}) patched"
  fi
done

# 3) Crash-restarting supervisor. The app listens on the UNIX socket; a stale
#    socket file must be removed before every start (EADDRINUSE otherwise).
echo "-- installing supervisor: $SUP --"
cat > "$SUP" <<'SUPERVISOR_EOF'
#!/usr/bin/env bash
# Keeps the Next.js standalone app alive; restarts 3s after any exit.
APP="$HOME/auditform/app"
LOG="$HOME/auditform/app.log"
SOCK="$HOME/auditform/app.sock"
RUNTIME_BIN="$1"; shift
NODE_FLAGS="$*"
cd "$APP" || exit 1
while true; do
  rm -f "$SOCK"
  # shellcheck disable=SC2086
  "$RUNTIME_BIN" $NODE_FLAGS "$APP/server.js" >> "$LOG" 2>&1
  echo "[supervisor] app exited (code=$?) at $(date -u '+%Y-%m-%dT%H:%M:%SZ') - restarting in 3s" >> "$LOG"
  sleep 3
done
SUPERVISOR_EOF
chmod +x "$SUP"

echo "-- restarting app (unix socket: $SOCK) --"
pkill -f "auditform/run-app.sh" 2>/dev/null || true
pkill -f "auditform/app/server.js" 2>/dev/null || true
sleep 1
: > "$LOG"
set -a; . ./.env; set +a
export PORT="$SOCK" NODE_ENV=production
unset HOSTNAME 2>/dev/null || true
setsid nohup bash "$SUP" "$RUNTIME" "$NODE_FLAGS" > /dev/null 2>&1 < /dev/null &

# 4) Health check over the unix socket (bun cold boot can take ~170s)
echo "-- local health check (unix socket):"
OK=000
for i in $(seq 1 26); do
  if [ -S "$SOCK" ]; then
    OK=$(curl -s --unix-socket "$SOCK" -o /dev/null -w "%{http_code}" --max-time 30 "http://localhost/" 2>/dev/null) || OK=000
  else
    OK=000
  fi
  echo "  try $i: $SOCK -> $OK"
  [ "$OK" != "000" ] && break
  sleep 7
done
sleep 2
OK2=$(curl -s --unix-socket "$SOCK" -o /dev/null -w "%{http_code}" --max-time 30 "http://localhost/" 2>/dev/null) || OK2=000
echo "  confirm after settle: -> $OK2"
echo "-- app log tail:"
tail -n 22 "$LOG" 2>/dev/null || true

# 5) Wire the domain: static assets + PHP bridge in the docroot
DOCROOT=$(ls -d "$HOME"/domains/*/public_html 2>/dev/null | head -1)
echo "-- docroot detected: ${DOCROOT:-NONE}"
if [ -n "${DOCROOT:-}" ] && [ -d "$DOCROOT" ]; then
  # 5a) static assets served directly by LiteSpeed
  if [ -d "$APP/.next/static" ]; then
    mkdir -p "$DOCROOT/_next"
    (rsync -a --delete "$APP/.next/static/" "$DOCROOT/_next/static/" 2>/dev/null || cp -r "$APP/.next/static" "$DOCROOT/_next/") \
      && echo "-- .next/static copied into docroot"
  fi
  if [ -d "$APP/public" ]; then
    cp -r "$APP/public/." "$DOCROOT/" 2>/dev/null && echo "-- public assets copied into docroot"
  fi
  # 5b) PHP bridge (unix-socket HTTP proxy)
  if [ -f "$APP/index.php.bridge" ]; then
    sed "s|__APP_SOCK__|$SOCK|g" "$APP/index.php.bridge" > "$DOCROOT/index.php"
    echo "-- index.php bridge installed in $DOCROOT"
  else
    echo "-- WARN: index.php.bridge missing from app bundle"
  fi
  # 5c) .htaccess: real files direct, everything else -> index.php
  if [ -f "$APP/htaccess.php" ]; then
    cp "$APP/htaccess.php" "$DOCROOT/.htaccess"
    echo "-- .htaccess (php bridge routing) installed in $DOCROOT"
  fi
else
  echo "-- no ~/domains/*/public_html found; domain wiring must be done in hPanel"
fi

echo "=== ON-SERVER DEPLOY COMPLETE ==="
