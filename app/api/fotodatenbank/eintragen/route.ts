/**
 * API-Route: Foto in fd_fotodatenbank eintragen + Dateien verschieben
 * POST /api/fotodatenbank/eintragen
 * Nur für isMainAdmin zugänglich
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  fdFotodatenbank,
  fdFotogruppenverkn,
  fdFotogruppen,
  photos,
  photoGroupVisibility,
  photoTags,
  albums,
} from "@/lib/db/schema";
import { brueckenDb } from "@/lib/db/brueckendb";
import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { UPLOAD_CONFIG } from "@/lib/upload/config";

const BASE_PATH =
  process.env.FS_FOTODATENBANK_PATH ?? "C:\\FS_Fotodatenbank";
const ZUVERARBEITEN_PATH = path.join(BASE_PATH, "zuverarbeiten");
const FOTOS_PATH = path.join(BASE_PATH, "fotos");

// brueckenweb bruecken-upload.php – multipart/form-data mit Feldern: file, path, filename
const BRUECKEN_UPLOAD_ENDPOINT =
  process.env.BRUECKEN_UPLOAD_PHP_ENDPOINT ?? "";

/** Heutiges Datum als JJJJ-MM-TT */
function getHeuteDatum(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** JJJJ-MM-TT als Date-Objekt parsen */
function parseDate(s: string): Date {
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? getHeuteDatum() : d;
}

/** Validiert Datumsformat JJJJ-MM-TT */
function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Validiert Zeitformat HH:MM:SS */
function isValidTime(s: string): boolean {
  return /^\d{2}:\d{2}:\d{2}$/.test(s);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfragedaten" }, { status: 400 });
  }

  const bnummer = Number(body.bnummer);
  if (!bnummer || isNaN(bnummer)) {
    return NextResponse.json({ error: "Ungültige Bildnummer" }, { status: 400 });
  }

  const land          = String(body.land ?? "");
  const ort           = String(body.ort ?? "");
  const titel         = String(body.titel ?? "");
  const bdatum        = String(body.bdatum ?? "");
  const aufnahmedatum = String(body.aufnahmedatum ?? "");
  const aufnahmezeit  = String(body.aufnahmezeit ?? "");
  const bnegativnr    = String(body.bnegativnr ?? "digital");
  const bart          = String(body.bart ?? "").substring(0, 3);
  const pfad          = String(body.pfad ?? "");
  const kamera        = String(body.kamera ?? "");
  const blende        = String(body.blende ?? "");
  const belichtung    = String(body.belichtung ?? "");
  const brennweite    = String(body.brennweite ?? "");
  const iso           = String(body.iso ?? "");
  const fotograf      = String(body.fotograf ?? "");
  const bas            = String(body.bas ?? "0");
  const basfgruppe     = String(body.basfgruppe ?? "Sonstige");
  const idfgruppe      = body.idfgruppe ? String(body.idfgruppe) : null;
  const gpsbreite     = Number(body.gpsbreite ?? 0);
  const gpslaenge     = Number(body.gpslaenge ?? 0);
  const gpshoehe      = Number(body.gpshoehe ?? 0);
  const bastitel      = String(body.bastitel ?? "");
  const basreihenfolge = Number(body.basreihenfolge ?? 5);
  const fileMap       = (body.fileMap as Record<string, string>) ?? {};

  // ── Fotogalerie-Parameter ─────────────────────────────────────────
  const galerieUebernehmen  = Boolean(body.galerieUebernehmen ?? false);
  const galerieAlbumId      = body.galerieAlbumId ? Number(body.galerieAlbumId) : null;
  const galerieBeschreibung = body.galerieBeschreibung ? String(body.galerieBeschreibung) : null;
  const galeriePrivat       = Boolean(body.galeriePrivat ?? false);
  const galerieGruppenIds: number[] = Array.isArray(body.galerieGruppenIds)
    ? (body.galerieGruppenIds as unknown[]).map(Number).filter((n) => !isNaN(n))
    : [];
  const galerieTagIds: number[] = Array.isArray(body.galerieTagIds)
    ? (body.galerieTagIds as unknown[]).map(Number).filter((n) => !isNaN(n))
    : [];

  try {
    // 1. Zielpfad berechnen und Ordner anlegen (wie PHP: floor(bnr/10000)+"bilder")
    const newpath = Math.floor(bnummer / 10000) + "bilder";
    const pfadFinal = pfad || newpath;
    const zielordner = path.join(FOTOS_PATH, pfadFinal);
    fs.mkdirSync(zielordner, { recursive: true });

    // 2. Prüfen ob eine Quelldatei existiert
    const jpgKey = Object.keys(fileMap).find((k) =>
      ["jpg", "jpeg", "dsc"].includes(k)
    );
    const movKey = fileMap["mov"] ? "mov" : null;
    const mp4Key = fileMap["mp4"] ? "mp4" : null;

    const jpgPath = jpgKey ? path.join(ZUVERARBEITEN_PATH, fileMap[jpgKey]) : null;
    const movPath = movKey ? path.join(ZUVERARBEITEN_PATH, fileMap[movKey]) : null;
    const mp4Path = mp4Key ? path.join(ZUVERARBEITEN_PATH, fileMap[mp4Key]) : null;

    const hasFile =
      (jpgPath && fs.existsSync(jpgPath)) ||
      (movPath && fs.existsSync(movPath)) ||
      (mp4Path && fs.existsSync(mp4Path));

    if (!hasFile) {
      return NextResponse.json(
        { error: "Keine Datei im zuverarbeiten-Ordner gefunden" },
        { status: 400 }
      );
    }

    // 3. Datum validieren (Fallback auf heute) – Drizzle date() braucht Date-Objekte
    const safeDatumDate = isValidDate(aufnahmedatum)
      ? parseDate(aufnahmedatum)
      : getHeuteDatum();
    const safeZeit = isValidTime(aufnahmezeit) ? aufnahmezeit : "00:00:00";

    // 4. Eintrag in fd_fotodatenbank
    await db.insert(fdFotodatenbank).values({
      bnummer,
      land,
      ort,
      titel,
      bdatum,
      aufnahmedatum: safeDatumDate,
      aufnahmezeit:  safeZeit,
      bnegativnr,
      bart,
      pfad: pfadFinal,
      gpsB:             String(gpsbreite),
      gpsL:             String(gpslaenge),
      gpsH:             String(gpshoehe),
      gpsDatum:         "",
      kamera,
      blende,
      belichtungsdauer: belichtung,
      brennweite,
      iso,
      fotograf,
      bas: bas !== "" ? bas : "0",
      eingetragen: getHeuteDatum(),
    });

    // 5. Fotogruppen-Verknüpfung
    if (idfgruppe) {
      const [gruppe] = await db
        .select({ name: fdFotogruppen.name })
        .from(fdFotogruppen)
        .where(eq(fdFotogruppen.idfgruppe, Number(idfgruppe)));

      await db.insert(fdFotogruppenverkn).values({
        bnummer,
        idfgruppe:  Number(idfgruppe),
        fotogruppe: gruppe?.name ?? "",
        eingetragen: new Date(),
      });
    }

    // 6. BAS-Eintrag in brueckenweb-DB (nur wenn BAS-Nummer angegeben und JPG vorhanden)
    if (bas && bas !== "0" && bas !== "" && jpgPath && fs.existsSync(jpgPath)) {
      const baslink = `BAS${bas}_B${bnummer}.jpg`;
      try {
        // Aktuellen Bilderpfad aus der brueckenweb-DB holen (neuester Eintrag)
        let basPath = "bilder171"; // Fallback
        try {
          const lastBilderRaw = await brueckenDb.execute(
            sql.raw(`SELECT path FROM bilder ORDER BY listennr DESC LIMIT 1`)
          );
          const lastBilderRows = Array.isArray(lastBilderRaw)
            ? (Array.isArray(lastBilderRaw[0])
                ? (lastBilderRaw[0] as unknown as Record<string, unknown>[])
                : (lastBilderRaw as unknown as Record<string, unknown>[]))
            : [];
          if (lastBilderRows.length > 0 && lastBilderRows[0].path) {
            basPath = String(lastBilderRows[0].path);
          }
        } catch (e) {
          console.warn("Konnte aktuellen bilder-Pfad nicht ermitteln:", e);
        }

        // Bild verkleinern und per Multipart-Upload zum bruecken-upload.php senden
        // Format: multipart/form-data mit Feldern file, path (z.B. bilder171), filename
        if (BRUECKEN_UPLOAD_ENDPOINT) {
          const resizedBuffer = await sharp(jpgPath)
            .resize(800, undefined, { withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();

          const formData = new FormData();
          formData.append("file", new Blob([new Uint8Array(resizedBuffer)], { type: "image/jpeg" }), baslink);
          formData.append("path",     basPath);   // z.B. "bilder171"
          formData.append("filename", baslink);   // z.B. "BAS115907_B1156345.jpg"

          const uploadRes = await fetch(BRUECKEN_UPLOAD_ENDPOINT, {
            method: "POST",
            body: formData,
          });

          if (!uploadRes.ok) {
            const uploadErr = await uploadRes.text().catch(() => uploadRes.statusText);
            console.error(`BAS-Bild-Upload fehlgeschlagen (${uploadRes.status}): ${uploadErr}`);
          } else {
            const uploadJson = await uploadRes.json().catch(() => null);
            if (uploadJson && !uploadJson.success) {
              console.error(`BAS-Bild-Upload-Fehler: ${uploadJson.error}`);
            }
          }
        } else {
          console.warn("BRUECKEN_UPLOAD_PHP_ENDPOINT nicht gesetzt – Bild nicht hochgeladen");
        }

        // Neuen Datensatz in brueckenweb bilder-Tabelle anlegen (aktiv = wartend)
        const rechte      = `brueckenweb.de / ${fotograf}`;
        const basFgroupSafe = basfgruppe.replace(/'/g, "\\'");
        const bastitelSafe  = bastitel.replace(/'/g, "\\'");
        const rechteSafe    = rechte.replace(/'/g, "\\'");
        await brueckenDb.execute(sql.raw(
          `INSERT INTO bilder (brueckennummer, path, link, reihenfolge, rechte, datum, titel, nutzid, mid, aktiv, fotogruppe)
           VALUES ('${bas}', '${basPath}', '${baslink}', ${basreihenfolge}, '${rechteSafe}', '${bdatum}', '${bastitelSafe}', 3, 1, 'wartend', '${basFgroupSafe}')`
        ));

      } catch (basErr) {
        // BAS-Fehler ist nicht kritisch – Foto wurde bereits eingetragen
        console.error("BAS bilder-Eintrag Fehler (nicht kritisch):", basErr);
      }
    }

    // 7. Dateien verschieben (exakt wie PHP)
    // Format: B{bnummer}.{Endung} im Zielordner
    const MOVE_MAP: Array<[string[], string]> = [
      [["jpg", "jpeg", "dsc"], ".jpg"],
      [["cr2"],                 ".CR2"],
      [["cr3"],                 ".CR3"],
      [["hif"],                 ".HIF"],
      [["dng"],                 ".dng"],
      [["mov"],                 ".mov"],
      [["mp4"],                 ".mp4"],
      [["thm"],                 ".THM"],
    ];

    const moveErrors: string[] = [];

    for (const [keys, destExt] of MOVE_MAP) {
      for (const key of keys) {
        const srcFile = fileMap[key] ?? fileMap[key.toUpperCase()];
        if (srcFile) {
          const srcPath  = path.join(ZUVERARBEITEN_PATH, srcFile);
          const destPath = path.join(zielordner, `B${bnummer}${destExt}`);
          if (fs.existsSync(srcPath)) {
            try {
              fs.renameSync(srcPath, destPath);
            } catch (err) {
              moveErrors.push(`${srcFile}: ${String(err)}`);
            }
            break; // Nur eine Variante pro Format verschieben
          }
        }
      }
    }

    // 8. Fotogalerie-Upload (optional, nicht kritisch)
    let galeriePhotoId: number | null = null;
    let galerieError:   string | null = null;

    if (galerieUebernehmen) {
      const destJpgPath = path.join(zielordner, `B${bnummer}.jpg`);
      if (fs.existsSync(destJpgPath)) {
        try {
          // a) Auf max. 2000 px Breite skalieren
          const resizedBuffer = await sharp(destJpgPath)
            .resize(2000, undefined, { withoutEnlargement: true })
            .jpeg({ quality: 90 })
            .toBuffer();

          // b) Album-Slug für Upload-Pfad ermitteln
          let albumSlug = "";
          if (galerieAlbumId) {
            const [albumRow] = await db
              .select({ slug: albums.slug })
              .from(albums)
              .where(eq(albums.id, galerieAlbumId));
            albumSlug = albumRow?.slug ?? "";
          }
          const phpPath    = albumSlug ? `fotos/${albumSlug}` : "fotos";
          const galFilename = `B${bnummer}.jpg`;

          // c) Upload via PHP-Endpoint (identisch zu /api/upload/route.ts)
          const phpEndpoint  = UPLOAD_CONFIG.phpEndpoint;
          const uploadBuffer = new Uint8Array(resizedBuffer).buffer as ArrayBuffer;
          const uploadRes    = await fetch(phpEndpoint, {
            method: "POST",
            headers: {
              "X-API-Key":      process.env.UPLOAD_API_KEY ?? "",
              "X-Upload-Path":  phpPath,
              "X-Upload-Name":  galFilename,
              "Content-Type":   "image/jpeg",
              "Content-Length": String(resizedBuffer.length),
            },
            body: uploadBuffer,
          });

          if (!uploadRes.ok) {
            throw new Error(`PHP-Upload fehlgeschlagen: ${uploadRes.status}`);
          }

          let phpResult: { fileName?: string; fileUrl?: string } = {};
          try { phpResult = await uploadRes.json(); } catch { /* ignore */ }

          const actualFileName = phpResult.fileName ?? galFilename;
          const target         = UPLOAD_CONFIG.targets.photos;
          const fileUrl        = phpResult.fileUrl ?? (
            albumSlug
              ? `${target.remote}${albumSlug}/${actualFileName}`
              : `${target.remote}${actualFileName}`
          );
          const thumbName    = actualFileName.replace(/\.[^/.]+$/, "_thumb.jpg");
          const thumbnailUrl = target.thumbnailPath
            ? (albumSlug
                ? `${target.thumbnailPath}${albumSlug}/${thumbName}`
                : `${target.thumbnailPath}${thumbName}`)
            : null;

          // d) In photos-Tabelle eintragen
          const userId = Number((session!.user as { id: string }).id);
          const [inserted] = await db.insert(photos).values({
            albumId:      galerieAlbumId,
            filename:     actualFileName,
            title:        titel || null,
            description:  galerieBeschreibung,
            fileUrl,
            thumbnailUrl: thumbnailUrl ?? null,
            isPrivate:    galeriePrivat,
            sortOrder:    0,
            bnummer:      `B${bnummer}`,
            createdBy:    userId,
          }).$returningId();

          galeriePhotoId = inserted.id;

          // e) Gruppenfreigaben (falls vorhanden)
          if (galerieGruppenIds.length > 0) {
            await db.insert(photoGroupVisibility).values(
              galerieGruppenIds.map((gid) => ({
                photoId: inserted.id,
                groupId: gid,
              }))
            );
          }

          // f) Tags verknüpfen (falls vorhanden)
          if (galerieTagIds.length > 0) {
            await db.insert(photoTags).values(
              galerieTagIds.map((tid) => ({
                photoId: inserted.id,
                tagId:   tid,
              }))
            );
          }
        } catch (gErr) {
          galerieError = String(gErr);
          console.error("Galerie-Upload Fehler (nicht kritisch):", gErr);
        }
      } else {
        galerieError = "JPG nach dem Verschieben nicht gefunden";
      }
    }

    return NextResponse.json({
      success:        true,
      bnummer,
      pfad:           pfadFinal,
      moveErrors:     moveErrors.length > 0 ? moveErrors : undefined,
      galeriePhotoId: galeriePhotoId ?? undefined,
      galerieError:   galerieError   ?? undefined,
    });
  } catch (error) {
    console.error("Eintragen-Fehler:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
