/**
 * API-Route: Foto-Anzahlen in fd_fotogruppen.anzahl synchronisieren
 * POST /api/fotodatenbank/fotogruppen-anzahl-sync
 *
 * Body (optional):
 *   { idfgruppe: number }  → Nur diese eine Gruppe synchronisieren
 *   {}                     → Alle inaktiven Gruppen (einaktiv = "nein") synchronisieren
 *
 * Gibt { ok: true, aktualisiert: N } zurück.
 * Nur für isMainAdmin zugänglich.
 *
 * Hinweis: Aktive Gruppen werden NICHT im Batch synchronisiert –
 * ihre Anzahl wird im Frontend per Lazy-Loading live ermittelt.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fdFotogruppen, fdFotogruppenverkn } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";

async function checkAdmin() {
  const session = await auth();
  return !!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin;
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({})) as { idfgruppe?: number };

    // ── Modus 1: Einzelne Gruppe synchronisieren ──────────────────
    if (body.idfgruppe) {
      const [result] = await db
        .select({ anzahlFotos: count(fdFotogruppenverkn.idverkn) })
        .from(fdFotogruppenverkn)
        .where(eq(fdFotogruppenverkn.idfgruppe, body.idfgruppe));

      await db
        .update(fdFotogruppen)
        .set({ anzahl: result?.anzahlFotos ?? 0 })
        .where(eq(fdFotogruppen.idfgruppe, body.idfgruppe));

      return NextResponse.json({ ok: true, aktualisiert: 1 });
    }

    // ── Modus 2: Alle inaktiven Gruppen synchronisieren ───────────
    const inaktiveGruppen = await db
      .select({ idfgruppe: fdFotogruppen.idfgruppe })
      .from(fdFotogruppen)
      .where(eq(fdFotogruppen.einaktiv, "nein"));

    if (inaktiveGruppen.length === 0) {
      return NextResponse.json({ ok: true, aktualisiert: 0 });
    }

    // Fotozahlen je inaktiver Gruppe zählen
    const fotozahlen = await db
      .select({
        idfgruppe:   fdFotogruppenverkn.idfgruppe,
        anzahlFotos: count(fdFotogruppenverkn.idverkn),
      })
      .from(fdFotogruppenverkn)
      .groupBy(fdFotogruppenverkn.idfgruppe);

    const anzahlMap = new Map<number, number>();
    for (const row of fotozahlen) {
      anzahlMap.set(row.idfgruppe, row.anzahlFotos);
    }

    let aktualisiert = 0;
    for (const g of inaktiveGruppen) {
      await db
        .update(fdFotogruppen)
        .set({ anzahl: anzahlMap.get(g.idfgruppe) ?? 0 })
        .where(eq(fdFotogruppen.idfgruppe, g.idfgruppe));
      aktualisiert++;
    }

    return NextResponse.json({ ok: true, aktualisiert });
  } catch (error) {
    console.error("Fotogruppen-Anzahl-Sync-Fehler:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
