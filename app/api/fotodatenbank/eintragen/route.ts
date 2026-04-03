/**
 * API-Route: Foto in fd_fotodatenbank eintragen + Dateien auf Server speichern
 * POST /api/fotodatenbank/eintragen  (multipart/form-data)
 * Nur für isMainAdmin zugänglich
 *
 * Die Dateien werden vom Client (Browser) per Upload geschickt –
 * kein direkter Zugriff auf den lokalen Eingangsordner mehr.
 */

import { NextRequest, NextResponse } from "next/server";
import Busboy from "busboy";
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

// Nur noch der fotos/-Ordner liegt auf dem Server
const BASE_PATH  = process.env.FS_FOTODATENBANK_PATH ?? "/tmp/FS_Fotodatenbank";
const FOTOS_PATH = path.join(BASE_PATH, "fotos");

const BRUECKEN_UPLOAD_ENDPOINT =
  process.env.BRUECKEN_UPLOAD_PHP_ENDPOINT ?? "";

function getHeuteDatum(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDate(s: string): Date {
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? getHeuteDatum() : d;
}

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isValidTime(s: string): boolean {
  return /^\d{2}:\d{2}:\d{2}$/.test(s);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  // ── Request-Infos loggen ──────────────────────────────────────────────────
  const contentType   = request.headers.get("content-type")   ?? "";
  const contentLength = request.headers.get("content-length") ?? "?";
  console.log("📥 [eintragen] Request:", { contentType, contentLength, url: request.url });

  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Ungültiger Content-Type", details: `Erwartet: multipart/form-data, erhalten: ${contentType}` },
      { status: 400 }
    );
  }

  // ── Multipart-Body direkt mit busboy streamen (umgeht Next.js 4MB-Limit) ──
  const fields:        Record<string, string> = {};
  const uploadedFiles: Record<string, Buffer> = {};

  try {
    await new Promise<void>((resolve, reject) => {
      const bb = Busboy({
        headers: { "content-type": contentType },
        limits:  { fileSize: 600 * 1024 * 1024 }, // 600 MB max
      });

      bb.on("field", (name: string, value: string) => {
        fields[name] = value;
      });

      bb.on("file", (name: string, fileStream: NodeJS.ReadableStream) => {
        const chunks: Buffer[] = [];
        fileStream.on("data", (chunk: Buffer) => chunks.push(chunk));
        fileStream.on("end",  () => {
          if (chunks.length > 0) uploadedFiles[name] = Buffer.concat(chunks);
        });
        fileStream.on("error", reject);
      });

      bb.on("finish", resolve);
      bb.on("error",  reject);

      if (!request.body) {
        reject(new Error("Request hat keinen Body"));
        return;
      }
      // request.body ist ein Web ReadableStream → byteweise an busboy schreiben
      const reader = request.body.getReader();
      const pump   = async () => {
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) { bb.end(); break; }
            bb.write(value);
          }
        } catch (err) {
          reject(err);
        }
      };
      pump();
    });
    console.log("✅ [eintragen] busboy OK – Felder:", Object.keys(fields), "| Dateien:", Object.keys(uploadedFiles));
  } catch (parseErr) {
    console.error("❌ [eintragen] busboy Fehler:", parseErr);
    return NextResponse.json(
      { error: "Fehler beim Parsen des Uploads", details: String(parseErr) },
      { status: 400 }
    );
  }

  const g = (key: string) => String(fields[key] ?? "");

  const bnummer = Number(g("bnummer"));
  if (!bnummer || isNaN(bnummer)) {
    return NextResponse.json({ error: "Ungültige Bildnummer" }, { status: 400 });
  }

  const land           = g("land");
  const ort            = g("ort");
  const titel          = g("titel");
  const bdatum         = g("bdatum");
  const aufnahmedatum  = g("aufnahmedatum");
  const aufnahmezeit   = g("aufnahmezeit");
  const bnegativnr     = g("bnegativnr") || "digital";
  const bart           = g("bart").substring(0, 3);
  const pfad           = g("pfad");
  const kamera         = g("kamera");
  const blende         = g("blende");
  const belichtung     = g("belichtung");
  const brennweite     = g("brennweite");
  const iso            = g("iso");
  const fotograf       = g("fotograf");
  const bas            = g("bas") || "0";
  const basfgruppe     = g("basfgruppe") || "Sonstige";
  const idfgruppe      = g("idfgruppe") || null;
  const gpsbreite      = parseFloat(g("gpsbreite")) || 0;
  const gpslaenge      = parseFloat(g("gpslaenge")) || 0;
  const gpshoehe       = parseFloat(g("gpshoehe"))  || 0;
  const bastitel       = g("bastitel");
  const basreihenfolge = Number(g("basreihenfolge")) || 5;

  const galerieUebernehmen  = g("galerieUebernehmen") === "true";
  const galerieAlbumId      = g("galerieAlbumId") ? Number(g("galerieAlbumId")) : null;
  const galerieBeschreibung = g("galerieBeschreibung") || null;
  const galeriePrivat       = g("galeriePrivat") === "true";

  let galerieGruppenIds: number[] = [];
  try { galerieGruppenIds = JSON.parse(g("galerieGruppenIds") || "[]"); } catch { /* leer */ }

  let galerieTagIds: number[] = [];
  try { galerieTagIds = JSON.parse(g("galerieTagIds") || "[]"); } catch { /* leer */ }

  if (Object.keys(uploadedFiles).length === 0) {
    return NextResponse.json(
      { error: "Keine Datei hochgeladen" },
      { status: 400 }
    );
  }

  try {
    // 1. Zielpfad anlegen
    const newpath   = Math.floor(bnummer / 10000) + "bilder";
    const pfadFinal = pfad || newpath;
    const zielordner = path.join(FOTOS_PATH, pfadFinal);
    fs.mkdirSync(zielordner, { recursive: true });

    // 2. Dateien auf Disk speichern  (Feldname = Extension, Ziel = B{nr}.EXT)
    const SAVE_MAP: Array<[string[], string]> = [
      [["jpg", "jpeg", "dsc"], ".jpg"],
      [["cr2"],                ".CR2"],
      [["cr3"],                ".CR3"],
      [["hif"],                ".HIF"],
      [["dng"],                ".dng"],
      [["mov"],                ".mov"],
      [["mp4"],                ".mp4"],
      [["thm"],                ".THM"],
    ];

    const moveErrors: string[] = [];
    for (const [keys, destExt] of SAVE_MAP) {
      for (const key of keys) {
        const buf = uploadedFiles[key];
        if (buf) {
          const destPath = path.join(zielordner, `B${bnummer}${destExt}`);
          try {
            fs.writeFileSync(destPath, buf);
          } catch (err) {
            moveErrors.push(`${key}→${destExt}: ${String(err)}`);
          }
          break; // Nur erste Variante pro Format
        }
      }
    }

    // 3. JPG-Buffer für BAS + Galerie
    const jpgBuffer =
      uploadedFiles["jpg"] ?? uploadedFiles["jpeg"] ?? uploadedFiles["dsc"];
    const destJpgPath = path.join(zielordner, `B${bnummer}.jpg`);

    // 4. Datum validieren
    const safeDatumDate = isValidDate(aufnahmedatum)
      ? parseDate(aufnahmedatum)
      : getHeuteDatum();
    const safeZeit = isValidTime(aufnahmezeit) ? aufnahmezeit : "00:00:00";

    // 5. Eintrag in fd_fotodatenbank
    await db.insert(fdFotodatenbank).values({
      bnummer,
      land, ort, titel, bdatum,
      aufnahmedatum:    safeDatumDate,
      aufnahmezeit:     safeZeit,
      bnegativnr, bart,
      pfad:             pfadFinal,
      gpsB:             String(gpsbreite),
      gpsL:             String(gpslaenge),
      gpsH:             String(gpshoehe),
      gpsDatum:         "",
      kamera, blende,
      belichtungsdauer: belichtung,
      brennweite, iso, fotograf,
      bas:              bas !== "" ? bas : "0",
      eingetragen:      getHeuteDatum(),
    });

    // 6. Fotogruppen-Verknüpfung
    if (idfgruppe) {
      const [gruppe] = await db
        .select({ name: fdFotogruppen.name })
        .from(fdFotogruppen)
        .where(eq(fdFotogruppen.idfgruppe, Number(idfgruppe)));

      await db.insert(fdFotogruppenverkn).values({
        bnummer,
        idfgruppe:   Number(idfgruppe),
        fotogruppe:  gruppe?.name ?? "",
        eingetragen: new Date(),
      });
    }

    // 7. BAS-Eintrag in brueckenweb-DB
    if (bas && bas !== "0" && bas !== "" && jpgBuffer) {
      const baslink = `BAS${bas}_B${bnummer}.jpg`;
      try {
        let basPath = "bilder171";
        try {
          const lastBilderRaw = await brueckenDb.execute(
            sql.raw(`SELECT path FROM bilder ORDER BY listennr DESC LIMIT 1`)
          );
          const rows = Array.isArray(lastBilderRaw)
            ? (Array.isArray(lastBilderRaw[0])
                ? (lastBilderRaw[0] as unknown as Record<string, unknown>[])
                : (lastBilderRaw   as unknown as Record<string, unknown>[]))
            : [];
          if (rows.length > 0 && rows[0].path) basPath = String(rows[0].path);
        } catch (e) {
          console.warn("Konnte aktuellen bilder-Pfad nicht ermitteln:", e);
        }

        if (BRUECKEN_UPLOAD_ENDPOINT) {
          const resizedBuffer = await sharp(jpgBuffer)
            .resize(800, undefined, { withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();

          const fd2 = new FormData();
          fd2.append("file", new Blob([new Uint8Array(resizedBuffer)], { type: "image/jpeg" }), baslink);
          fd2.append("path",     basPath);
          fd2.append("filename", baslink);

          const uploadRes = await fetch(BRUECKEN_UPLOAD_ENDPOINT, { method: "POST", body: fd2 });
          if (!uploadRes.ok) {
            const err = await uploadRes.text().catch(() => uploadRes.statusText);
            console.error(`BAS-Upload fehlgeschlagen (${uploadRes.status}): ${err}`);
          }
        } else {
          console.warn("BRUECKEN_UPLOAD_PHP_ENDPOINT nicht gesetzt – BAS-Bild nicht hochgeladen");
        }

        const rechte       = `brueckenweb.de / ${fotograf}`;
        const basFgroupSafe = basfgruppe.replace(/'/g, "\\'");
        const bastitelSafe  = bastitel.replace(/'/g, "\\'");
        const rechteSafe    = rechte.replace(/'/g, "\\'");
        await brueckenDb.execute(sql.raw(
          `INSERT INTO bilder (brueckennummer, path, link, reihenfolge, rechte, datum, titel, nutzid, mid, aktiv, fotogruppe)
           VALUES ('${bas}', '${basPath}', '${baslink}', ${basreihenfolge}, '${rechteSafe}', '${bdatum}', '${bastitelSafe}', 3, 1, 'wartend', '${basFgroupSafe}')`
        ));
      } catch (basErr) {
        console.error("BAS bilder-Eintrag Fehler (nicht kritisch):", basErr);
      }
    }

    // 8. Fotogalerie-Upload (optional)
    let galeriePhotoId: number | null = null;
    let galerieError:   string | null = null;

    if (galerieUebernehmen && fs.existsSync(destJpgPath)) {
      try {
        const resizedBuffer = await sharp(destJpgPath)
          .resize(2000, undefined, { withoutEnlargement: true })
          .jpeg({ quality: 90 })
          .toBuffer();

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
        const phpEndpoint = UPLOAD_CONFIG.phpEndpoint;

        const uploadRes = await fetch(phpEndpoint, {
          method: "POST",
          headers: {
            "X-API-Key":      process.env.UPLOAD_API_KEY ?? "",
            "X-Upload-Path":  phpPath,
            "X-Upload-Name":  galFilename,
            "Content-Type":   "image/jpeg",
            "Content-Length": String(resizedBuffer.length),
          },
          body: new Uint8Array(resizedBuffer).buffer as ArrayBuffer,
        });

        if (!uploadRes.ok) throw new Error(`PHP-Upload fehlgeschlagen: ${uploadRes.status}`);

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

        if (galerieGruppenIds.length > 0) {
          await db.insert(photoGroupVisibility).values(
            galerieGruppenIds.map((gid) => ({ photoId: inserted.id, groupId: gid }))
          );
        }
        if (galerieTagIds.length > 0) {
          await db.insert(photoTags).values(
            galerieTagIds.map((tid) => ({ photoId: inserted.id, tagId: tid }))
          );
        }
      } catch (gErr) {
        galerieError = String(gErr);
        console.error("Galerie-Upload Fehler (nicht kritisch):", gErr);
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
