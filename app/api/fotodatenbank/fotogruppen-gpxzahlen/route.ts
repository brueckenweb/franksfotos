/**
 * API-Route: Anzahl GPX-Tracks pro Fotogruppe
 * GET /api/fotodatenbank/fotogruppen-gpxzahlen
 * Liefert: Record<idfgruppe, anzahlTracks>
 * Nur für isMainAdmin zugänglich.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fdGpx } from "@/lib/db/schema";
import { count, isNotNull } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  try {
    // Anzahl GPX-Tracks gruppiert nach fotogruppe_id
    const rows = await db
      .select({
        fotogruppeId: fdGpx.fotogruppeId,
        anzahl:       count(),
      })
      .from(fdGpx)
      .where(isNotNull(fdGpx.fotogruppeId))
      .groupBy(fdGpx.fotogruppeId);

    // Als Record<idfgruppe, count> zurückgeben
    const result: Record<string, number> = {};
    for (const row of rows) {
      if (row.fotogruppeId !== null) {
        result[String(row.fotogruppeId)] = row.anzahl;
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Fotogruppen-GPX-Zahlen-Fehler:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
