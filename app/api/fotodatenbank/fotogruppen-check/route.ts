/**
 * API-Route: Prüfen ob eine Fotogruppe verknüpfte Fotos hat
 * GET /api/fotodatenbank/fotogruppen-check?idfgruppe=123
 * Nur für isMainAdmin zugänglich
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fdFotogruppenverkn } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const idfgruppe = Number(req.nextUrl.searchParams.get("idfgruppe"));
  if (!idfgruppe) {
    return NextResponse.json({ error: "Keine ID" }, { status: 400 });
  }

  try {
    const [{ anzahlFotos }] = await db
      .select({ anzahlFotos: count() })
      .from(fdFotogruppenverkn)
      .where(eq(fdFotogruppenverkn.idfgruppe, idfgruppe));

    return NextResponse.json({ anzahlFotos });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
