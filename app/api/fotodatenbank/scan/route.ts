/**
 * API-Route: Eingangsordner scannen, EXIF lesen, nächste bnummer ermitteln
 * GET /api/fotodatenbank/scan
 * Nur für isMainAdmin zugänglich
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fdFotodatenbank, fdFotogruppenverkn } from "@/lib/db/schema";
import { max, desc } from "drizzle-orm";
import fs from "fs";
import path from "path";
import exifr from "exifr";

const BASE_PATH =
  process.env.FS_FOTODATENBANK_PATH ?? "C:\\FS_Fotodatenbank";
const ZUVERARBEITEN_PATH = path.join(BASE_PATH, "zuverarbeiten");

/** TT.MM.JJJJ */
function formatBdatum(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${d}.${m}.${date.getFullYear()}`;
}

/** JJJJ-MM-TT */
function formatIsoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/** HH:MM:SS */
function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export async function GET() {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  try {
    // 1. Ordner anlegen falls nicht vorhanden
    if (!fs.existsSync(ZUVERARBEITEN_PATH)) {
      fs.mkdirSync(ZUVERARBEITEN_PATH, { recursive: true });
      return NextResponse.json({ leer: true, message: "Ordner ist leer" });
    }

    // 2. Dateien lesen (keine Verzeichnisse)
    let files = fs
      .readdirSync(ZUVERARBEITEN_PATH)
      .filter(
        (f) =>
          !fs.statSync(path.join(ZUVERARBEITEN_PATH, f)).isDirectory()
      );

    // Thumbs.db entfernen
    if (files.includes("Thumbs.db")) {
      try {
        fs.unlinkSync(path.join(ZUVERARBEITEN_PATH, "Thumbs.db"));
      } catch { /* ignorieren */ }
      files = files.filter((f) => f !== "Thumbs.db");
    }

    if (files.length === 0) {
      return NextResponse.json({
        leer: true,
        message: "Keine Dateien in zuverarbeiten",
      });
    }

    // 3. DSC_ / IMG_ / MVI_ Präfixe umbenennen (wie bilderkennen() in PHP)
    const PREFIXES = ["IMG_", "MVI_", "DSC"];
    const needsRename = PREFIXES.some((p) => files[0].startsWith(p));

    if (needsRename) {
      for (const file of files) {
        const ext = path.extname(file);
        const base = path.basename(file, ext);
        let newBase = base;
        for (const prefix of PREFIXES) {
          if (base.startsWith(prefix)) {
            newBase = base.slice(prefix.length);
            break;
          }
        }
        if (newBase !== base) {
          try {
            fs.renameSync(
              path.join(ZUVERARBEITEN_PATH, file),
              path.join(ZUVERARBEITEN_PATH, newBase + ext)
            );
          } catch { /* Zieldatei existiert bereits → ignorieren */ }
        }
      }
      // Neu einlesen nach Umbenennung
      files = fs
        .readdirSync(ZUVERARBEITEN_PATH)
        .filter(
          (f) =>
            !fs.statSync(path.join(ZUVERARBEITEN_PATH, f)).isDirectory()
        );
    }

    if (files.length === 0) {
      return NextResponse.json({ leer: true, message: "Keine Dateien nach Umbenennung" });
    }

    // 4. Ersten Dateinamen analysieren
    const firstFile = files[0];
    const firstExtRaw = path.extname(firstFile);
    const baseName = path.basename(firstFile, firstExtRaw);
    const firstExt = firstExtRaw.toLowerCase().replace(".", "");

    // 5. Alle zum gleichen Basisnamen gehörenden Dateien (case-insensitive)
    const fileMap: Record<string, string> = {};
    for (const f of files) {
      const ext = path.extname(f).toLowerCase().replace(".", "");
      const base = path.basename(f, path.extname(f)).toLowerCase();
      if (base === baseName.toLowerCase()) {
        fileMap[ext] = f;
      }
    }

    // 6. Bildtyp bestimmen
    const bildTyp = ["mov", "mp4"].includes(firstExt) ? "video" : "foto";

    // 7. EXIF-Daten lesen
    let exifResult = {
      aufnahmedatum: "",
      aufnahmezeit:  "",
      blende:        "",
      belichtung:    "",
      brennweite:    "",
      iso:           "",
      kamera:        "",
      gpsBreite:     0,
      gpsLaenge:     0,
      gpsHoehe:      0,
      gpsRichtung:   -1,   // -1 = kein Wert; 0–360 = Kamerarichtung (Grad von Nord)
      bdatum:        "",
    };

    // Datei-Priorität für EXIF: erst JPG, dann RAW-Formate
    const EXIF_PRIORITY = ["jpg", "jpeg", "cr3", "cr2", "hif", "dng", "nef", "arw", "raf"];
    const exifKey = bildTyp === "foto"
      ? EXIF_PRIORITY.find((k) => fileMap[k])
      : undefined;

    if (exifKey) {
      const imagePath = path.join(ZUVERARBEITEN_PATH, fileMap[exifKey]);
      console.log("[EXIF] Lese EXIF aus:", imagePath);
      try {
        // Buffer einlesen (exifr kann im Next.js-Server-Kontext
        // keine Dateipfade direkt öffnen → Buffer übergeben)
        const buffer = fs.readFileSync(imagePath);
        const exif = await exifr.parse(buffer, true);

        if (exif) {
          // Debug: relevante EXIF-Felder in der Konsole ausgeben
          console.log("[EXIF Debug]", {
            datei:              fileMap[exifKey],
            DateTimeOriginal:   exif.DateTimeOriginal,
            CreateDate:         exif.CreateDate,
            DateTime:           exif.DateTime,
            latitude:           exif.latitude,
            longitude:          exif.longitude,
            GPSLatitude:        exif.GPSLatitude,
            GPSLongitude:       exif.GPSLongitude,
            GPSLatitudeRef:     exif.GPSLatitudeRef,
            GPSLongitudeRef:    exif.GPSLongitudeRef,
            GPSAltitude:        exif.GPSAltitude,
            GPSImgDirection:    exif.GPSImgDirection,
            GPSImgDirectionRef: exif.GPSImgDirectionRef,
            Model:              exif.Model,
            Make:               exif.Make,
          });

          // ── Datum & Zeit ────────────────────────────────────────────
          // exifr kann Date-Objekte oder ISO-Strings liefern
          const rawDate =
            exif.DateTimeOriginal ??
            exif.CreateDate ??
            exif.DateTime ??
            null;

          let aufnahmeDate: Date | null = null;
          if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
            aufnahmeDate = rawDate;
          } else if (typeof rawDate === "string" && rawDate.trim()) {
            // EXIF-Format: "YYYY:MM:DD HH:MM:SS"
            const normalized = rawDate.trim().replace(
              /^(\d{4}):(\d{2}):(\d{2})/,
              "$1-$2-$3"
            );
            const parsed = new Date(normalized);
            if (!isNaN(parsed.getTime())) aufnahmeDate = parsed;
          }

          if (aufnahmeDate) {
            exifResult.aufnahmedatum = formatIsoDate(aufnahmeDate);
            exifResult.aufnahmezeit  = formatTime(aufnahmeDate);
            exifResult.bdatum        = formatBdatum(aufnahmeDate);
          }

          // ── Belichtungsparameter ────────────────────────────────────
          if (exif.FNumber) {
            exifResult.blende = `F/${exif.FNumber}`;
          }

          if (exif.ExposureTime) {
            const et = exif.ExposureTime as number;
            exifResult.belichtung =
              et >= 1 ? `${et}s` : `1/${Math.round(1 / et)}s`;
          }

          if (exif.FocalLength) {
            exifResult.brennweite = `${exif.FocalLength}mm`;
          }

          const iso = exif.ISO ?? exif.ISOSpeedRatings ?? exif.PhotographicSensitivity;
          if (iso != null) {
            exifResult.iso = String(iso);
          }

          // ── Kamera ─────────────────────────────────────────────────
          const model = exif.Model ?? exif.Make;
          if (model) {
            exifResult.kamera = String(model).trim();
          }

          // ── GPS ─────────────────────────────────────────────────────
          // exifr liefert bei gps:true direkt latitude/longitude als Dezimalgrad
          if (typeof exif.latitude === "number" && !isNaN(exif.latitude)) {
            exifResult.gpsBreite = exif.latitude;
          } else if (Array.isArray(exif.GPSLatitude)) {
            // Manuelles Fallback: [Grad, Minuten, Sekunden]
            const [g, m, s] = exif.GPSLatitude as number[];
            const dec = g + m / 60 + s / 3600;
            exifResult.gpsBreite =
              exif.GPSLatitudeRef === "S" ? -dec : dec;
          }

          if (typeof exif.longitude === "number" && !isNaN(exif.longitude)) {
            exifResult.gpsLaenge = exif.longitude;
          } else if (Array.isArray(exif.GPSLongitude)) {
            const [g, m, s] = exif.GPSLongitude as number[];
            const dec = g + m / 60 + s / 3600;
            exifResult.gpsLaenge =
              exif.GPSLongitudeRef === "W" ? -dec : dec;
          }

          if (typeof exif.GPSAltitude === "number" && !isNaN(exif.GPSAltitude)) {
            exifResult.gpsHoehe = exif.GPSAltitude;
          }

          // ── Kamerarichtung (Blickrichtung) ──────────────────────────
          // GPSImgDirection: 0° = Nord, 90° = Ost, 180° = Süd, 270° = West
          if (
            typeof exif.GPSImgDirection === "number" &&
            !isNaN(exif.GPSImgDirection)
          ) {
            exifResult.gpsRichtung = exif.GPSImgDirection % 360;
          }
        }
      } catch (exifError) {
        // EXIF-Fehler ist nicht kritisch – weiter ohne Daten
        console.warn("EXIF-Fehler (wird ignoriert):", exifError);
      }
    }

    // 8. Nächste bnummer ermitteln
    const [maxResult] = await db
      .select({ max: max(fdFotodatenbank.bnummer) })
      .from(fdFotodatenbank);
    const bnummer = Number(maxResult?.max ?? 0) + 1;

    // 9. Reverse-Geocoding via Nominatim (nur wenn GPS vorhanden)
    let geoLand = "";
    let geoOrt  = "";

    if (exifResult.gpsBreite !== 0 || exifResult.gpsLaenge !== 0) {
      try {
        const nominatimUrl =
          `https://nominatim.openstreetmap.org/reverse` +
          `?lat=${exifResult.gpsBreite}&lon=${exifResult.gpsLaenge}` +
          `&format=json&accept-language=de`;

        const geoRes = await fetch(nominatimUrl, {
          headers: {
            "User-Agent": "FranksFotos/1.0 (frank@brueckenweb.de)",
            "Accept-Language": "de",
          },
          signal: AbortSignal.timeout(5000), // 5 s Timeout
        });

        if (geoRes.ok) {
          const geoJson = await geoRes.json() as {
            address?: {
              country?: string;
              city?: string;
              town?: string;
              village?: string;
              municipality?: string;
              suburb?: string;
              county?: string;
            };
          };
          const addr = geoJson.address ?? {};
          geoLand = addr.country ?? "";
          geoOrt  =
            addr.city ??
            addr.town ??
            addr.village ??
            addr.municipality ??
            addr.suburb ??
            addr.county ??
            "";
          console.log("[Geo]", { geoLand, geoOrt });
        }
      } catch (geoError) {
        // Geocoding-Fehler ist nicht kritisch – weiter ohne
        console.warn("[Geo] Fehler (wird ignoriert):", geoError);
      }
    }

    // 10. Letzten Eintrag für Vorgabewerte (Land, Ort, Fotograf, Titel)
    const [letzterEintrag] = await db
      .select({
        land:     fdFotodatenbank.land,
        ort:      fdFotodatenbank.ort,
        fotograf: fdFotodatenbank.fotograf,
        titel:    fdFotodatenbank.titel,
      })
      .from(fdFotodatenbank)
      .orderBy(desc(fdFotodatenbank.bnummer))
      .limit(1);

    // 11. Letzte verwendete Fotogruppe aus fd_fotogruppenverkn
    const [letzteGruppe] = await db
      .select({ idfgruppe: fdFotogruppenverkn.idfgruppe })
      .from(fdFotogruppenverkn)
      .orderBy(desc(fdFotogruppenverkn.bnummer))
      .limit(1);

    return NextResponse.json({
      bnummer,
      baseName,
      bildTyp,
      files,
      fileMap,
      exif:            exifResult,
      letzterEintrag:  letzterEintrag ?? null,
      letzteIdfgruppe: letzteGruppe?.idfgruppe ?? null,
      geoLand,
      geoOrt,
    });
  } catch (error) {
    console.error("Scan-Fehler:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
