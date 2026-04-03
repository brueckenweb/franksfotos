/**
 * API-Route: Statistiken für die Fotodatenbank-Eingabe
 * GET /api/fotodatenbank/stats?idfgruppe=123&anzahlZuVerarbeiten=5
 *
 * anzahlZuVerarbeiten wird jetzt vom Client (File System Access API) geliefert.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fdFotodatenbank, fdFotogruppenverkn } from "@/lib/db/schema";
import { eq, ne, and, count, sql } from "drizzle-orm";

export async function GET(request: Request) {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const idfgruppeStr = searchParams.get("idfgruppe");
  const idfgruppe = idfgruppeStr ? Number(idfgruppeStr) : null;

  // anzahlZuVerarbeiten kommt jetzt vom Client (der den lokalen Ordner kennt)
  const anzahlZuVerarbeiten = parseInt(searchParams.get("anzahlZuVerarbeiten") ?? "0") || 0;

  // 1. Anzahl eingetragene Fotos in der Fotogruppe
  let anzahlFotos = 0;
  let anzahlBas   = 0;

  if (idfgruppe) {
    try {
      const [fotoResult] = await db
        .select({ count: count() })
        .from(fdFotogruppenverkn)
        .where(eq(fdFotogruppenverkn.idfgruppe, idfgruppe));
      anzahlFotos = Number(fotoResult?.count ?? 0);
    } catch { /* → 0 */ }

    // 2. Anzahl unterschiedlicher Brücken (bas != '0') in der Fotogruppe
    try {
      const [basResult] = await db
        .select({
          count: sql<number>`COUNT(DISTINCT ${fdFotodatenbank.bas})`,
        })
        .from(fdFotodatenbank)
        .innerJoin(
          fdFotogruppenverkn,
          eq(fdFotodatenbank.bnummer, fdFotogruppenverkn.bnummer)
        )
        .where(
          and(
            eq(fdFotogruppenverkn.idfgruppe, idfgruppe),
            ne(fdFotodatenbank.bas, "0")
          )
        );
      anzahlBas = Number(basResult?.count ?? 0);
    } catch { /* → 0 */ }
  }

  return NextResponse.json({ anzahlFotos, anzahlBas, anzahlZuVerarbeiten });
}
