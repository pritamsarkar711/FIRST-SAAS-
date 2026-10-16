#!/usr/bin/env bash
# Runs ON the Hostinger server after the GitHub Actions runner has rsynced
# the standalone build. Writes .env, rebuilds the MySQL schema deterministically,
# starts the app under a crash-restarting supervisor and wires the domain
# docroot through LiteSpeed (.htaccess reverse proxy).
#
# NOTE: Hostinger shared servers ship BUN (/usr/bin/bun) but no node/npm/npx,
# so the app runs with bun (node used automatically if bun is absent).
set -u
APP="$HOME/auditform/app"
LOG="$HOME/auditform/app.log"
SUP="$HOME/auditform/run-app.sh"
PORT=3000

# Locate a runtime: prefer bun, fall back to node in common locations
RUNTIME=""
for c in bun node "$HOME/bin/node" /usr/local/bin/node /usr/bin/node; do
  if command -v "$c" >/dev/null 2>&1; then RUNTIME="$(command -v "$c")"; break; fi
done
[ -n "$RUNTIME" ] || { echo "FATAL: no bun or node runtime found on server"; exit 1; }
case "$RUNTIME" in
  *bun) NODE_FLAGS="" ;;
  *)    NODE_FLAGS="--unhandled-rejections=warn" ;;  # belt & braces: never crash on a stray rejection
esac
echo "-- runtime: $RUNTIME ($("$RUNTIME" --version 2>&1 | head -1)) flags:[$NODE_FLAGS]"

echo "=== ON-SERVER DEPLOY $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
mkdir -p "$APP"
cd "$APP" || { echo "FATAL: cannot cd $APP"; exit 1; }
echo "-- app dir contents:"
ls -la | head -12

# 1) Environment file (uploaded by CI as .env.production)
if [ -f .env.production ]; then
  mv -f .env.production .env
  chmod 600 .env
  echo "-- .env installed"
fi
[ -f .env ] || { echo "FATAL: .env missing"; exit 1; }

# 2) Rebuild the database schema DETERMINISTICALLY.
#    A previous partial init can leave foreign-key constraints behind; re-running
#    CREATE TABLE then fails with errno 121 (duplicate FK name). Dropping every
#    table/view first makes db-init.sql a clean from-empty apply every time.
echo "-- database schema (MySQL): drop-all then clean init --"
set -a; . ./.env; set +a
if command -v mysql >/dev/null 2>&1 && [ -f db-init.sql ] && [ -n "${DB_NAME:-}" ] && [ -n "${DB_USER:-}" ]; then
  M() { MYSQL_PWD="${DB_PASSWORD:-}" mysql -h "${DB_HOST:-localhost}" -u "$DB_USER" "$DB_NAME" "$@"; }
  OBJECTS=$(M -N -e "SHOW FULL TABLES;" 2>/dev/null | awk '{print "`"$1"`"}' | paste -sd, -)
  if [ -n "$OBJECTS" ]; then
    M -e "SET FOREIGN_KEY_CHECKS=0; DROP TABLE IF EXISTS $OBJECTS; SET FOREIGN_KEY_CHECKS=1;" >/dev/null 2>&1 \
      && echo "DB RESET: dropped pre-existing objects" \
      || echo "DB RESET WARN: drop failed (continuing; init SQL uses IF NOT EXISTS where possible)"
  else
    echo "DB RESET: database already empty"
  fi
  M --force < db-init.sql > /tmp/dbinit.log 2>&1
  CREATED=$(grep -c "Duplicate key name\|already exists" /tmp/dbinit.log 2>/dev/null || true)
  REAL_ERRORS=$(grep -iE "error" /tmp/dbinit.log 2>/dev/null | grep -vicE "already exists|duplicate key name" || true)
  TABLE_COUNT=$(M -N -e "SHOW TABLES;" 2>/dev/null | wc -l)
  echo "DB INIT: applied (skipped-duplicates: ${CREATED:-0}, real errors: ${REAL_ERRORS:-0}, tables now: ${TABLE_COUNT:-0})"
  [ "${REAL_ERRORS:-0}" != "0" ] && grep -iE "error" /tmp/dbinit.log | grep -viE "already exists|duplicate key name" | head -4
else
  echo "DB INIT: SKIPPED (mysql client, db-init.sql or DB creds missing)"
fi

# 3) Install the crash-restarting supervisor, then (re)start the app under it
echo "-- installing supervisor: $SUP --"
cat > "$SUP" <<'SUPERVISOR_EOF'
#!/usr/bin/env bash
# Keeps the Next.js standalone app alive. If the process dies for ANY reason
# it is restarted after 3 seconds, so LiteSpeed never proxies to a dead port.
APP="$HOME/auditform/app"
LOG="$HOME/auditform/app.log"
RUNTIME_BIN="$1"; shift
NODE_FLAGS="$*"
cd "$APP" || exit 1
while true; do
  # shellcheck disable=SC2086
  "$RUNTIME_BIN" $NODE_FLAGS "$APP/server.js" >> "$LOG" 2>&1
  echo "[supervisor] app exited (code=$?) at $(date -u '+%Y-%m-%dT%H:%M:%SZ') - restarting in 3s" >> "$LOG"
  sleep 3
done
SUPERVISOR_EOF
chmod +x "$SUP"

echo "-- restarting app on 127.0.0.1:$PORT --"
pkill -f "auditform/run-app.sh" 2>/dev/null || true
pkill -f "auditform/app/server.js" 2>/dev/null || true
sleep 1
: > "$LOG"
set -a; . ./.env; set +a
export PORT NODE_ENV=production HOSTNAME=127.0.0.1
setsid nohup bash "$SUP" "$RUNTIME" "$NODE_FLAGS" > /dev/null 2>&1 < /dev/null &

# 4) Health check - first boot on shared CPU can take a while; wait up to ~90s
echo "-- local health check:"
OK=000
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  OK=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "http://127.0.0.1:$PORT/" 2>/dev/null) || OK=000
  echo "  try $i: http://127.0.0.1:$PORT/ -> $OK"
  [ "$OK" != "000" ] && [ "$OK" != "502" ] && break
  sleep 7
done
sleep 3
OK2=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "http://127.0.0.1:$PORT/" 2>/dev/null) || OK2=000
echo "  confirm after settle: -> $OK2"
echo "-- processes:"
pgrep -af "run-app.sh|auditform/app/server.js" | head -4 || echo "  (none - SUPERVISOR NOT RUNNING)"
echo "-- app log tail:"
tail -n 25 "$LOG" 2>/dev/null || true

# 5) Wire the domain: LiteSpeed reverse proxy via .htaccess in the docroot
DOCROOT=$(ls -d "$HOME"/domains/*/public_html 2>/dev/null | head -1)
echo "-- docroot detected: ${DOCROOT:-NONE}"
if [ -n "${DOCROOT:-}" ] && [ -d "$DOCROOT" ]; then
  if [ -f "$DOCROOT/.htaccess" ]; then
    cp "$DOCROOT/.htaccess" "$DOCROOT/.htaccess.auditform-backup-$(date +%s)"
    echo "-- backed up existing .htaccess"
  fi
  cp "$APP/htaccess.node" "$DOCROOT/.htaccess"
  echo "-- .htaccess proxy installed in $DOCROOT"
else
  echo "-- no ~/domains/*/public_html found; domain wiring must be done in hPanel"
fi

echo "=== ON-SERVER DEPLOY COMPLETE ==="
