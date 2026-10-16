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

# 2) Push Prisma schema to MySQL (server-side: MySQL is reachable from here)
echo "-- prisma db push (MySQL) --"
set -a; . ./.env; set +a
if command -v bunx >/dev/null 2>&1; then
  bunx --yes prisma@6.11.1 db push --schema prisma/schema.mysql.prisma --skip-generate \
    && echo "DB PUSH: OK" \
    || echo "DB PUSH: FAILED (check DATABASE_URL / MySQL creds)"
else
  echo "DB PUSH: SKIPPED (bunx not found)"
fi

# 3) (Re)start the app server
echo "-- restarting app on 127.0.0.1:$PORT --"
pkill -f "auditform/app/server.js" 2>/dev/null || true
sleep 1
set -a; . ./.env; set +a
export PORT NODE_ENV=production HOSTNAME=127.0.0.1
setsid nohup "$RUNTIME" "$APP/server.js" > "$LOG" 2>&1 < /dev/null &
sleep 8
echo "-- local health check:"
curl -s -o /dev/null -w "  http://127.0.0.1:$PORT/ -> %{http_code}\n" --max-time 30 "http://127.0.0.1:$PORT/" || echo "  local check FAILED"
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
