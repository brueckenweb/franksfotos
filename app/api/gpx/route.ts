/**
 * API: GPX-Tracks – Liste & Upload
 * GET  /api/gpx  → alle Tracks (paginiert, nur Admin)
 * POST /api/gpx  → neuen Track anlegen (nur Admin)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fdGpx, albums, users } from "@/lib/db/schema";
import { eq, desc, like, or, count } from "drizzle-orm";

// ── GET ──────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q      = (searchParams.get("q") ?? "").trim();
  const seite  = Math.max(1, parseInt(searchParams.get("seite") ?? "1", 10));
  const limit  = Math.min(100, parseInt(searchParams.get("limit") ?? "25", 10));
  const offset = (seite - 1) * limit;

  try {
    const whereClause = q
      ? or(
          like(fdGpx.titel, `%${q}%`),
          like(fdGpx.land,  `%${q}%`),
          like(fdGpx.beschreibung, `%${q}%`)
        )
      : undefined;

    const [rows, totalRows] = await Promise.all([
      db
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
        .where(whereClause)
        .orderBy(desc(fdGpx.eingetragen))
        .limit(limit)
        .offset(offset),

      db
        .select({ cnt: count() })
        .from(fdGpx)
        .where(whereClause),
    ]);

    return NextResponse.json({
      tracks: rows,
      total:  totalRows[0]?.cnt ?? 0,
      seite,
      limit,
      seiten: Math.ceil((totalRows[0]?.cnt ?? 0) / limit),
    });
  } catch (err) {
    console.error("[GPX GET]", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// ── POST ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const userId = parseInt((session!.user as { id: string }).id, 10);

  try {
    const body = await request.json();
    const {
      titel, beschreibung, typ, land,
      laengeKm, hoehmAuf, datumTour,
      albumId, gpxDateiname, gpxUrl,
    } = body;

    if (!titel?.trim()) {
      return NextResponse.json({ error: "Titel fehlt" }, { status: 400 });
    }
    if (!gpxUrl?.trim()) {
      return NextResponse.json({ error: "GPX-URL fehlt" }, { status: 400 });
    }

    const [result] = await db.insert(fdGpx).values({
      titel:        titel.trim(),
      beschreibung: beschreibung?.trim() ?? null,
      typ:          typ ?? "Wanderung",
      land:         land?.trim() ?? null,
      laengeKm:     laengeKm ? String(laengeKm) : null,
      hoehmAuf:     hoehmAuf ? parseInt(String(hoehmAuf), 10) : null,
      datumTour:    datumTour ? new Date(datumTour) : null,
      albumId:      albumId  ? parseInt(String(albumId),  10) : null,
      gpxDateiname: gpxDateiname ?? "",
      gpxUrl:       gpxUrl.trim(),
      userId,
    });

    const insertId = (result as { insertId: number }).insertId;
    return NextResponse.json({ success: true, id: insertId }, { status: 201 });
  } catch (err) {
    console.error("[GPX POST]", err);
    return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 });
  }
}
