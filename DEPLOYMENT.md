# Deployment-Anleitung: Franksfotos → Server

Diese Anleitung erklärt, wie das Franksfotos-Projekt über GitHub Actions automatisch auf den Server deployed wird.

---

## Übersicht

| Eigenschaft | Wert |
|---|---|
| **Server** | `87.118.90.98` |
| **Zielverzeichnis** | `/home/users/franksellke/www/frank-sellke` |
| **Port** | `3001` |
| **PM2 App-Name** | `franksfotos-prod` |
| **Trigger** | Push auf Branch `main` |
| **URL** | `https://frank-sellke.de` / `https://www.frank-sellke.de` |
| **Reverse Proxy** | Apache via `.htaccess` (mod_rewrite `[P]`) |

---

## Benötigte GitHub Secrets

Es müssen **4 Secrets** im GitHub-Repository angelegt werden.  
→ Navigiere zu: `GitHub Repo → Settings → Secrets and variables → Actions → New repository secret`

---

### Secret 1: `SERVER_HOST`

Die IP-Adresse des Servers.

```
87.118.90.98
```

---

### Secret 2: `SERVER_USER`

Der SSH-Benutzername für den Login.

```
franksellke
```

---

### Secret 3: `SERVER_SSH_KEY`

Der **private SSH-Schlüssel** für die Authentifizierung.

**So erhältst du den Key:**

1. Prüfe ob du bereits einen SSH-Key hast:
   ```bash
   cat ~/.ssh/id_rsa
   # oder
   cat ~/.ssh/id_ed25519
   ```

2. Falls kein Key vorhanden, erstelle einen neuen:
   ```bash
   ssh-keygen -t ed25519 -C "github-actions-franksfotos"
   ```

3. Kopiere den **öffentlichen** Key auf den Server (einmalig):
   ```bash
   ssh-copy-id -i ~/.ssh/id_ed25519.pub franksellke@87.118.90.98
   ```

4. Den **privaten** Key (komplett, inkl. Header) als Secret eintragen:
   ```
   -----BEGIN OPENSSH PRIVATE KEY-----
   b3BlbnNzaC1rZXktdjEAAAAA...
   (dein kompletter privater Key)
   -----END OPENSSH PRIVATE KEY-----
   ```

> ⚠️ **Wichtig:** Den privaten Key NIEMALS committen oder teilen! Nur als GitHub Secret speichern.

---

### Secret 4: `FRANKSFOTOS_ENV`

Der komplette Inhalt der `.env.production`-Datei. Diese wird beim Deployment aus dem Secret erzeugt.

**Inhalt des Secrets (Produktionswerte anpassen!):**

```
# Datenbank (MariaDB)
DATABASE_HOST=87.118.90.98
DATABASE_PORT=3306
DATABASE_USER=franksellke
DATABASE_PASSWORD=B5tkfUXoEZy!tY8zQV
DATABASE_NAME=fotodatenbank
DATABASE_URL=mysql://franksellke:B5tkfUXoEZy!tY8zQV@87.118.90.98:3306/fotodatenbank

SITE_BASE_URL=https://www.frank-sellke.de

# Auth (NextAuth.js)
AUTH_SECRET=f35b2d5876f4a33cc1d6d159d9142f20f116406d4ba0c933350c2d0173adf867
AUTH_URL=https://www.frank-sellke.de

# Upload-Domain
UPLOAD_DOMAIN=https://pics.frank-sellke.de
UPLOAD_API_KEY=eb79f197cb6766d3a889e69ccf5eea0ecfe550ce3d61b043e2e2d9777d62d2a9
UPLOAD_PHP_ENDPOINT=https://pics.frank-sellke.de/upload.php

# Wasserzeichen
WATERMARK_TEXT=© FranksFotos – frank-sellke.de
WATERMARK_OPACITY=0.4

# Fotodatenbank – lokaler Eingangsordner auf dem Server
# Unter diesem Pfad liegen die Unterordner "zuverarbeiten/" und "fotos/"
# Auf dem Server muss dieser Ordner existieren und beschreibbar sein!
FS_FOTODATENBANK_PATH=/home/users/franksellke/FS_Fotodatenbank

# App
NEXT_PUBLIC_APP_URL=https://www.frank-sellke.de
NEXT_PUBLIC_APP_NAME=FranksFotos
NEXT_PUBLIC_MEDIA_BASE_URL=https://pics.frank-sellke.de
```
> 💡 **Hinweis:** In `.env.production` keine Anführungszeichen um die Werte nötig!

> ⚠️ **Wichtig:** Den Ordner `FS_FOTODATENBANK_PATH` auf dem Server anlegen und Schreibrechte setzen:
> ```bash
> mkdir -p /home/users/franksellke/FS_Fotodatenbank/zuverarbeiten
> mkdir -p /home/users/franksellke/FS_Fotodatenbank/fotos
> chmod -R 755 /home/users/franksellke/FS_Fotodatenbank
> ```

---

## Einmalige Server-Vorbereitung

Beim **ersten** Deployment muss das Repository auf dem Server geklont werden:

```bash
# SSH-Verbindung zum Server (über Zwischen-User falls nötig)
ssh franksellke@87.118.90.98

# Verzeichnis erstellen (falls nicht vorhanden)
mkdir -p /home/users/franksellke/www/frank-sellke

# Repository klonen
cd /home/users/franksellke/www
git clone https://github.com/brueckenweb/franksfotos.git frank-sellke

# Log-Verzeichnis für PM2 anlegen
mkdir -p /home/users/franksellke/www/frank-sellke/log/pm2
```

Falls der Server privaten Zugriff auf GitHub benötigt, muss ein **Deploy Key** eingerichtet werden:

```bash
# Auf dem Server: SSH-Key generieren
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -C "server-deploy-franksfotos"

# Öffentlichen Key anzeigen (diesen bei GitHub als Deploy Key eintragen)
cat ~/.ssh/github_deploy.pub
```

→ GitHub: `Repo Settings → Deploy keys → Add deploy key` (Read-only reicht)

---

## Deployment starten

Das Deployment wird **automatisch** ausgelöst bei:
```bash
git push origin main
```

Den Fortschritt kannst du unter `GitHub Repo → Actions` verfolgen.

---

## Workflow-Schritte im Überblick

1. 🔑 SSH-Verbindung testen
2. 📦 Dependencies installieren (GitHub Actions Runner)
3. 🔨 `npm run build` ausführen
4. 📁 Zielverzeichnis `/home/users/franksellke/www/frank-sellke` prüfen/anlegen
5. 🔄 Neue Dateien aus `public/` vom Server ins Repo synchronisieren
6. 🗑️ Alte Deployment-Dateien auf dem Server löschen
7. 📝 `.env.production` aus GitHub Secret erstellen
8. 📦 `deployment.tar.gz` erstellen (`.next`, `package.json`, `public`, `ecosystem.config.cjs`, `.env.production`)
9. ⬆️ Archiv per SSH/base64 auf den Server übertragen
10. 📦 `npm install` auf dem Server
11. ⏹️ PM2 App `franksfotos-prod` stoppen
12. ▶️ PM2 App `franksfotos-prod` neu starten (Port 3001)

---

## Fehlersuche

### PM2 Status prüfen
```bash
ssh franksellke@87.118.90.98
pm2 list
pm2 logs franksfotos-prod --lines 50
```

### App manuell neu starten
```bash
cd /home/users/franksellke/www/frank-sellke
pm2 restart franksfotos-prod
```

### Logs anzeigen
```bash
tail -f /home/users/franksellke/www/frank-sellke/log/pm2/franksfotos-combined.log
```
