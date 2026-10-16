#!/usr/bin/env bash
# Runs ON the Hostinger server after the GitHub Actions runner has rsynced
# the standalone build. Writes .env, pushes the Prisma schema to MySQL,
# (re)starts the app server and wires the domain docroot through LiteSpeed.
#
# NOTE: Hostinger shared servers ship BUN (/usr/bin/bun) but no node/npm/npx,
# so the app runs with bun and the schema push uses bunx.
set -u
APP="$HOME/auditform/app"
LOG="$HOME/auditform/app.log"
PORT=3000

# Locate a runtime: prefer bun, fall back to node in common locations
RUNTIME=""
for c in bun node "$HOME/bin/node" /usr/local/bin/node /usr/bin/node; do
  if command -v "$c" >/dev/null 2>&1; then RUNTIME="$(command -v "$c")"; break; fi
done
[ -n "$RUNTIME" ] || { echo "FATAL: no bun or node runtime found on server"; exit 1; }
echo "-- runtime: $RUNTIME ($("$RUNTIME" --version 2>&1 | head -1))"

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

# 2) Apply the database schema with the mysql client (no prisma CLI needed:
#    the runner pre-generates db-init.sql; the MariaDB client is on this server)
echo "-- database schema (MySQL) --"
set -a; . ./.env; set +a
if command -v mysql >/dev/null 2>&1 && [ -f db-init.sql ] && [ -n "${DB_NAME:-}" ] && [ -n "${DB_USER:-}" ]; then
  MYSQL_PWD="${DB_PASSWORD:-}" mysql -h "${DB_HOST:-localhost}" -u "$DB_USER" "$DB_NAME" --force < db-init.sql > /tmp/dbinit.log 2>&1
  EXISTING=$(grep -icE "already exists" /tmp/dbinit.log 2>/dev/null || true)
  OTHER_ERRORS=$(grep -iE "error" /tmp/dbinit.log 2>/dev/null | grep -vicE "already exists|duplicate key name" || true)
  echo "DB INIT: applied (pre-existing objects skipped: ${EXISTING:-0}, real errors: ${OTHER_ERRORS:-0})"
  grep -iE "error" /tmp/dbinit.log 2>/dev/null | grep -viE "already exists|duplicate key name" | head -4 || true
else
  echo "DB INIT: SKIPPED (mysql client, db-init.sql or DB creds missing)"
fi

# 3) (Re)start the app server
echo "-- restarting app on 127.0.0.1:$PORT --"
pkill -f "auditform/app/server.js" 2>/dev/null || true
sleep 1
set -a; . ./.env; set +a
export PORT NODE_ENV=production HOSTNAME=127.0.0.1
setsid nohup "$RUNTIME" "$APP/server.js" > "$LOG" 2>&1 < /dev/null &
sleep 6
echo "-- local health check:"
OK=000
for i in 1 2 3 4; do
  OK=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "http://127.0.0.1:$PORT/" 2>/dev/null) || OK=000
  echo "  try $i: http://127.0.0.1:$PORT/ -> $OK"
  [ "$OK" = "200" ] && break
  sleep 6
done
echo "-- app log tail:"
tail -n 20 "$LOG" 2>/dev/null || true

# 4) Wire the domain: LiteSpeed reverse proxy via .htaccess in the docroot
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
