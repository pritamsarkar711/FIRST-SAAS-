#!/usr/bin/env bash
# Runs ON the Hostinger server after the runner has rsynced laravel-app/.
#
# ARCHITECTURE: pure PHP Laravel app served NATIVELY by LiteSpeed.
# No Node process, no proxy, no unix socket - the docroot index.php boots
# the framework directly, so the old 503 (dead backend) and 403 (no index)
# are structurally impossible.
set -u

APP="$HOME/laravel-app"

echo "=== LARAVEL ON-SERVER DEPLOY $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
cd "$APP" || { echo "FATAL: cannot cd $APP"; exit 1; }
echo "-- app dir: $(du -sh . 2>/dev/null | cut -f1), $(find vendor -name '*.php' 2>/dev/null | wc -l) vendor php files"

# ---------- 1) locate a PHP >= 8.2 CLI ----------
find_php() {
  # Discover every php binary on the server (LiteSpeed lsphp, CloudLinux alt-php...)
  local CANDIDATES
  CANDIDATES=$(
    {
      ls -1 /usr/local/lsws/lsphp*/bin/php 2>/dev/null
      ls -1 /opt/alt/php*/usr/bin/php 2>/dev/null
      ls -1 /opt/alt/php*/root/usr/bin/php 2>/dev/null
      ls -1 /opt/alt/alt-php*/usr/bin/php 2>/dev/null
      ls -1 /opt/alt/alt-php*/root/usr/bin/php 2>/dev/null
      ls -1 /opt/cpanel/ea-php*/root/usr/bin/php 2>/dev/null
      ls -1 /usr/local/bin/php /usr/bin/php /usr/local/php*/bin/php 2>/dev/null
      command -v php php82 php83 php84 2>/dev/null
      # broad sweep as a last resort (bounded depth so it stays fast)
      find /opt/alt /usr/local/lsws /usr/local -maxdepth 5 -type f -name php 2>/dev/null | head -40
    } | sort -u
  )
  echo "DISCOVERY: raw candidates:"
  if [ -z "$CANDIDATES" ]; then
    echo "  (none found)"
    return 1
  fi
  echo "$CANDIDATES" | while read -r c; do
    echo "  $c = $("$c" -r 'echo PHP_VERSION;' 2>/dev/null || echo '?')"
  done
  # Pick the highest version >= 8.2
  local BEST="" BESTV=""
  for c in $CANDIDATES; do
    V=$("$c" -r 'echo PHP_VERSION;' 2>/dev/null) || continue
    case "$V" in
      8.2*|8.3*|8.4*|8.5*|9.*)
        if [ -z "$BESTV" ] || [ "$(printf '%s\n' "$BESTV" "$V" | sort -V | head -1)" != "$V" ]; then
          BEST="$c"; BESTV="$V"
        fi ;;
    esac
  done
  [ -n "$BEST" ] && { echo "DISCOVERY: selected $BEST ($BESTV)"; PHP="$BEST"; return 0; }
  return 1
}
if ! find_php || [ -z "${PHP:-}" ]; then
  echo "FATAL: no PHP >= 8.2 CLI found on server."
  echo "FATAL: raise the PHP version in hPanel (PHP Configuration) to 8.2/8.3 and re-run this deploy."
  exit 1
fi
echo "-- PHP CLI: $PHP ($("$PHP" -r 'echo PHP_VERSION;'))"

# ---------- 2) environment ----------
if [ ! -f .env ] && [ -f .env.production ]; then
  mv .env.production .env
  chmod 600 .env
  echo "-- .env installed (first run)"
elif [ -f .env ]; then
  rm -f .env.production
  echo "-- keeping existing .env (APP_KEY preserved)"
fi
[ -f .env ] || { echo "FATAL: .env missing"; exit 1; }

grep -q '^APP_KEY=base64' .env || {
  "$PHP" artisan key:generate --force && echo "-- APP_KEY generated"
}
grep -q '^APP_KEY=base64' .env || { echo "FATAL: APP_KEY missing"; exit 1; }

# ---------- 3) stop the legacy Node supervisor (old architecture) ----------
pkill -f 'auditform/run-app.sh' 2>/dev/null || true
pkill -f 'auditform/app/server.js' 2>/dev/null || true
echo "-- legacy node stack stopped (if any)"

# ---------- 4) database: clean schema + seed (FIRST RUN ONLY) ----------
if [ ! -f storage/app/.installed ]; then
  echo "-- database: first run - migrate:fresh (drops all tables, clean schema) --"
  "$PHP" artisan migrate:fresh --force --seed 2>&1 | tail -12 || { echo "FATAL: migrate failed"; exit 1; }
  mkdir -p storage/app && touch storage/app/.installed
  echo "-- .installed marker written (future deploys only run migrate --force) --"
else
  echo "-- database: already installed - incremental migrate --"
  "$PHP" artisan migrate --force --seed 2>&1 | tail -6 || { echo "FATAL: migrate failed"; exit 1; }
fi

# ---------- 5) caches ----------
"$PHP" artisan config:cache >/dev/null 2>&1 && echo "-- config cached"
"$PHP" artisan route:cache  >/dev/null 2>&1 && echo "-- routes cached"
"$PHP" artisan view:cache   >/dev/null 2>&1 && echo "-- views cached"
"$PHP" artisan storage:link >/dev/null 2>&1 && echo "-- storage linked (app side)"

chmod -R ug+rwX storage bootstrap/cache 2>/dev/null || true

# ---------- 6) wire the domain docroot ----------
DOCROOT=$(ls -d "$HOME"/domains/*/public_html 2>/dev/null | head -1)
if [ -z "$DOCROOT" ] || [ ! -d "$DOCROOT" ]; then
  echo "FATAL: no ~/domains/*/public_html found - wire the domain manually in hPanel"
  exit 1
fi
echo "-- docroot: $DOCROOT"

# 6a) remove the old Node.js bridge architecture
rm -f "$DOCROOT/index.php" "$DOCROOT/.htaccess"
rm -rf "$DOCROOT/_next"

# 6b) static assets served directly by LiteSpeed
cd "$APP/public" || exit 1
for item in build fonts illustrations logos logo.svg robots.txt favicon.ico; do
  if [ -e "$item" ]; then
    rm -rf "$DOCROOT/$item"
    cp -r "$item" "$DOCROOT/"
  fi
done
echo "-- static assets copied (build/, fonts/, illustrations/, logos/)"
cd "$APP" || exit 1

# 6c) storage symlink for generated writer images
rm -rf "$DOCROOT/storage"
ln -sfn "$APP/storage/app/public" "$DOCROOT/storage"
echo "-- storage symlink: $DOCROOT/storage -> $APP/storage/app/public"

# 6d) .htaccess (Laravel front controller; real files served directly)
cp "$APP/public/.htaccess" "$DOCROOT/.htaccess"

# 6e) index.php: boot the framework straight from the docroot
cat > "$DOCROOT/index.php" <<PHP
<?php
define('LARAVEL_START', microtime(true));
require '$APP/vendor/autoload.php';
(require_once '$APP/bootstrap/app.php')
    ->handleRequest(Illuminate\\Http\\Request::capture());
PHP
chmod 644 "$DOCROOT/index.php" "$DOCROOT/.htaccess"
echo "-- index.php + .htaccess installed (pure PHP, no proxy)"

# ---------- 7) local sanity: boot the kernel through CLI ----------
"$PHP" artisan --version 2>&1 | head -1
echo "=== LARAVEL ON-SERVER DEPLOY COMPLETE ==="
