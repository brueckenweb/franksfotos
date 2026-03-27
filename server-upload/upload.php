<?php
/**
 * FranksFotos – Upload-Endpoint für pics.frank-sellke.de
 * 
 * Empfängt Datei-Uploads von der Next.js-App (franksfotos)
 * und speichert sie in den entsprechenden Unterordnern.
 * 
 * Ablage auf dem Server: /upload.php (Webroot von pics.frank-sellke.de)
 *
 * Ordnerstruktur (wird automatisch angelegt):
 *   /fotos/        – Original-Fotos
 *   /thumbs/       – Foto-Thumbnails
 *   /videos/       – Videos
 *   /video-thumbs/ – Video-Thumbnails
 *   /avatars/      – Benutzer-Avatare
 */

// ==============================================================
// KONFIGURATION
// ==============================================================

// API-Key muss mit UPLOAD_API_KEY in .env.local übereinstimmen
// WICHTIG: Einen sicheren, langen Key wählen!
$ALLOWED_API_KEY = getenv('UPLOAD_API_KEY') ?: 'eb79f197cb6766d3a889e69ccf5eea0ecfe550ce3d61b043e2e2d9777d62d2a9';

// Erlaubte Ordner (Sicherheit: kein path traversal möglich)
$ALLOWED_PATHS = ['fotos', 'videos', 'avatars', 'thumbs', 'video-thumbs'];

// Erlaubte MIME-Types
$ALLOWED_TYPES = [
    // Bilder
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/tiff',
    'image/heic',
    // Videos
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    'video/x-matroska',
];

// Max. Dateigröße (500 MB)
$MAX_SIZE = 500 * 1024 * 1024;

// Webroot-Verzeichnis (absoluter Pfad zum Upload-Ordner)
$BASE_DIR = __DIR__;

// ==============================================================
// CORS & HEADERS
// ==============================================================

// Nur von der eigenen App erlauben
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
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');
header('Content-Type: application/json; charset=utf-8');

// OPTIONS-Preflight
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

// API-Key aus POST-Body oder Header
$apiKey = $_POST['apiKey'] ?? ($_SERVER['HTTP_X_API_KEY'] ?? '');

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
// PARAMETER LESEN
// ==============================================================

$path       = trim($_POST['path'] ?? 'fotos');
$path       = rtrim($path, '/');

// Sicherheits-Check: nur erlaubte Ordner
$pathParts = explode('/', $path);
$targetDir = $pathParts[0]; // Nur erster Teil prüfen

if (!in_array($targetDir, $ALLOWED_PATHS)) {
    jsonError("Nicht erlaubter Pfad: $path", 400);
}

// Path-Traversal verhindern
if (strpos($path, '..') !== false || strpos($path, '//') !== false) {
    jsonError('Ungültiger Pfad', 400);
}

// ==============================================================
// DATEI PRÜFEN
// ==============================================================

if (empty($_FILES['file'])) {
    jsonError('Keine Datei übermittelt', 400);
}

$file = $_FILES['file'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    $uploadErrors = [
        UPLOAD_ERR_INI_SIZE   => 'Datei überschreitet upload_max_filesize in php.ini',
        UPLOAD_ERR_FORM_SIZE  => 'Datei überschreitet MAX_FILE_SIZE im Formular',
        UPLOAD_ERR_PARTIAL    => 'Datei wurde nur teilweise übertragen',
        UPLOAD_ERR_NO_FILE    => 'Keine Datei übertragen',
        UPLOAD_ERR_NO_TMP_DIR => 'Kein temporäres Verzeichnis verfügbar',
        UPLOAD_ERR_CANT_WRITE => 'Schreibfehler auf Disk',
        UPLOAD_ERR_EXTENSION  => 'Upload durch PHP-Extension gestoppt',
    ];
    $errorMsg = $uploadErrors[$file['error']] ?? "Upload-Fehler: {$file['error']}";
    jsonError($errorMsg, 500);
}

// Dateigröße prüfen
if ($file['size'] > $MAX_SIZE) {
    $maxMB = round($MAX_SIZE / (1024 * 1024));
    jsonError("Datei zu groß. Maximum: {$maxMB}MB", 400);
}

// MIME-Type prüfen (echte Prüfung, nicht nur Extension)
$finfo    = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!in_array($mimeType, $ALLOWED_TYPES)) {
    jsonError("MIME-Type nicht erlaubt: $mimeType", 400);
}

// ==============================================================
// DATEINAME BEREINIGEN
// ==============================================================

// Aus POST übermittelten Dateinamen verwenden (bereits bereinigt durch Next.js)
// Fallback: Original-Dateiname bereinigen
$originalName = $_POST['fileName'] ?? basename($file['name']);

// Sicherheit: nur sichere Zeichen erlauben
$safeName = preg_replace('/[^a-zA-Z0-9.\-_]/', '_', $originalName);
$safeName = preg_replace('/_+/', '_', $safeName);
$safeName = strtolower($safeName);

if (empty($safeName) || $safeName === '.' || $safeName === '..') {
    jsonError('Ungültiger Dateiname', 400);
}

// ==============================================================
// ZIELORDNER ANLEGEN & DATEI SPEICHERN
// ==============================================================

$targetPath = $BASE_DIR . '/' . $path;

// Verzeichnis anlegen falls nicht vorhanden
if (!is_dir($targetPath)) {
    if (!mkdir($targetPath, 0755, true)) {
        jsonError("Verzeichnis konnte nicht angelegt werden: $path", 500);
    }
}

$destFile = $targetPath . '/' . $safeName;

// Datei verschieben
if (!move_uploaded_file($file['tmp_name'], $destFile)) {
    jsonError('Datei konnte nicht gespeichert werden', 500);
}

// ==============================================================
// ANTWORT
// ==============================================================

$baseUrl  = 'https://' . $_SERVER['HTTP_HOST'];
$fileUrl  = $baseUrl . '/' . $path . '/' . $safeName;

jsonSuccess([
    'fileName'  => $safeName,
    'fileUrl'   => $fileUrl,
    'path'      => $path . '/' . $safeName,
    'size'      => $file['size'],
    'mimeType'  => $mimeType,
]);
