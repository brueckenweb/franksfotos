<?php
/**
 * brueckenweb – Bild-Upload-Endpoint für images.brueckenweb.de
 *
 * Empfängt ein auf 800px verkleinertes JPEG aus der FranksFotos-App
 * und legt es im entsprechenden bilder-Ordner ab.
 *
 * Upload-Format: multipart/form-data
 *   file      – Bilddatei (JPEG)
 *   path      – Zielordner, z.B. "bilder171"
 *   filename  – Dateiname, z.B. "BAS115907_B1156345.jpg"
 *
 * Authentifizierung: API-Key im Header X-API-Key oder POST-Feld apiKey
 *
 * Ablage: /bruecken-upload.php im Webroot von images.brueckenweb.de
 */

// ==============================================================
// KONFIGURATION
// ==============================================================

// API-Key: entweder aus Umgebungsvariable oder hier direkt eintragen
$ALLOWED_API_KEY = getenv('BRUECKEN_UPLOAD_API_KEY') ?: 'a7f3c9e2b8d14056f0a1e5c3d7b29841f6e08c4a2d91b5e37f4c6089d3a12b78';

// Erlaubte Pfad-Präfixe (nur bilder*-Ordner)
$ALLOWED_PATH_PATTERN = '/^bilder\d+$/';

$ALLOWED_TYPES = ['image/jpeg', 'image/jpg'];

$MAX_SIZE = 10 * 1024 * 1024; // 10 MB (verkleinerte Bilder sind immer klein)

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
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');
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
// METHODE PRÜFEN
// ==============================================================

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Nur POST erlaubt', 405);
}

// ==============================================================
// AUTHENTIFIZIERUNG
// ==============================================================

$apiKey = $_SERVER['HTTP_X_API_KEY']
       ?? $_POST['apiKey']
       ?? '';

if (empty($apiKey) || $apiKey !== $ALLOWED_API_KEY) {
    jsonError('Ungültiger API-Key', 403);
}

// ==============================================================
// DATEI & PARAMETER LESEN
// ==============================================================

if (empty($_FILES['file'])) {
    jsonError('Keine Datei übermittelt', 400);
}

$file = $_FILES['file'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    $uploadErrors = [
        UPLOAD_ERR_INI_SIZE   => 'Datei überschreitet upload_max_filesize',
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

// MIME-Type prüfen
$finfo    = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!in_array($mimeType, $ALLOWED_TYPES)) {
    jsonError("MIME-Type nicht erlaubt: $mimeType (nur JPEG)", 400);
}

// Pfad validieren (nur bilder123-Format)
$path = trim($_POST['path'] ?? '');
if (!preg_match($ALLOWED_PATH_PATTERN, $path)) {
    jsonError("Ungültiger Pfad: $path (erwartet: bilder + Zahl)", 400);
}

// Dateiname: aus POST-Feld 'filename', Fallback auf originalen Namen
$origName = trim($_POST['filename'] ?? basename($file['name']));

// Sicherheitsbereinigung: nur alphanumerisch + Punkt + Unterstrich + Bindestrich
$safeName = preg_replace('/[^a-zA-Z0-9.\-_]/', '_', $origName);
if (empty($safeName) || $safeName === '.' || $safeName === '..') {
    jsonError('Ungültiger Dateiname', 400);
}

// ==============================================================
// DATEI SPEICHERN
// ==============================================================

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

// Datei-Rechte: 644 = rw-r--r-- (Webserver kann lesen, kein Exec)
@chmod($destFile, 0644);

// ==============================================================
// ANTWORT
// ==============================================================

$baseUrl = 'https://images.brueckenweb.de';
$fileUrl = $baseUrl . '/' . $path . '/' . $safeName;

jsonSuccess([
    'fileName' => $safeName,
    'fileUrl'  => $fileUrl,
    'path'     => $path . '/' . $safeName,
    'size'     => $file['size'],
]);
