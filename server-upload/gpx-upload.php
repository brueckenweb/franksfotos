<?php
/**
 * GPX-Upload-Endpoint für FranksFotos
 * URL: https://pics.frank-sellke.de/gpx-upload.php
 *
 * Speichert hochgeladene GPX-Dateien in /gpx/ und gibt die URL zurück.
 * Sicherheit: Upload-Key aus .env / Konfiguration
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://www.frank-sellke.de');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key, X-Upload-Key');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ── Konfiguration ─────────────────────────────────────────────────────
$uploadKey  = getenv('UPLOAD_API_KEY') ?: 'eb79f197cb6766d3a889e69ccf5eea0ecfe550ce3d61b043e2e2d9777d62d2a9';
$uploadDir  = __DIR__ . '/gpx/';
$baseUrl    = 'https://pics.frank-sellke.de/gpx/';
$maxSize    = 50 * 1024 * 1024; // 50 MB
$allowedExt = ['gpx'];

// ── Methode prüfen ────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ── API-Key prüfen ────────────────────────────────────────────────────
$key = $_SERVER['HTTP_X_API_KEY'] ?? $_SERVER['HTTP_X_UPLOAD_KEY'] ?? $_POST['apiKey'] ?? $_POST['uploadKey'] ?? '';
if ($key !== $uploadKey) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// ── Datei prüfen ──────────────────────────────────────────────────────
if (!isset($_FILES['gpxFile']) || $_FILES['gpxFile']['error'] !== UPLOAD_ERR_OK) {
    $errCode = $_FILES['gpxFile']['error'] ?? 'no file';
    http_response_code(400);
    echo json_encode(['error' => 'Upload error: ' . $errCode]);
    exit;
}

$file     = $_FILES['gpxFile'];
$origName = basename($file['name']);
$ext      = strtolower(pathinfo($origName, PATHINFO_EXTENSION));

if (!in_array($ext, $allowedExt)) {
    http_response_code(400);
    echo json_encode(['error' => 'Only .gpx files are allowed']);
    exit;
}

if ($file['size'] > $maxSize) {
    http_response_code(400);
    echo json_encode(['error' => 'File too large (max 50 MB)']);
    exit;
}

// Einfache GPX-Inhaltsprüfung
$tmpContent = file_get_contents($file['tmp_name'], false, null, 0, 512);
if (stripos($tmpContent, '<gpx') === false && stripos($tmpContent, '<?xml') === false) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid GPX file']);
    exit;
}

// ── Zielordner ────────────────────────────────────────────────────────
if (!is_dir($uploadDir)) {
    if (!mkdir($uploadDir, 0755, true)) {
        http_response_code(500);
        echo json_encode(['error' => 'Cannot create upload directory']);
        exit;
    }
}

// ── Dateiname generieren ──────────────────────────────────────────────
// Sicherer Dateiname: timestamp_slug.gpx
$slug     = preg_replace('/[^a-z0-9\-_]/', '-', strtolower(pathinfo($origName, PATHINFO_FILENAME)));
$slug     = preg_replace('/-+/', '-', trim($slug, '-'));
$slug     = substr($slug, 0, 80);
$newName  = time() . '_' . ($slug ?: 'track') . '.gpx';
$destPath = $uploadDir . $newName;

if (!move_uploaded_file($file['tmp_name'], $destPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save file']);
    exit;
}

// Rechte setzen
chmod($destPath, 0644);

// ── Erfolg ────────────────────────────────────────────────────────────
echo json_encode([
    'success'      => true,
    'filename'     => $newName,
    'originalName' => $origName,
    'url'          => $baseUrl . $newName,
    'size'         => $file['size'],
]);
