/**
 * API-Route: Foto-Anzahl pro Fotogruppe (alle Gruppen)
 * GET /api/fotodatenbank/fotogruppen-fotozahlen
 * Liefert: { [idfgruppe]: anzahlFotos }
 *
 * - Aktive Gruppen (einaktiv = "ja"):  Anzahl wird live gezählt UND in fd_fotogruppen.anzahl persistiert.
 * - Inaktive Gruppen (einaktiv = "nein"): Anzahl wird aus fd_fotogruppen.anzahl gelesen (DB-Cache).
 *
 * Wird nach dem initialen Seitenladen nachgeladen (lazy).
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fdFotogruppenverkn, fdFotogruppen } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  try {
    // 1. Live-Zählung aller Fotogruppen-Verknüpfungen
    const gezaehlt = await db
      .select({
        idfgruppe:   fdFotogruppenverkn.idfgruppe,
        anzahlFotos: count(fdFotogruppenverkn.idverkn),
      })
      .from(fdFotogruppenverkn)
      .groupBy(fdFotogruppenverkn.idfgruppe);

    const liveMap = new Map<number, number>();
    for (const r of gezaehlt) {
      liveMap.set(r.idfgruppe, r.anzahlFotos);
    }

    // 2. Alle Gruppen laden (für inaktive: DB-Cache-Wert)
    const alleGruppen = await db
      .select({
        idfgruppe: fdFotogruppen.idfgruppe,
        einaktiv:  fdFotogruppen.einaktiv,
        anzahl:    fdFotogruppen.anzahl,
      })
      .from(fdFotogruppen);

    // 3. Aktive Gruppen: live-Wert zurückgeben + in DB persistieren (fire-and-forget)
    const result: Record<number, number> = {};

    const updatePromises: Promise<unknown>[] = [];

    for (const g of alleGruppen) {
      if (g.einaktiv === "ja") {
        // Aktiv → live gezählter Wert
        const live = liveMap.get(g.idfgruppe) ?? 0;
        result[g.idfgruppe] = live;
        // In DB persistieren wenn abweichend
        if (live !== (g.anzahl ?? 0)) {
          updatePromises.push(
            db.update(fdFotogruppen)
              .set({ anzahl: live })
              .where(eq(fdFotogruppen.idfgruppe, g.idfgruppe))
              .catch(() => {}) // Fehler ignorieren – nicht kritisch
          );
        }
      } else {
        // Inaktiv → gespeicherter DB-Wert (oder live falls vorhanden)
        result[g.idfgruppe] = liveMap.get(g.idfgruppe) ?? g.anzahl ?? 0;
      }
    }

    // Asynchron persistieren (keine Wartezeit für den Client)
    Promise.all(updatePromises).catch(() => {});

    return NextResponse.json(result);
  } catch (error) {
    console.error("Fotogruppen-Fotozahlen-Fehler:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
