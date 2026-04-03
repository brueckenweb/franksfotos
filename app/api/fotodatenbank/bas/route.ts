/**
 * API-Route: Letzte 25 BAS-Einträge für Dropdown laden
 * GET /api/fotodatenbank/bas
 * Nur für isMainAdmin zugänglich
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fdBas } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  try {
    const basList = await db
      .select({
        brueckennummer: fdBas.brueckennummer,
        name: fdBas.name,
      })
      .from(fdBas)
      .orderBy(desc(fdBas.brueckennummer))
      .limit(25);

    return NextResponse.json(basList);
  } catch (error) {
    // BAS-Tabelle existiert möglicherweise nicht – kein kritischer Fehler
    console.warn("BAS-Tabelle nicht verfügbar:", error);
    return NextResponse.json([]);
  }
}
