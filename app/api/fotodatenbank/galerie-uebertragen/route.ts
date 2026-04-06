/**
 * API-Route: Bestehendes Fotodatenbank-Foto in die Fotogalerie übertragen
 * POST /api/fotodatenbank/galerie-uebertragen
 *
 * Body (JSON):
 *   bnummer, galerieJpgBase64, albumId?, beschreibung?, privat?, gruppenIds?, tagIds?
 *
 * Nur für isMainAdmin zugänglich.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fdFotodatenbank, photos, photoGroupVisibility, photoTags, albums } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { UPLOAD_CONFIG } from "@/lib/upload/config";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }

  const bnummer          = Number(body.bnummer);
  const galerieJpgBase64 = String(body.galerieJpgBase64 ?? "");
  const albumId          = body.albumId ? Number(body.albumId) : null;
  const beschreibung     = body.beschreibung ? String(body.beschreibung) : null;
  const privat           = body.privat === true;
  const gruppenIds: number[] = Array.isArray(body.gruppenIds) ? (body.gruppenIds as number[]).map(Number).filter(Boolean) : [];
  const tagIds:     number[] = Array.isArray(body.tagIds)     ? (body.tagIds     as number[]).map(Number).filter(Boolean) : [];

  if (!bnummer || isNaN(bnummer)) {
    return NextResponse.json({ error: "Ungültige bnummer" }, { status: 400 });
  }
  if (!galerieJpgBase64) {
    return NextResponse.json({ error: "galerieJpgBase64 fehlt" }, { status: 400 });
  }

  try {
    // Fotodatenbank-Eintrag laden (für Titel, Fotograf etc.)
    const [fdEintrag] = await db
      .select({
        titel:            fdFotodatenbank.titel,
        fotograf:         fdFotodatenbank.fotograf,
        land:             fdFotodatenbank.land,
        ort:              fdFotodatenbank.ort,
        aufnahmedatum:    fdFotodatenbank.aufnahmedatum,
        aufnahmezeit:     fdFotodatenbank.aufnahmezeit,
        kamera:           fdFotodatenbank.kamera,
        blende:           fdFotodatenbank.blende,
        belichtungsdauer: fdFotodatenbank.belichtungsdauer,
        brennweite:       fdFotodatenbank.brennweite,
        iso:              fdFotodatenbank.iso,
        gpsB:             fdFotodatenbank.gpsB,
        gpsL:             fdFotodatenbank.gpsL,
        gpsH:             fdFotodatenbank.gpsH,
      })
      .from(fdFotodatenbank)
      .where(eq(fdFotodatenbank.bnummer, bnummer));

    if (!fdEintrag) {
      return NextResponse.json({ error: `Eintrag B${bnummer} nicht gefunden` }, { status: 404 });
    }

    const galerieBuffer = Buffer.from(galerieJpgBase64, "base64");

    // Album-Slug ermitteln
    let albumSlug = "";
    if (albumId) {
      const [albumRow] = await db
        .select({ slug: albums.slug })
        .from(albums)
        .where(eq(albums.id, albumId));
      albumSlug = albumRow?.slug ?? "";
    }

    const phpPath    = albumSlug ? `fotos/${albumSlug}` : "fotos";
    const galFilename = `B${bnummer}.jpg`;
    const phpEndpoint = UPLOAD_CONFIG.phpEndpoint;

    // Upload an PHP-Endpoint
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

    // EXIF-Daten aus FD-Eintrag
    const exifData: Record<string, unknown> = {};
    if (fdEintrag.aufnahmedatum) {
      const d = fdEintrag.aufnahmedatum instanceof Date
        ? fdEintrag.aufnahmedatum.toISOString().split("T")[0]
        : String(fdEintrag.aufnahmedatum).split("T")[0];
      exifData.DateTimeOriginal = fdEintrag.aufnahmezeit ? `${d}T${fdEintrag.aufnahmezeit}` : d;
    }
    if (fdEintrag.kamera)           exifData.Model       = fdEintrag.kamera;
    if (fdEintrag.blende)           { const m = fdEintrag.blende.match(/^[Ff]\/?([\d.]+)/); exifData.FNumber = m ? parseFloat(m[1]) : fdEintrag.blende; }
    if (fdEintrag.belichtungsdauer) exifData.ExposureTime = fdEintrag.belichtungsdauer;
    if (fdEintrag.iso)              { const n = parseInt(fdEintrag.iso, 10); exifData.ISO = isNaN(n) ? fdEintrag.iso : n; }
    if (fdEintrag.brennweite)       exifData.FocalLength  = fdEintrag.brennweite;
    if (fdEintrag.fotograf)         exifData.Copyright    = fdEintrag.fotograf;
    const lat = parseFloat(fdEintrag.gpsB ?? "");
    const lon = parseFloat(fdEintrag.gpsL ?? "");
    const alt = parseFloat(fdEintrag.gpsH ?? "");
    if (!isNaN(lat) && lat !== 0) exifData.latitude  = lat;
    if (!isNaN(lon) && lon !== 0) exifData.longitude = lon;
    if (!isNaN(alt) && alt !== 0) exifData.GPSAltitude = alt;

    const userId = Number((session!.user as { id: string }).id);

    const [inserted] = await db.insert(photos).values({
      albumId:      albumId,
      filename:     actualFileName,
      title:        fdEintrag.titel || null,
      description:  beschreibung,
      fileUrl,
      thumbnailUrl: thumbnailUrl ?? null,
      exifData:     Object.keys(exifData).length > 0 ? exifData : null,
      isPrivate:    privat,
      sortOrder:    0,
      bnummer:      `B${bnummer}`,
      createdBy:    userId,
    }).$returningId();

    const photoId = inserted.id;

    if (gruppenIds.length > 0) {
      await db.insert(photoGroupVisibility).values(
        gruppenIds.map((gid) => ({ photoId, groupId: gid }))
      );
    }
    if (tagIds.length > 0) {
      await db.insert(photoTags).values(
        tagIds.map((tid) => ({ photoId, tagId: tid }))
      );
    }

    return NextResponse.json({ success: true, photoId, fileUrl, thumbnailUrl });
  } catch (err) {
    console.error("galerie-uebertragen Fehler:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
