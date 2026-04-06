/**
 * API: GPX-Track – Einzeleintrag
 * GET    /api/gpx/[id]  → Track laden (Admin oder berechtigter Albumzugriff)
 * PUT    /api/gpx/[id]  → Metadaten oder GPX-URL aktualisieren (Admin)
 * DELETE /api/gpx/[id]  → Track löschen (Admin)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fdGpx, albums, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

// ── GET ──────────────────────────────────────────────────────────────
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const { id } = await params;
  const trackId = parseInt(id, 10);
  if (isNaN(trackId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const rows = await db
      .select({
        id:           fdGpx.id,
        titel:        fdGpx.titel,
        beschreibung: fdGpx.beschreibung,
        typ:          fdGpx.typ,
        land:         fdGpx.land,
        laengeKm:     fdGpx.laengeKm,
        hoehmAuf:     fdGpx.hoehmAuf,
        datumTour:    fdGpx.datumTour,
        albumId:      fdGpx.albumId,
        albumName:    albums.name,
        albumSlug:    albums.slug,
        gpxDateiname: fdGpx.gpxDateiname,
        gpxUrl:       fdGpx.gpxUrl,
        eingetragen:  fdGpx.eingetragen,
        userId:       fdGpx.userId,
        userName:     users.name,
      })
      .from(fdGpx)
      .leftJoin(albums, eq(fdGpx.albumId, albums.id))
      .leftJoin(users,  eq(fdGpx.userId,  users.id))
      .where(eq(fdGpx.id, trackId))
      .limit(1);

    if (!rows[0]) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error("[GPX GET single]", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// ── PUT ──────────────────────────────────────────────────────────────
export async function PUT(request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { id } = await params;
  const trackId = parseInt(id, 10);
  if (isNaN(trackId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const body = await request.json();
    const {
      titel, beschreibung, typ, land,
      laengeKm, hoehmAuf, datumTour,
      albumId, gpxDateiname, gpxUrl,
    } = body;

    const updateData: Record<string, unknown> = {};
    if (titel        !== undefined) updateData.titel        = titel?.trim() ?? "";
    if (beschreibung !== undefined) updateData.beschreibung = beschreibung?.trim() ?? null;
    if (typ          !== undefined) updateData.typ          = typ;
    if (land         !== undefined) updateData.land         = land?.trim() ?? null;
    if (laengeKm     !== undefined) updateData.laengeKm     = laengeKm ? String(laengeKm) : null;
    if (hoehmAuf     !== undefined) updateData.hoehmAuf     = hoehmAuf ? parseInt(String(hoehmAuf), 10) : null;
    if (datumTour    !== undefined) updateData.datumTour    = datumTour ? new Date(datumTour) : null;
    if (albumId      !== undefined) updateData.albumId      = albumId   ? parseInt(String(albumId), 10) : null;
    if (gpxDateiname !== undefined) updateData.gpxDateiname = gpxDateiname ?? "";
    if (gpxUrl       !== undefined) updateData.gpxUrl       = gpxUrl?.trim() ?? "";

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Keine Felder zum Aktualisieren" }, { status: 400 });
    }

    await db.update(fdGpx).set(updateData).where(eq(fdGpx.id, trackId));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[GPX PUT]", err);
    return NextResponse.json({ error: "Aktualisierung fehlgeschlagen" }, { status: 500 });
  }
}

// ── DELETE ───────────────────────────────────────────────────────────
export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { id } = await params;
  const trackId = parseInt(id, 10);
  if (isNaN(trackId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    await db.delete(fdGpx).where(eq(fdGpx.id, trackId));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[GPX DELETE]", err);
    return NextResponse.json({ error: "Löschen fehlgeschlagen" }, { status: 500 });
  }
}
