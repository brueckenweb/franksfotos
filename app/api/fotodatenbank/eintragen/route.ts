/**
 * API-Route: Foto in fd_fotodatenbank eintragen
 * POST /api/fotodatenbank/eintragen  (multipart/form-data)
 * Nur für isMainAdmin zugänglich
 *
 * NEU (lokaler Prozessor):
 *   Dateien werden NICHT mehr hochgeladen.
 *   Der lokale Node-Server (scripts/local-fotodatenbank.mjs) übernimmt:
 *     - Dateien umbenennen/verschieben (lokal)
 *     - JPG verkleinern (BAS: 800px, Galerie: 2000px)
 *   Diese Route empfängt nur noch:
 *     - Metadaten (Formularfelder)
 *     - basJpgBase64:     base64-JPG für BAS-Upload (optional, ~80 KB)
 *     - galerieJpgBase64: base64-JPG für Galerie (optional, ~1.5 MB)
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
import sharp from "sharp";
import { UPLOAD_CONFIG } from "@/lib/upload/config";

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

  // ── Formulardaten lesen (nur Metadaten + kleine base64-Strings) ────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (formErr) {
    console.error("❌ [eintragen] formData fehlgeschlagen:", formErr);
    return NextResponse.json(
      { error: "Ungültige Formulardaten", details: String(formErr) },
      { status: 400 }
    );
  }

  const g = (key: string) => String(formData.get(key) ?? "");

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

  // ── Base64-JPGs vom lokalen Prozessor ──────────────────────────────────────
  const basJpgBase64     = g("basJpgBase64")     || null; // ~80 KB
  const galerieJpgBase64 = g("galerieJpgBase64") || null; // ~1.5 MB

  const basBuffer     = basJpgBase64     ? Buffer.from(basJpgBase64,     "base64") : null;
  const galerieBuffer = galerieJpgBase64 ? Buffer.from(galerieJpgBase64, "base64") : null;

  const newpath   = Math.floor(bnummer / 10000) + "bilder";
  const pfadFinal = pfad || newpath;

  try {
    // 1. Eintrag in fd_fotodatenbank
    const safeDatumDate = isValidDate(aufnahmedatum) ? parseDate(aufnahmedatum) : getHeuteDatum();
    const safeZeit      = isValidTime(aufnahmezeit)  ? aufnahmezeit              : "00:00:00";

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

    // 2. Fotogruppen-Verknüpfung
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

    // 3. BAS-Upload zu brueckenweb.de
    if (bas && bas !== "0" && basBuffer) {
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
          // basBuffer kommt schon als 800px vom lokalen Prozessor
          const fd2 = new FormData();
          fd2.append("file", new Blob([new Uint8Array(basBuffer)], { type: "image/jpeg" }), baslink);
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

        const rechte        = `brueckenweb.de / ${fotograf}`;
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

    // 4. Fotogalerie-Upload (optional)
    let galeriePhotoId: number | null = null;
    let galerieError:   string | null = null;

    if (galerieUebernehmen && galerieBuffer) {
      try {
        // Galerie-Buffer kommt schon als 2000px vom lokalen Prozessor
        // Wir senden ihn direkt an den PHP-Upload-Endpoint
        let albumSlug = "";
        if (galerieAlbumId) {
          const [albumRow] = await db
            .select({ slug: albums.slug })
            .from(albums)
            .where(eq(albums.id, galerieAlbumId));
          albumSlug = albumRow?.slug ?? "";
        }
        const phpPath     = albumSlug ? `fotos/${albumSlug}` : "fotos";
        const galFilename = `B${bnummer}.jpg`;
        const phpEndpoint = UPLOAD_CONFIG.phpEndpoint;

        const uploadRes = await fetch(phpEndpoint, {
          method: "POST",
          headers: {
            "X-API-Key":      process.env.UPLOAD_API_KEY ?? "",
            "X-Upload-Path":  phpPath,
            "X-Upload-Name":  galFilename,
            "Content-Type":   "image/jpeg",
            "Content-Length": String(galerieBuffer.length),
          },
          body: new Uint8Array(galerieBuffer).buffer as ArrayBuffer,
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

        // ── EXIF-Daten aus den Fotodatenbank-Feldern zusammenstellen ──────────
        // Die ExifBox-Komponente erwartet Standard-EXIF-Feldnamen.
        const exifForGalerie: Record<string, unknown> = {};

        // Aufnahmedatum + Uhrzeit → ISO-String (ExifBox: DateTimeOriginal)
        if (aufnahmedatum) {
          exifForGalerie.DateTimeOriginal = aufnahmezeit
            ? `${aufnahmedatum}T${aufnahmezeit}`
            : aufnahmedatum;
        }

        // Kamera (ExifBox: [Make, Model].join(" ") – wir legen alles in Model)
        if (kamera) {
          exifForGalerie.Model = kamera;
        }

        // Blende: "f/2.8" → 2.8  (ExifBox zeigt "f/{FNumber}")
        if (blende) {
          const m = blende.match(/^f\/?([\d.]+)$/i);
          exifForGalerie.FNumber = m ? parseFloat(m[1]) : blende;
        }

        // Belichtungszeit: "1/500" – ExifBox zeigt "{ExposureTime} s"
        if (belichtung) {
          exifForGalerie.ExposureTime = belichtung;
        }

        // ISO
        if (iso) {
          const isoNum = parseInt(iso, 10);
          exifForGalerie.ISO = isNaN(isoNum) ? iso : isoNum;
        }

        // Brennweite (als zusätzliche Info)
        if (brennweite) {
          exifForGalerie.FocalLength = brennweite;
        }

        // GPS (Dezimalgrad → ExifBox nutzt latitude/longitude direkt)
        if (gpsbreite !== 0 || gpslaenge !== 0) {
          exifForGalerie.latitude  = gpsbreite;
          exifForGalerie.longitude = gpslaenge;
          if (gpshoehe !== 0) {
            exifForGalerie.GPSAltitude = gpshoehe;
          }
        }

        // Fotograf als Copyright
        if (fotograf) {
          exifForGalerie.Copyright = fotograf;
        }

        const exifDataForDb =
          Object.keys(exifForGalerie).length > 0 ? exifForGalerie : null;

        const userId = Number((session!.user as { id: string }).id);
        const [inserted] = await db.insert(photos).values({
          albumId:      galerieAlbumId,
          filename:     actualFileName,
          title:        titel || null,
          description:  galerieBeschreibung,
          fileUrl,
          thumbnailUrl: thumbnailUrl ?? null,
          exifData:     exifDataForDb,
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
      galeriePhotoId: galeriePhotoId ?? undefined,
      galerieError:   galerieError   ?? undefined,
    });
  } catch (error) {
    console.error("Eintragen-Fehler:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// Nicht mehr benötigt seit lokaler Prozessor – aber sharp bleibt als Dependency
// (wird für andere Teile der App genutzt)
void sharp;
