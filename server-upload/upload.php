<?php
/**
 * FranksFotos – Upload-Endpoint für pics.frank-sellke.de
 *
 * Unterstützt zwei Upload-Modi:
 *   1. Raw-Body  (Content-Type: application/octet-stream / image/* / video/*)
 *      → Metadaten kommen als HTTP-Header: X-Upload-Path, X-Upload-Name
 *      → php://input wird gelesen (NICHT durch post_max_size limitiert!)
 *      → empfohlen für große Dateien aus Next.js-Route
 *
 *   2. Multipart  (Content-Type: multipart/form-data)
 *      → Klassischer $_FILES-Upload
 *      → begrenzt durch post_max_size (PHP-Standard meist 8 MB)
 *      → als Fallback beibehalten
 *
 * Ablage: /upload.php im Webroot von pics.frank-sellke.de
 */

// ==============================================================
// KONFIGURATION
// ==============================================================

$ALLOWED_API_KEY = getenv('UPLOAD_API_KEY') ?: 'eb79f197cb6766d3a889e69ccf5eea0ecfe550ce3d61b043e2e2d9777d62d2a9';

$ALLOWED_PATHS = ['fotos', 'videos', 'avatars', 'thumbs', 'video-thumbs'];

$ALLOWED_TYPES = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/tiff', 'image/heic',
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska',
];

$MAX_SIZE = 500 * 1024 * 1024; // 500 MB

$BASE_DIR = __DIR__;

// ==============================================================
// CORS & HEADERS
// ==============================================================

$allowed_origins = [
    'https://www.frank-sellke.de',
    'https://frank-sellke.de',
    'http://localhost:3000',
    'http://localhost:3001',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header("Access-Control-Allow-Origin: https://www.frank-sellke.de");
}

header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key, X-Upload-Path, X-Upload-Name');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ==============================================================
// HILFSFUNKTIONEN
// ==============================================================

function jsonError(string $message, int $code = 400): void
{
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $message]);
    exit;
}

function jsonSuccess(array $data): void
{
    http_response_code(200);
    echo json_encode(array_merge(['success' => true], $data));
    exit;
}

// ==============================================================
// AUTHENTIFIZIERUNG
// ==============================================================

// API-Key: zuerst aus Header, dann aus POST-Body
$apiKey = $_SERVER['HTTP_X_API_KEY']
       ?? $_POST['apiKey']
       ?? '';

if (empty($apiKey) || $apiKey !== $ALLOWED_API_KEY) {
    jsonError('Ungültiger API-Key', 403);
}

// ==============================================================
// METHODE PRÜFEN
// ==============================================================

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Nur POST erlaubt', 405);
}

// ==============================================================
// UPLOAD-MODUS ERKENNEN
// ==============================================================

$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
$isRawUpload = stripos($contentType, 'multipart/form-data') === false;

// ==============================================================
// PARAMETER & DATEI LESEN
// ==============================================================

if ($isRawUpload) {
    // ── Raw-Body-Modus ──────────────────────────────────────────
    // Metadaten aus HTTP-Headern lesen
    $path      = trim($_SERVER['HTTP_X_UPLOAD_PATH'] ?? 'fotos');
    $origName  = trim($_SERVER['HTTP_X_UPLOAD_NAME'] ?? 'upload.bin');
    $mimeType  = strtok($contentType, ';') ?: 'application/octet-stream';

    // Sicherheits-Check: nur erlaubte Ordner
    $pathParts = explode('/', $path);
    $targetDir = $pathParts[0];
    if (!in_array($targetDir, $ALLOWED_PATHS)) {
        jsonError("Nicht erlaubter Pfad: $path", 400);
    }
    if (strpos($path, '..') !== false || strpos($path, '//') !== false) {
        jsonError('Ungültiger Pfad', 400);
    }

    // MIME-Type prüfen
    if (!in_array($mimeType, $ALLOWED_TYPES)) {
        jsonError("MIME-Type nicht erlaubt: $mimeType", 400);
    }

    // Dateiname bereinigen
    $safeName = preg_replace('/[^a-zA-Z0-9.\-_]/', '_', $origName);
    $safeName = strtolower(preg_replace('/_+/', '_', $safeName));
    if (empty($safeName) || $safeName === '.' || $safeName === '..') {
        jsonError('Ungültiger Dateiname', 400);
    }

    // Zielordner anlegen
    $targetPath = $BASE_DIR . '/' . $path;
    if (!is_dir($targetPath)) {
        if (!mkdir($targetPath, 0755, true)) {
            jsonError("Verzeichnis konnte nicht angelegt werden: $path", 500);
        }
    }

    $destFile = $targetPath . '/' . $safeName;

    // php://input in temporäre Datei streamen (speicherschonend)
    $tmpFile = tempnam(sys_get_temp_dir(), 'ff_upload_');
    $in  = fopen('php://input', 'rb');
    $out = fopen($tmpFile, 'wb');
    if (!$in || !$out) {
        jsonError('Konnte Datenstrom nicht öffnen', 500);
    }
    $bytesWritten = stream_copy_to_stream($in, $out);
    fclose($in);
    fclose($out);

    if ($bytesWritten === false || $bytesWritten === 0) {
        @unlink($tmpFile);
        jsonError('Dateiinhalt konnte nicht gelesen werden', 500);
    }

    // Größe prüfen
    if ($bytesWritten > $MAX_SIZE) {
        @unlink($tmpFile);
        $maxMB = round($MAX_SIZE / (1024 * 1024));
        jsonError("Datei zu groß. Maximum: {$maxMB}MB", 400);
    }

    // MIME-Type mit finfo verifizieren
    $finfo    = finfo_open(FILEINFO_MIME_TYPE);
    $realMime = finfo_file($finfo, $tmpFile);
    finfo_close($finfo);

    // Manche Videoformate (MP4, MOV, MKV) werden von älteren libmagic-Versionen
    // als application/octet-stream erkannt. In diesem Fall vertrauen wir dem
    // deklarierten Content-Type-Header, der bereits oben gegen $ALLOWED_TYPES
    // validiert wurde.
    if ($realMime === 'application/octet-stream') {
        $realMime = $mimeType;
    } elseif (!in_array($realMime, $ALLOWED_TYPES)) {
        @unlink($tmpFile);
        jsonError("Echter MIME-Type nicht erlaubt: $realMime", 400);
    }

    // Datei an Zielort verschieben
    if (!rename($tmpFile, $destFile)) {
        @unlink($tmpFile);
        jsonError('Datei konnte nicht gespeichert werden', 500);
    }

    $fileSize = $bytesWritten;

} else {
    // ── Multipart-Modus (Fallback) ──────────────────────────────
    $path     = trim($_POST['path'] ?? 'fotos');
    $path     = rtrim($path, '/');

    // Sicherheits-Check: nur erlaubte Ordner
    $pathParts = explode('/', $path);
    $targetDir = $pathParts[0];
    if (!in_array($targetDir, $ALLOWED_PATHS)) {
        jsonError("Nicht erlaubter Pfad: $path", 400);
    }
    if (strpos($path, '..') !== false || strpos($path, '//') !== false) {
        jsonError('Ungültiger Pfad', 400);
    }

    if (empty($_FILES['file'])) {
        jsonError('Keine Datei übermittelt (post_max_size überschritten?)', 400);
    }

    $file = $_FILES['file'];

    if ($file['error'] !== UPLOAD_ERR_OK) {
        $uploadErrors = [
            UPLOAD_ERR_INI_SIZE   => 'Datei überschreitet upload_max_filesize in php.ini',
            UPLOAD_ERR_FORM_SIZE  => 'Datei überschreitet MAX_FILE_SIZE',
            UPLOAD_ERR_PARTIAL    => 'Datei wurde nur teilweise übertragen',
            UPLOAD_ERR_NO_FILE    => 'Keine Datei übertragen',
            UPLOAD_ERR_NO_TMP_DIR => 'Kein temporäres Verzeichnis',
            UPLOAD_ERR_CANT_WRITE => 'Schreibfehler',
            UPLOAD_ERR_EXTENSION  => 'Upload durch PHP-Extension gestoppt',
        ];
        jsonError($uploadErrors[$file['error']] ?? "Upload-Fehler: {$file['error']}", 500);
    }

    if ($file['size'] > $MAX_SIZE) {
        $maxMB = round($MAX_SIZE / (1024 * 1024));
        jsonError("Datei zu groß. Maximum: {$maxMB}MB", 400);
    }

    $finfo    = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    if (!in_array($mimeType, $ALLOWED_TYPES)) {
        jsonError("MIME-Type nicht erlaubt: $mimeType", 400);
    }

    $origName = $_POST['fileName'] ?? basename($file['name']);
    $safeName = preg_replace('/[^a-zA-Z0-9.\-_]/', '_', $origName);
    $safeName = strtolower(preg_replace('/_+/', '_', $safeName));
    if (empty($safeName) || $safeName === '.' || $safeName === '..') {
        jsonError('Ungültiger Dateiname', 400);
    }

    $targetPath = $BASE_DIR . '/' . $path;
    if (!is_dir($targetPath)) {
        if (!mkdir($targetPath, 0755, true)) {
            jsonError("Verzeichnis konnte nicht angelegt werden: $path", 500);
        }
    }

    $destFile = $targetPath . '/' . $safeName;

    if (!move_uploaded_file($file['tmp_name'], $destFile)) {
        jsonError('Datei konnte nicht gespeichert werden', 500);
    }

    $fileSize = $file['size'];
}

// ==============================================================
// ANTWORT
// ==============================================================

$baseUrl = 'https://' . $_SERVER['HTTP_HOST'];
$fileUrl = $baseUrl . '/' . $path . '/' . $safeName;

jsonSuccess([
    'fileName' => $safeName,
    'fileUrl'  => $fileUrl,
    'path'     => $path . '/' . $safeName,
    'size'     => $fileSize,
    'mimeType' => $mimeType ?? $realMime ?? 'unknown',
]);
