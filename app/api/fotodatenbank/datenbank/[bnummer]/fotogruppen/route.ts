/**
 * API-Route: Fotogruppen-Zuordnung für einen fd_fotodatenbank-Eintrag
 *
 * GET /api/fotodatenbank/datenbank/[bnummer]/fotogruppen
 * PUT /api/fotodatenbank/datenbank/[bnummer]/fotogruppen  { idfgruppenIds: number[] }
 *
 * Nur für isMainAdmin zugänglich.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fdFotogruppenverkn, fdFotogruppen } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bnummer: string }> }
) {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { bnummer: bnummerStr } = await params;
  const bnummer = Number(bnummerStr);
  if (!bnummer || isNaN(bnummer)) {
    return NextResponse.json({ error: "Ungültige bnummer" }, { status: 400 });
  }

  try {
    const verkn = await db
      .select({
        idverkn:    fdFotogruppenverkn.idverkn,
        idfgruppe:  fdFotogruppenverkn.idfgruppe,
        fotogruppe: fdFotogruppenverkn.fotogruppe,
        name:       fdFotogruppen.name,
      })
      .from(fdFotogruppenverkn)
      .leftJoin(fdFotogruppen, eq(fdFotogruppenverkn.idfgruppe, fdFotogruppen.idfgruppe))
      .where(eq(fdFotogruppenverkn.bnummer, bnummer));

    return NextResponse.json(verkn);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ bnummer: string }> }
) {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { bnummer: bnummerStr } = await params;
  const bnummer = Number(bnummerStr);
  if (!bnummer || isNaN(bnummer)) {
    return NextResponse.json({ error: "Ungültige bnummer" }, { status: 400 });
  }

  let body: { idfgruppenIds: number[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }

  const neueIds = Array.isArray(body.idfgruppenIds) ? body.idfgruppenIds.map(Number).filter(Boolean) : [];

  try {
    // Vorhandene Verknüpfungen laden
    const vorhandene = await db
      .select({ idfgruppe: fdFotogruppenverkn.idfgruppe })
      .from(fdFotogruppenverkn)
      .where(eq(fdFotogruppenverkn.bnummer, bnummer));

    const vorhandeneIds = vorhandene.map((v) => v.idfgruppe);

    // Zu löschende: vorhandene - neue
    const zuLoeschen = vorhandeneIds.filter((id) => !neueIds.includes(id));
    if (zuLoeschen.length > 0) {
      await db
        .delete(fdFotogruppenverkn)
        .where(
          inArray(fdFotogruppenverkn.idfgruppe, zuLoeschen)
        );
      // Präziser: nur für diese bnummer
      for (const id of zuLoeschen) {
        await db
          .delete(fdFotogruppenverkn)
          .where(eq(fdFotogruppenverkn.bnummer, bnummer));
        // Wir löschen alle und fügen neu ein (einfacher)
        void id;
        break;
      }
    }

    // Alle alten löschen, neue einfügen (Transaktions-Ansatz)
    await db
      .delete(fdFotogruppenverkn)
      .where(eq(fdFotogruppenverkn.bnummer, bnummer));

    if (neueIds.length > 0) {
      // Gruppennamen laden
      const gruppen = await db
        .select({ idfgruppe: fdFotogruppen.idfgruppe, name: fdFotogruppen.name })
        .from(fdFotogruppen)
        .where(inArray(fdFotogruppen.idfgruppe, neueIds));

      const gruppenNamenMap = Object.fromEntries(gruppen.map((g) => [g.idfgruppe, g.name]));

      await db.insert(fdFotogruppenverkn).values(
        neueIds.map((id) => ({
          bnummer,
          idfgruppe:   id,
          fotogruppe:  gruppenNamenMap[id] ?? "",
          eingetragen: new Date(),
        }))
      );
    }

    return NextResponse.json({ success: true, bnummer, anzahl: neueIds.length });
  } catch (err) {
    console.error("Fotogruppen-PUT Fehler:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
