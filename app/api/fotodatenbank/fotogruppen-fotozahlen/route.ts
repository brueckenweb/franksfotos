/**
 * API-Route: Foto-Anzahl pro Fotogruppe (nur aktive Gruppen)
 * GET /api/fotodatenbank/fotogruppen-fotozahlen
 * Liefert: { idfgruppe: number, anzahlFotos: number }[]
 * Nur aktive Gruppen (einaktiv = "ja") werden gezählt.
 * Wird nach dem initialen Seitenladen nachgeladen (lazy).
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fdFotogruppenverkn, fdFotogruppen } from "@/lib/db/schema";
import { eq, count, and } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  try {
    // Einmalige Abfrage: Anzahl Fotos pro Gruppe, gefiltert auf aktive Gruppen
    const rows = await db
      .select({
        idfgruppe:    fdFotogruppenverkn.idfgruppe,
        anzahlFotos:  count(fdFotogruppenverkn.idverkn),
      })
      .from(fdFotogruppenverkn)
      .innerJoin(
        fdFotogruppen,
        and(
          eq(fdFotogruppenverkn.idfgruppe, fdFotogruppen.idfgruppe),
          eq(fdFotogruppen.einaktiv, "ja")
        )
      )
      .groupBy(fdFotogruppenverkn.idfgruppe);

    // Als Map {idfgruppe → anzahlFotos} zurückgeben
    const result: Record<number, number> = {};
    for (const r of rows) {
      result[r.idfgruppe] = r.anzahlFotos;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Fotogruppen-Fotozahlen-Fehler:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
