#!/usr/bin/env bash
# Runs ON the Hostinger server after the GitHub Actions runner has rsynced
# the standalone build. Writes .env, pushes the Prisma schema to MySQL,
# (re)starts the Node server and wires the domain docroot through LiteSpeed.
set -u
APP="$HOME/auditform/app"
LOG="$HOME/auditform/app.log"
PORT=3000

echo "=== ON-SERVER DEPLOY $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
mkdir -p "$APP"
cd "$APP" || { echo "FATAL: cannot cd $APP"; exit 1; }
echo "-- app dir contents:"
ls -la | head -15

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
if command -v npx >/dev/null 2>&1; then
  npx -y prisma@6.11.1 db push --schema prisma/schema.mysql.prisma --skip-generate \
    && echo "DB PUSH: OK" \
    || echo "DB PUSH: FAILED (check DATABASE_URL / MySQL creds)"
else
  echo "DB PUSH: SKIPPED (npx not found on server)"
fi

# 3) (Re)start the app server
echo "-- restarting node app on 127.0.0.1:$PORT --"
pkill -f "auditform/app/server.js" 2>/dev/null || true
sleep 1
set -a; . ./.env; set +a
export PORT HOSTNAME=127.0.0.1 NODE_ENV=production
setsid nohup node "$APP/server.js" > "$LOG" 2>&1 < /dev/null &
sleep 6
echo "-- local health check:"
curl -s -o /dev/null -w "  http://127.0.0.1:$PORT/ -> %{http_code}\n" --max-time 20 "http://127.0.0.1:$PORT/" || echo "  local check FAILED"
echo "-- app log tail:"
tail -n 25 "$LOG" 2>/dev/null || true

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
