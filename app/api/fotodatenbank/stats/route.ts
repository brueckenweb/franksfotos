/**
 * API-Route: Statistiken für die Fotodatenbank-Eingabe
 * GET /api/fotodatenbank/stats?idfgruppe=123
 * Gibt zurück:
 *  - anzahlBas:           Anzahl unterschiedlicher Brücken in der Fotogruppe
 *  - anzahlFotos:         Anzahl eingetragener Fotos in der Fotogruppe
 *  - anzahlZuVerarbeiten: Anzahl eindeutiger Dateinamen in /zuverarbeiten
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fdFotodatenbank, fdFotogruppenverkn } from "@/lib/db/schema";
import { eq, ne, and, count, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

const BASE_PATH = process.env.FS_FOTODATENBANK_PATH ?? "C:\\FS_Fotodatenbank";
const ZUVERARBEITEN_PATH = path.join(BASE_PATH, "zuverarbeiten");

export async function GET(request: Request) {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const idfgruppeStr = searchParams.get("idfgruppe");
  const idfgruppe = idfgruppeStr ? Number(idfgruppeStr) : null;

  // 1. Anzahl eingetragene Fotos in der Fotogruppe
  let anzahlFotos = 0;
  let anzahlBas = 0;

  if (idfgruppe) {
    try {
      const [fotoResult] = await db
        .select({ count: count() })
        .from(fdFotogruppenverkn)
        .where(eq(fdFotogruppenverkn.idfgruppe, idfgruppe));
      anzahlFotos = Number(fotoResult?.count ?? 0);
    } catch { /* Tabelle nicht erreichbar → 0 */ }

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

  // 3. Anzahl eindeutiger Dateinamen in /zuverarbeiten
  let anzahlZuVerarbeiten = 0;
  try {
    if (fs.existsSync(ZUVERARBEITEN_PATH)) {
      const files = fs
        .readdirSync(ZUVERARBEITEN_PATH)
        .filter(
          (f) =>
            f !== "Thumbs.db" &&
            !fs.statSync(path.join(ZUVERARBEITEN_PATH, f)).isDirectory()
        );
      // Gleicher Basisname (ohne Extension) = ein Foto
      const baseNames = new Set(
        files.map((f) => path.basename(f, path.extname(f)).toLowerCase())
      );
      anzahlZuVerarbeiten = baseNames.size;
    }
  } catch { /* → 0 */ }

  return NextResponse.json({ anzahlFotos, anzahlBas, anzahlZuVerarbeiten });
}
