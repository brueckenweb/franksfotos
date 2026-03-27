# FranksFotos – Server-Upload Setup

## Was muss hochgeladen werden?

Diese Dateien müssen auf den Webspace von **pics.frank-sellke.de** hochgeladen werden.

---

## Dateien

| Datei | Ziel auf dem Server | Beschreibung |
|-------|---------------------|--------------|
| `upload.php` | `/upload.php` (Webroot) | Empfängt Uploads von der Next.js-App |
| `.htaccess` | `/.htaccess` (Webroot) | Sicherheit, Caching, CORS |

---

## Ordnerstruktur nach dem Upload

Der Server legt die Ordner automatisch beim ersten Upload an.
Alternativ können sie manuell mit Schreibrechten (755) angelegt werden:

```
pics.frank-sellke.de/
├── upload.php          ← hochladen!
├── .htaccess           ← hochladen!
├── fotos/              ← wird automatisch angelegt
├── thumbs/             ← wird automatisch angelegt
├── videos/             ← wird automatisch angelegt
├── video-thumbs/       ← wird automatisch angelegt
└── avatars/            ← wird automatisch angelegt
```

---

## API-Key konfigurieren

Der API-Key muss auf **beiden Seiten** identisch sein:

### 1. Auf dem Server (upload.php)

Die `upload.php` liest den Key aus einer Umgebungsvariable:

```php
$ALLOWED_API_KEY = getenv('UPLOAD_API_KEY') ?: 'your-upload-api-key';
```

**Option A – Umgebungsvariable im Hosting-Panel setzen** (empfohlen):
- Im Hosting-Panel / cPanel → PHP-Umgebungsvariablen → `UPLOAD_API_KEY` setzen

**Option B – Direkt in upload.php eintragen**:
```php
$ALLOWED_API_KEY = 'eb79f197cb6766d3a889e69ccf5eea0ecfe550ce3d61b043e2e2d9777d62d2a9';
```

### 2. In der Next.js-App (.env.local)

```env
UPLOAD_API_KEY="eb79f197cb6766d3a889e69ccf5eea0ecfe550ce3d61b043e2e2d9777d62d2a9"
```

(Wurde bereits automatisch gesetzt.)

---

## PHP-Konfiguration prüfen

Für große Datei-Uploads muss die `php.ini` auf dem Server angepasst werden.
Entweder im Hosting-Panel oder via `.user.ini` im Webroot:

```ini
; .user.ini – in den Webroot von pics.frank-sellke.de hochladen
upload_max_filesize = 512M
post_max_size = 512M
max_execution_time = 300
max_input_time = 300
memory_limit = 256M
```

---

## Test

Nach dem Hochladen testen:

```bash
curl -X POST https://pics.frank-sellke.de/upload.php \
  -F "apiKey=eb79f197cb6766d3a889e69ccf5eea0ecfe550ce3d61b043e2e2d9777d62d2a9" \
  -F "path=fotos" \
  -F "file=@testbild.jpg"
```

**Erwartete Antwort:**
```json
{
  "success": true,
  "fileName": "testbild.jpg",
  "fileUrl": "https://pics.frank-sellke.de/fotos/testbild.jpg",
  "path": "fotos/testbild.jpg",
  "size": 12345,
  "mimeType": "image/jpeg"
}
```

---

## Upload via FTP / Dateimanager

1. Im cPanel/Plesk/FTP-Client mit `pics.frank-sellke.de` verbinden
2. In den **Webroot** (`/public_html/` oder `/httpdocs/`) navigieren
3. `upload.php` hochladen
4. `.htaccess` hochladen
5. Optional: `.user.ini` hochladen (für große Dateien)
6. Ordner `fotos/`, `thumbs/`, `videos/`, `video-thumbs/`, `avatars/` mit Berechtigung **755** anlegen
