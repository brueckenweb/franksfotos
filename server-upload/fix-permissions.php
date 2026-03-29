<?php
/**
 * FranksFotos – Einmalig-Tool: Datei-Berechtigungen reparieren
 *
 * Setzt alle Medien-Dateien in den Upload-Verzeichnissen auf chmod 644
 * (rw-r--r--, Apache kann lesen, kein exec-Bit).
 *
 * NUTZUNG:
 *   1. Diese Datei temporär nach pics.frank-sellke.de hochladen
 *   2. Aufrufen: https://pics.frank-sellke.de/fix-permissions.php?key=<UPLOAD_API_KEY>
 *   3. Danach sofort wieder vom Server löschen!
 *
 * SICHERHEIT: Ohne gültigen API-Key wird nichts ausgeführt.
 */

$ALLOWED_API_KEY = getenv('UPLOAD_API_KEY') ?: 'eb79f197cb6766d3a889e69ccf5eea0ecfe550ce3d61b043e2e2d9777d62d2a9';

header('Content-Type: text/plain; charset=utf-8');

// ── Auth ──────────────────────────────────────────────────────────────────────
$key = $_GET['key'] ?? $_SERVER['HTTP_X_API_KEY'] ?? '';
if (empty($key) || $key !== $ALLOWED_API_KEY) {
    http_response_code(403);
    echo "403 Forbidden – Ungültiger oder fehlender API-Key\n";
    exit;
}

// ── Konfiguration ─────────────────────────────────────────────────────────────
$BASE_DIR = __DIR__;
$TARGET_DIRS = ['fotos', 'videos', 'avatars', 'thumbs', 'video-thumbs'];
$MEDIA_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov', 'avi', 'webm', 'mkv', 'tiff', 'heic'];

$totalFixed  = 0;
$totalErrors = 0;
$totalSkip   = 0;

echo "=== FranksFotos – Berechtigungen reparieren ===\n\n";

foreach ($TARGET_DIRS as $dir) {
    $fullDir = $BASE_DIR . '/' . $dir;
    if (!is_dir($fullDir)) {
        echo "[SKIP] Verzeichnis nicht vorhanden: $dir\n";
        continue;
    }

    echo "[DIR] $dir\n";

    // Rekursiv alle Dateien durchgehen
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($fullDir, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );

    foreach ($iterator as $file) {
        if (!$file->isFile()) continue;

        $ext = strtolower($file->getExtension());
        if (!in_array($ext, $MEDIA_EXTENSIONS)) {
            $totalSkip++;
            continue;
        }

        $path = $file->getRealPath();
        $currentPerms = fileperms($path) & 0777;

        if ($currentPerms === 0644) {
            // Schon korrekt
            echo "  [OK]    " . substr($path, strlen($BASE_DIR) + 1) . " (0644)\n";
            $totalSkip++;
            continue;
        }

        if (@chmod($path, 0644)) {
            $oldOctal = decoct($currentPerms);
            echo "  [FIXED] " . substr($path, strlen($BASE_DIR) + 1) . " (0{$oldOctal} → 0644)\n";
            $totalFixed++;
        } else {
            echo "  [ERROR] " . substr($path, strlen($BASE_DIR) + 1) . " – chmod fehlgeschlagen!\n";
            $totalErrors++;
        }
    }

    echo "\n";
}

echo "=== Zusammenfassung ===\n";
echo "Repariert: $totalFixed\n";
echo "Bereits korrekt: $totalSkip\n";
echo "Fehler: $totalErrors\n";
echo "\nFERTIG. Bitte diese Datei sofort vom Server löschen!\n";
