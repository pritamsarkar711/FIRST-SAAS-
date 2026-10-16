# Audit Form - PHP bridge to the Next.js app (managed by GitHub Actions deploy)
# Real files (static assets copied next to this file) are served directly by
# LiteSpeed; every other request is forwarded to the app over a UNIX socket
# by index.php. Restore the Hostinger default page by deleting both files.
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteCond %{REQUEST_URI} !^/\.well-known/
RewriteCond %{REQUEST_URI} !\.well-known/acme-challenge
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.php [QSA,L]
</IfModule>
DirectoryIndex index.php index.html
