/**
 * API: GPX-Tracks für ein Album
 * GET /api/gpx/album/[albumId]  → alle Tracks zu einem Album (für eingeloggte User)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fdGpx, users } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

type Params = { params: Promise<{ albumId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const { albumId } = await params;
  const id = parseInt(albumId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige Album-ID" }, { status: 400 });

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
        gpxUrl:       fdGpx.gpxUrl,
        gpxDateiname: fdGpx.gpxDateiname,
        eingetragen:  fdGpx.eingetragen,
        userName:     users.name,
      })
      .from(fdGpx)
      .leftJoin(users, eq(fdGpx.userId, users.id))
      .where(eq(fdGpx.albumId, id))
      .orderBy(asc(fdGpx.datumTour), asc(fdGpx.eingetragen));

    return NextResponse.json({ tracks: rows });
  } catch (err) {
    console.error("[GPX album GET]", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
