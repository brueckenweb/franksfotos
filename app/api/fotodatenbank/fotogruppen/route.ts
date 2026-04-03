/**
 * API-Route: Aktive Fotogruppen aus fd_fotogruppen laden
 * GET /api/fotodatenbank/fotogruppen
 * Nur für isMainAdmin zugänglich
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fdFotogruppen } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  try {
    const gruppen = await db
      .select({
        idfgruppe: fdFotogruppen.idfgruppe,
        name: fdFotogruppen.name,
      })
      .from(fdFotogruppen)
      .where(eq(fdFotogruppen.einaktiv, "ja"))
      .orderBy(asc(fdFotogruppen.name));

    return NextResponse.json(gruppen);
  } catch (error) {
    console.error("Fotogruppen-Fehler:", error);
    // Leere Liste zurückgeben wenn Tabelle noch nicht existiert
    return NextResponse.json([]);
  }
}
