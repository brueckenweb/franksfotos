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

  // 2. Alle Dateien einlesen
  const allFiles = fs
    .readdirSync(ZUVERARBEITEN)
    .filter((n) => n !== "Thumbs.db" && !n.startsWith("."))
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

  const { bnummer, pfad, baseName, generateBas = false, generateGalerie = false } = params;
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

      if (generateBas) {
        const buf = await sharp(destJpgPath)
          .resize(800, null, { withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
        basJpgBase64 = buf.toString("base64");
        console.log(`  BAS-JPG: ${(buf.length / 1024).toFixed(0)} KB`);
      }

      if (generateGalerie) {
        const buf = await sharp(destJpgPath)
          .resize(2000, null, { withoutEnlargement: true })
          .jpeg({ quality: 90 })
          .toBuffer();
        galerieJpgBase64 = buf.toString("base64");
        console.log(`  Galerie-JPG: ${(buf.length / 1024).toFixed(0)} KB`);
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
    if (route === "/status")                              return await handleStatus(req, res);
    if (route === "/scan"    && req.method === "GET")    return await handleScan(req, res);
    if (route === "/process" && req.method === "POST")   return await handleProcess(req, res);

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
