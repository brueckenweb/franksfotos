/**
 * GET /api/fotodatenbank/fotogruppen-reisezahlen
 *
 * Gibt für jede Fotogruppe die Anzahl der verknüpften Reisekarten-Entities zurück.
 * Format: { [idfgruppe]: anzahl }
 *
 * Nur für isMainAdmin zugänglich.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { travelFotogruppenLinks } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  try {
    const rows = await db
      .select({
        fotogruppeId: travelFotogruppenLinks.fotogruppeId,
        anzahl: sql<number>`COUNT(*)`.as("anzahl"),
      })
      .from(travelFotogruppenLinks)
      .groupBy(travelFotogruppenLinks.fotogruppeId);

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[String(row.fotogruppeId)] = Number(row.anzahl);
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("GET fotogruppen-reisezahlen:", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
