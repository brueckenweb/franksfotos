#!/usr/bin/env node
/**
 * Lokaler Fotodatenbank-Prozessor
 * ================================
 * Läuft auf http://localhost:4567
 * Starten über start-fotodatenbank.vbs (Desktop-Shortcut)
 *
 * Endpunkte:
 *   GET  /status   → Health-Check
 *   GET  /scan     → Ordner scannen, EXIF lesen, Vorschau erstellen
 *   POST /process  → Dateien umbenennen/verschieben, kleine JPGs erstellen
 *   POST /delete   → Aktuelles Foto in Unterordner "gelöscht" verschieben
 */

import http  from "node:http";
import fs    from "node:fs";
import path  from "node:path";
import { fileURLToPath } from "node:url";

// ── Konfiguration ───────────────────────────────────────────────────────────

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "local-config.json");

const DEFAULT_CONFIG = {
  port:             4567,
  zuverarbeitenPath: "C:\\Users\\Frank\\zuverarbeiten",
  fotodatenbankPath: "C:\\FS_Fotodatenbank",
  fotosBasePath:    "F:\\",
};

let cfg = { ...DEFAULT_CONFIG };

if (fs.existsSync(CONFIG_PATH)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    cfg = { ...cfg, ...loaded };
    console.log("✅ Konfiguration geladen:", CONFIG_PATH);
  } catch (e) {
    console.warn("⚠  Fehler beim Laden der Konfiguration:", e.message);
    console.warn("   Nutze Standard-Pfade.");
  }
} else {
  console.warn("⚠  local-config.json nicht gefunden – erstelle Vorlage.");
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n", "utf8");
  console.warn("   Bitte anpassen:", CONFIG_PATH);
}

const ZUVERARBEITEN = cfg.zuverarbeitenPath;
const FOTOS_PATH    = path.join(cfg.fotodatenbankPath, "fotos");

// ── Hilfsfunktionen ─────────────────────────────────────────────────────────

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function normalizeBaseName(filename) {
  const extIdx = filename.lastIndexOf(".");
  const base   = extIdx >= 0 ? filename.slice(0, extIdx) : filename;
  for (const p of ["IMG_", "MVI_", "DSC"]) {
    if (base.startsWith(p)) return base.slice(p.length);
  }
  return base;
}

function formatBdatum(date) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${d}.${m}.${date.getFullYear()}`;
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw;
}

// ── Handler ─────────────────────────────────────────────────────────────────

async function handleStatus(_req, res) {
  sendJson(res, 200, {
    ok:                   true,
    version:              "1.0.0",
    zuverarbeiten:        ZUVERARBEITEN,
    fotodatenbank:        cfg.fotodatenbankPath,
    zuverarbeitenExists:  fs.existsSync(ZUVERARBEITEN),
    fotosPathExists:      fs.existsSync(FOTOS_PATH),
  });
}

async function handleScan(_req, res) {
  // 1. Ordner prüfen
  if (!fs.existsSync(ZUVERARBEITEN)) {
    return sendJson(res, 404, {
      error:   `Ordner nicht gefunden: ${ZUVERARBEITEN}`,
      details: "Bitte local-config.json anpassen und Server neu starten.",
    });
  }

  // 2. Alle Dateien einlesen (nur Dateien, keine Unterordner wie "gelöscht")
  const allFiles = fs
    .readdirSync(ZUVERARBEITEN)
    .filter((n) => {
      if (n === "Thumbs.db" || n.startsWith(".")) return false;
      const stat = fs.statSync(path.join(ZUVERARBEITEN, n));
      return stat.isFile();
    })
    .sort();

  if (allFiles.length === 0) {
    return sendJson(res, 200, { leer: true, anzahlZuVerarbeiten: 0 });
  }

  // 3. Anzahl eindeutiger Basisnamen
  const baseSet = new Set(allFiles.map((f) => normalizeBaseName(f).toLowerCase()));
  const anzahlZuVerarbeiten = baseSet.size;

  // 4. Ersten Basisnamen auswählen
  const firstBaseName = normalizeBaseName(allFiles[0]);

  // 5. Alle Dateien mit diesem Basisnamen
  const fileMap = new Map(); // ext → absoluter Pfad
  for (const name of allFiles) {
    const extIdx = name.lastIndexOf(".");
    const ext    = extIdx >= 0 ? name.slice(extIdx + 1).toLowerCase() : "";
    if (normalizeBaseName(name).toLowerCase() === firstBaseName.toLowerCase()) {
      fileMap.set(ext, path.join(ZUVERARBEITEN, name));
    }
  }

  // 6. Bildtyp
  const hasJpg   = ["jpg", "jpeg", "dsc"].some((k) => fileMap.has(k));
  const hasVideo = ["mov", "mp4"].some((k) => fileMap.has(k));
  const bildTyp  = hasVideo && !hasJpg ? "video" : "foto";

  // 7. EXIF lesen
  const EMPTY_EXIF = {
    aufnahmedatum: "", aufnahmezeit: "",
    blende: "", belichtung: "", brennweite: "", iso: "", kamera: "",
    gpsBreite: 0, gpsLaenge: 0, gpsHoehe: 0, gpsRichtung: -1, bdatum: "",
  };
  let exif = { ...EMPTY_EXIF };

  const EXIF_PRIORITY = ["jpg", "jpeg", "cr3", "cr2", "hif", "dng", "nef", "arw", "raf"];
  const exifKey = bildTyp === "foto" ? EXIF_PRIORITY.find((k) => fileMap.has(k)) : null;

  if (exifKey) {
    try {
      const { default: exifr } = await import("exifr");
      const buffer = fs.readFileSync(fileMap.get(exifKey));
      const raw    = await exifr.parse(buffer, true);

      if (raw) {
        const rawDate = raw.DateTimeOriginal ?? raw.CreateDate ?? raw.DateTime ?? null;
        let aufnahmeDate = null;

        if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
          aufnahmeDate = rawDate;
        } else if (typeof rawDate === "string" && rawDate.trim()) {
          const normalized = rawDate.trim().replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
          const parsed = new Date(normalized);
          if (!isNaN(parsed.getTime())) aufnahmeDate = parsed;
        }

        if (aufnahmeDate) {
          exif.aufnahmedatum = aufnahmeDate.toISOString().split("T")[0];
          exif.aufnahmezeit  = `${String(aufnahmeDate.getHours()).padStart(2,"0")}:${String(aufnahmeDate.getMinutes()).padStart(2,"0")}:${String(aufnahmeDate.getSeconds()).padStart(2,"0")}`;
          exif.bdatum        = formatBdatum(aufnahmeDate);
        }

        if (raw.FNumber)      exif.blende    = `F/${raw.FNumber}`;
        if (raw.ExposureTime) exif.belichtung = raw.ExposureTime >= 1 ? `${raw.ExposureTime}s` : `1/${Math.round(1 / raw.ExposureTime)}s`;
        if (raw.FocalLength)  exif.brennweite = `${raw.FocalLength}mm`;
        const iso = raw.ISO ?? raw.ISOSpeedRatings ?? raw.PhotographicSensitivity;
        if (iso != null) exif.iso = String(iso);
        const model = raw.Model ?? raw.Make;
        if (model) exif.kamera = String(model).trim();

        // GPS
        if (typeof raw.latitude === "number" && !isNaN(raw.latitude)) {
          exif.gpsBreite = raw.latitude;
        } else if (Array.isArray(raw.GPSLatitude)) {
          const [g, m, s] = raw.GPSLatitude;
          const dec = g + m / 60 + s / 3600;
          exif.gpsBreite = raw.GPSLatitudeRef === "S" ? -dec : dec;
        }
        if (typeof raw.longitude === "number" && !isNaN(raw.longitude)) {
          exif.gpsLaenge = raw.longitude;
        } else if (Array.isArray(raw.GPSLongitude)) {
          const [g, m, s] = raw.GPSLongitude;
          const dec = g + m / 60 + s / 3600;
          exif.gpsLaenge = raw.GPSLongitudeRef === "W" ? -dec : dec;
        }
        if (typeof raw.GPSAltitude    === "number") exif.gpsHoehe   = raw.GPSAltitude;
        if (typeof raw.GPSImgDirection === "number") exif.gpsRichtung = raw.GPSImgDirection % 360;
      }
    } catch (e) {
      console.warn("EXIF-Fehler (ignoriert):", e.message);
    }
  }

  // 8. Vorschau-Thumbnail als Base64
  let previewBase64 = null;
  const jpgKey = ["jpg", "jpeg", "dsc"].find((k) => fileMap.has(k));

  if (jpgKey) {
    try {
      const { default: sharp } = await import("sharp");
      const thumbBuf = await sharp(fileMap.get(jpgKey))
        .rotate()                                       // EXIF-Orientation in Pixel einbrennen
        .resize(900, null, { withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      previewBase64 = `data:image/jpeg;base64,${thumbBuf.toString("base64")}`;
    } catch (e) {
      console.warn("Vorschau-Fehler (ignoriert):", e.message);
    }
  }

  sendJson(res, 200, {
    baseName:            firstBaseName,
    bildTyp,
    files:               [...fileMap.keys()].map((ext) => `${firstBaseName}.${ext}`),
    exif,
    previewBase64,
    videoFile:           (fileMap.has("mp4") ? `${firstBaseName}.mp4` : fileMap.has("mov") ? `${firstBaseName}.mov` : null),
    anzahlZuVerarbeiten,
  });
}

async function handleProcess(req, res) {
  // Body parsen
  let params;
  try {
    params = JSON.parse(await readBody(req));
  } catch {
    return sendJson(res, 400, { error: "Ungültiger JSON-Body" });
  }

  const { bnummer, pfad, baseName, generateBas = false, generateGalerie = false, crop = null } = params;
  if (!bnummer || !baseName) {
    return sendJson(res, 400, { error: "bnummer und baseName sind erforderlich" });
  }

  if (!fs.existsSync(ZUVERARBEITEN)) {
    return sendJson(res, 404, { error: `zuverarbeiten-Ordner nicht gefunden: ${ZUVERARBEITEN}` });
  }

  // Alle Dateien mit diesem Basisnamen finden
  const allFiles = fs.readdirSync(ZUVERARBEITEN);
  const fileMap  = new Map(); // ext → absoluter Pfad (Originalname)

  for (const name of allFiles) {
    const extIdx = name.lastIndexOf(".");
    const ext    = extIdx >= 0 ? name.slice(extIdx + 1).toLowerCase() : "";
    if (normalizeBaseName(name).toLowerCase() === String(baseName).toLowerCase()) {
      fileMap.set(ext, path.join(ZUVERARBEITEN, name));
    }
  }

  if (fileMap.size === 0) {
    return sendJson(res, 404, { error: `Keine Dateien für Basisname "${baseName}" gefunden` });
  }

  // Zielordner anlegen
  const pfadFinal  = pfad || (Math.floor(Number(bnummer) / 10000) + "bilder");
  const zielordner = path.join(FOTOS_PATH, pfadFinal);
  try {
    fs.mkdirSync(zielordner, { recursive: true });
  } catch (e) {
    return sendJson(res, 500, { error: `Konnte Zielordner nicht anlegen: ${e.message}` });
  }

  // Dateien verschieben (umbenennen)
  const SAVE_MAP = [
    [["jpg", "jpeg", "dsc"], ".jpg"],
    [["cr2"],                ".CR2"],
    [["cr3"],                ".CR3"],
    [["hif"],                ".HIF"],
    [["dng"],                ".dng"],
    [["mov"],                ".mov"],
    [["mp4"],                ".mp4"],
    [["thm"],                ".THM"],
    [["nef"],                ".NEF"],
    [["arw"],                ".ARW"],
    [["raf"],                ".RAF"],
  ];

  const moved  = [];
  const errors = [];
  const destJpgPath = path.join(zielordner, `B${bnummer}.jpg`);

  for (const [keys, destExt] of SAVE_MAP) {
    for (const key of keys) {
      const srcPath = fileMap.get(key);
      if (srcPath) {
        const destPath = path.join(zielordner, `B${bnummer}${destExt}`);
        try {
          // fs.rename schlägt fehl wenn src/dest auf verschiedenen Laufwerken
          try {
            fs.renameSync(srcPath, destPath);
          } catch {
            fs.copyFileSync(srcPath, destPath);
            fs.unlinkSync(srcPath);
          }
          moved.push(`${path.basename(srcPath)} → B${bnummer}${destExt}`);
        } catch (e) {
          errors.push(`${key} → B${bnummer}${destExt}: ${e.message}`);
        }
        break; // Nur erste Variante
      }
    }
  }

  // Kleine JPGs erstellen (nur wenn gewünscht und JPG vorhanden)
  let basJpgBase64     = null;
  let galerieJpgBase64 = null;

  if (fs.existsSync(destJpgPath) && (generateBas || generateGalerie)) {
    try {
      const { default: sharp } = await import("sharp");

      /**
       * Sharp-Pipeline mit optionalem Crop.
       * crop = { x, y, w, h } – normalisierte Koordinaten (0–1), relativ zur
       * Bildgröße nach EXIF-Rotation (d. h. aufrechtes Bild).
       */
      async function makePipeline(targetWidth, quality) {
        let pipe = sharp(destJpgPath).rotate(); // EXIF-Orientation einbrennen

        if (crop && typeof crop.x === "number") {
          // Upright-Dimensionen nach .rotate() berechnen
          const meta        = await sharp(destJpgPath).metadata();
          const orientation = meta.orientation ?? 1;
          // Orientierungen 5–8: Breite/Höhe sind vertauscht (90° / 270°-Rotation)
          const swapped = orientation >= 5 && orientation <= 8;
          const upW = swapped ? (meta.height ?? 0) : (meta.width  ?? 0);
          const upH = swapped ? (meta.width  ?? 0) : (meta.height ?? 0);

          if (upW > 0 && upH > 0) {
            const left   = Math.max(0, Math.round(crop.x * upW));
            const top    = Math.max(0, Math.round(crop.y * upH));
            const width  = Math.min(upW - left, Math.max(1, Math.round(crop.w * upW)));
            const height = Math.min(upH - top,  Math.max(1, Math.round(crop.h * upH)));

            if (width > 0 && height > 0) {
              console.log(`  Crop: ${left},${top} + ${width}×${height} px (aus ${upW}×${upH})`);
              pipe = pipe.extract({ left, top, width, height });
            }
          }
        }

        return pipe.resize(targetWidth, null, { withoutEnlargement: true })
                   .jpeg({ quality });
      }

      if (generateBas) {
        const buf = await (await makePipeline(800, 85)).toBuffer();
        basJpgBase64 = buf.toString("base64");
        console.log(`  BAS-JPG: ${(buf.length / 1024).toFixed(0)} KB${crop ? " (mit Crop)" : ""}`);
      }

      if (generateGalerie) {
        const buf = await (await makePipeline(2000, 90)).toBuffer();
        galerieJpgBase64 = buf.toString("base64");
        console.log(`  Galerie-JPG: ${(buf.length / 1024).toFixed(0)} KB${crop ? " (mit Crop)" : ""}`);
      }
    } catch (e) {
      errors.push(`Sharp-Fehler: ${e.message}`);
    }
  }

  console.log(`✅ B${bnummer} verarbeitet: ${moved.length} Dateien verschoben${errors.length ? `, ${errors.length} Fehler` : ""}`);

  sendJson(res, 200, {
    moved,
    errors,
    basJpgBase64,
    galerieJpgBase64,
    destJpgPath,
  });
}

async function handleDelete(req, res) {
  let params;
  try {
    params = JSON.parse(await readBody(req));
  } catch {
    return sendJson(res, 400, { error: "Ungültiger JSON-Body" });
  }

  const { baseName } = params;
  if (!baseName) {
    return sendJson(res, 400, { error: "baseName ist erforderlich" });
  }

  if (!fs.existsSync(ZUVERARBEITEN)) {
    return sendJson(res, 404, { error: `zuverarbeiten-Ordner nicht gefunden: ${ZUVERARBEITEN}` });
  }

  // Zielordner "gelöscht" anlegen
  const geloeschtOrdner = path.join(ZUVERARBEITEN, "gelöscht");
  try {
    fs.mkdirSync(geloeschtOrdner, { recursive: true });
  } catch (e) {
    return sendJson(res, 500, { error: `Konnte 'gelöscht'-Ordner nicht anlegen: ${e.message}` });
  }

  // Alle Dateien mit diesem Basisnamen finden
  const allFiles = fs.readdirSync(ZUVERARBEITEN).filter((n) => {
    const stat = fs.statSync(path.join(ZUVERARBEITEN, n));
    return stat.isFile();
  });
  const matched = allFiles.filter(
    (name) => normalizeBaseName(name).toLowerCase() === String(baseName).toLowerCase()
  );

  if (matched.length === 0) {
    return sendJson(res, 404, { error: `Keine Dateien für Basisname "${baseName}" gefunden` });
  }

  const moved  = [];
  const errors = [];

  for (const name of matched) {
    const srcPath  = path.join(ZUVERARBEITEN, name);
    const destPath = path.join(geloeschtOrdner, name);
    try {
      try {
        fs.renameSync(srcPath, destPath);
      } catch {
        fs.copyFileSync(srcPath, destPath);
        fs.unlinkSync(srcPath);
      }
      moved.push(name);
    } catch (e) {
      errors.push(`${name}: ${e.message}`);
    }
  }

  console.log(`🗑  "${baseName}" gelöscht: ${moved.length} Datei(en) → gelöscht/${errors.length ? `, ${errors.length} Fehler` : ""}`);

  sendJson(res, 200, { moved, errors, geloeschtOrdner });
}

// ── Neue Handler für Fotodatenbank-Browser ───────────────────────────────────

/**
 * GET /thumbnail?bnummer=12345&pfad=1bilder
 * Liefert ein 250px-Thumbnail des Fotos von F:\{pfad}\B{bnummer}.jpg
 */
async function handleThumbnail(req, res) {
  const url      = new URL(req.url, `http://localhost:${cfg.port}`);
  const bnummer  = url.searchParams.get("bnummer");
  const pfad     = url.searchParams.get("pfad") || "";

  if (!bnummer) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    return res.end("bnummer fehlt");
  }

  // Pfad: F:\{pfad}\B{bnummer}.jpg
  const basePath = cfg.fotosBasePath || "F:\\";
  const jpgPath  = pfad
    ? path.join(basePath, pfad, `B${bnummer}.jpg`)
    : path.join(basePath, `B${bnummer}.jpg`);

  if (!fs.existsSync(jpgPath)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end(`Datei nicht gefunden: ${jpgPath}`);
  }

  try {
    const { default: sharp } = await import("sharp");
    const buf = await sharp(jpgPath)
      .rotate()
      .resize(250, null, { withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();

    res.writeHead(200, {
      "Content-Type":  "image/jpeg",
      "Content-Length": buf.length,
      "Cache-Control":  "public, max-age=3600",
    });
    res.end(buf);
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(`Thumbnail-Fehler: ${e.message}`);
  }
}

/**
 * GET /files?bnummer=12345&pfad=1bilder
 * Listet alle Dateien B{bnummer}.* im Ordner F:\{pfad}\
 */
async function handleFiles(req, res) {
  const url     = new URL(req.url, `http://localhost:${cfg.port}`);
  const bnummer = url.searchParams.get("bnummer");
  const pfad    = url.searchParams.get("pfad") || "";

  if (!bnummer) {
    return sendJson(res, 400, { error: "bnummer fehlt" });
  }

  const basePath = cfg.fotosBasePath || "F:\\";
  const ordner   = pfad
    ? path.join(basePath, pfad)
    : basePath;

  if (!fs.existsSync(ordner)) {
    return sendJson(res, 404, { error: `Ordner nicht gefunden: ${ordner}` });
  }

  try {
    const allFiles    = fs.readdirSync(ordner);
    const prefix      = `B${bnummer}.`.toLowerCase();
    const matched     = allFiles.filter((n) => n.toLowerCase().startsWith(prefix));
    const fileDetails = matched.map((name) => {
      const fullPath = path.join(ordner, name);
      let sizeBytes = 0;
      try {
        sizeBytes = fs.statSync(fullPath).size;
      } catch { /* ignore */ }
      const extIdx = name.lastIndexOf(".");
      const ext    = extIdx >= 0 ? name.slice(extIdx + 1).toLowerCase() : "";
      return {
        name,
        ext,
        sizeBytes,
        sizeHuman: sizeBytes > 1024 * 1024
          ? `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`
          : `${(sizeBytes / 1024).toFixed(0)} KB`,
        isJpg: ["jpg", "jpeg"].includes(ext),
      };
    });

    const totalBytes  = fileDetails.reduce((s, f) => s + f.sizeBytes, 0);
    const totalHuman  = totalBytes > 1024 * 1024
      ? `${(totalBytes / 1024 / 1024).toFixed(1)} MB`
      : `${(totalBytes / 1024).toFixed(0)} KB`;

    sendJson(res, 200, {
      bnummer,
      pfad,
      ordner,
      files: fileDetails,
      totalHuman,
      anzahl: fileDetails.length,
    });
  } catch (e) {
    sendJson(res, 500, { error: `Fehler beim Lesen: ${e.message}` });
  }
}

/**
 * POST /prepare-galerie  { bnummer, pfad }
 * Liest vorhandenes B{bnummer}.jpg von F:\{pfad}\, skaliert auf 2000px
 * und gibt galerieJpgBase64 zurück.
 */
async function handlePrepareGalerie(req, res) {
  let params;
  try {
    params = JSON.parse(await readBody(req));
  } catch {
    return sendJson(res, 400, { error: "Ungültiger JSON-Body" });
  }

  const { bnummer, pfad = "" } = params;
  if (!bnummer) {
    return sendJson(res, 400, { error: "bnummer ist erforderlich" });
  }

  const basePath = cfg.fotosBasePath || "F:\\";
  const jpgPath  = pfad
    ? path.join(basePath, pfad, `B${bnummer}.jpg`)
    : path.join(basePath, `B${bnummer}.jpg`);

  if (!fs.existsSync(jpgPath)) {
    return sendJson(res, 404, { error: `Datei nicht gefunden: ${jpgPath}` });
  }

  try {
    const { default: sharp } = await import("sharp");
    const buf = await sharp(jpgPath)
      .rotate()
      .resize(2000, null, { withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();

    console.log(`  prepare-galerie B${bnummer}: ${(buf.length / 1024 / 1024).toFixed(1)} MB`);
    sendJson(res, 200, {
      galerieJpgBase64: buf.toString("base64"),
      sizeKb:           Math.round(buf.length / 1024),
    });
  } catch (e) {
    sendJson(res, 500, { error: `Sharp-Fehler: ${e.message}` });
  }
}

// ── HTTP-Server ──────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url   = new URL(req.url, `http://localhost:${cfg.port}`);
  const route = url.pathname;

  try {
    if (route === "/status")                                    return await handleStatus(req, res);
    if (route === "/scan"             && req.method === "GET")  return await handleScan(req, res);
    if (route === "/process"          && req.method === "POST") return await handleProcess(req, res);
    if (route === "/delete"           && req.method === "POST") return await handleDelete(req, res);
    if (route === "/thumbnail"        && req.method === "GET")  return await handleThumbnail(req, res);
    if (route === "/files"            && req.method === "GET")  return await handleFiles(req, res);
    if (route === "/prepare-galerie"  && req.method === "POST") return await handlePrepareGalerie(req, res);

    sendJson(res, 404, { error: `Route nicht gefunden: ${route}` });
  } catch (err) {
    console.error("❌ Server-Fehler:", err);
    sendJson(res, 500, { error: String(err) });
  }
});

server.listen(cfg.port, "127.0.0.1", () => {
  console.log("");
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   Lokaler Fotodatenbank-Prozessor                   ║");
  console.log(`║   http://localhost:${cfg.port}                           ║`);
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║  zuverarbeiten: ${ZUVERARBEITEN.padEnd(34)} ║`);
  console.log(`║  Fotodatenbank: ${cfg.fotodatenbankPath.padEnd(34)} ║`);
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log("║  Zum Beenden: Strg+C                                ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("");

  if (!fs.existsSync(ZUVERARBEITEN)) {
    console.warn(`⚠  zuverarbeiten-Ordner existiert nicht: ${ZUVERARBEITEN}`);
  }
  if (!fs.existsSync(FOTOS_PATH)) {
    console.warn(`⚠  fotos-Ordner existiert nicht: ${FOTOS_PATH}`);
    console.warn("   Er wird beim ersten Eintragen automatisch angelegt.");
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌ Port ${cfg.port} ist bereits belegt.`);
    console.error("   Läuft der Server schon? Oder port in local-config.json ändern.\n");
  } else {
    console.error("❌ Server-Fehler:", err);
  }
  process.exit(1);
});

process.on("SIGINT",  () => { console.log("\n👋 Server beendet."); process.exit(0); });
process.on("SIGTERM", () => { console.log("\n👋 Server beendet."); process.exit(0); });
