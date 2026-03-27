#!/bin/bash
# install-apache.sh
# Dieses Script installiert den Apache Reverse Proxy für frank-sellke.de
# Auf dem Server als ROOT ausführen!

set -e

CONF_FILE="/etc/apache2/sites-available/frank-sellke.conf"
LOG_DIR="/home/users/franksellke/logs/frank-sellke.de"

echo "=== Apache Reverse Proxy Setup für frank-sellke.de ==="

# 1. Log-Verzeichnis anlegen (falls nicht vorhanden)
echo "[1/5] Log-Verzeichnis prüfen..."
mkdir -p "$LOG_DIR"
chown -R franksellke:franksellke "$LOG_DIR" 2>/dev/null || true
echo "OK: $LOG_DIR"

# 2. Notwendige Apache-Module aktivieren
echo "[2/5] Apache-Module aktivieren..."
a2enmod proxy proxy_http proxy_wstunnel rewrite headers ssl 2>/dev/null || true
echo "OK: Module aktiviert"

# 3. Apache-Konfiguration schreiben
echo "[3/5] VirtualHost-Konfiguration schreiben..."
cat > "$CONF_FILE" << 'APACHECONF'
<VirtualHost *:80>
    ServerName frank-sellke.de
    ServerAlias www.frank-sellke.de

    # Redirect HTTP to HTTPS
    RewriteEngine On
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]
</VirtualHost>

<VirtualHost *:443>
    ServerName frank-sellke.de
    ServerAlias www.frank-sellke.de

    # SSL Configuration (KeyHelp-Zertifikate)
    SSLEngine on
    SSLCertificateFile /etc/ssl/keyhelp/letsencrypt/franksellke/frank-sellke.de/complete.pem
    SSLCertificateChainFile /etc/ssl/keyhelp/letsencrypt/franksellke/frank-sellke.de/chain.pem

    # Modern SSL settings
    SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1
    SSLCipherSuite HIGH:!aNULL:!MD5

    # Security Headers
    Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
    Header always set X-Content-Type-Options nosniff
    Header always set Referrer-Policy "strict-origin-when-cross-origin"

    # Proxy Configuration for Next.js (Port 3001)
    ProxyPreserveHost On
    ProxyRequests Off
    ProxyTimeout 300

    # Set headers for backend
    ProxyAddHeaders On
    RequestHeader set X-Forwarded-Proto "https"
    RequestHeader set X-Forwarded-Port "443"

    # Handle WebSocket connections
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/?(.*) "ws://127.0.0.1:3001/$1" [P,L]

    # Proxy Next.js static assets
    ProxyPass /_next/static/ http://127.0.0.1:3001/_next/static/
    ProxyPassReverse /_next/static/ http://127.0.0.1:3001/_next/static/

    ProxyPass /_next/ http://127.0.0.1:3001/_next/
    ProxyPassReverse /_next/ http://127.0.0.1:3001/_next/

    # Proxy API routes
    ProxyPass /api/ http://127.0.0.1:3001/api/
    ProxyPassReverse /api/ http://127.0.0.1:3001/api/

    # Proxy alle anderen Anfragen zu Next.js (muss zuletzt stehen)
    ProxyPass / http://127.0.0.1:3001/
    ProxyPassReverse / http://127.0.0.1:3001/

    # Fallback DocumentRoot
    DocumentRoot /home/users/franksellke/www/frank-sellke

    # Logging
    ErrorLog /home/users/franksellke/logs/frank-sellke.de/error.log
    CustomLog /home/users/franksellke/logs/frank-sellke.de/access.log combined
    LogLevel warn
</VirtualHost>
APACHECONF
echo "OK: Konfiguration geschrieben nach $CONF_FILE"

# 4. Site aktivieren
echo "[4/5] Site aktivieren..."
a2ensite frank-sellke
echo "OK: frank-sellke aktiviert"

# 5. Konfiguration testen und Apache neuladen
echo "[5/5] Konfiguration testen..."
apache2ctl configtest
echo ""
echo "=== Konfiguration OK - Apache wird neu geladen ==="
systemctl reload apache2
echo ""
echo "✅ FERTIG! frank-sellke.de sollte jetzt auf Port 3001 proxyen."
echo ""
echo "Test: curl -I https://frank-sellke.de"
echo ""
