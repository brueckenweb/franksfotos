/**
 * API: Fotogruppen-Verknüpfungen für Reisekarten-Einträge
 *
 * GET    /api/reisen/[mapId]/fotogruppen-links
 *        ?entityType=country|city|sight&entityId=<id>
 *        → Links für einen bestimmten Eintrag laden
 *
 * POST   /api/reisen/[mapId]/fotogruppen-links
 *        { entityType, entityId, fotogruppeId, fotogruppeNname }
 *        → Link hinzufügen (Duplikat-Schutz via UNIQUE)
 *
 * DELETE /api/reisen/[mapId]/fotogruppen-links
 *        { id }  → Link entfernen
 *
 * Nur für isMainAdmin zugänglich.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { travelFotogruppenLinks, travelMaps, travelCities, travelCountries, travelSights } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

type Params = { params: Promise<{ mapId: string }> };

async function checkAdmin(mapId: number) {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) return null;
  const maps = await db.select().from(travelMaps).where(eq(travelMaps.id, mapId));
  return maps[0] ?? null;
}

// ── GET: Links für einen Eintrag laden ────────────────────────────────────────
export async function GET(req: NextRequest, { params }: Params) {
  const { mapId: mapIdStr } = await params;
  const mapId = parseInt(mapIdStr);
  const map = await checkAdmin(mapId);
  if (!map) return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const entityType     = searchParams.get("entityType");
  const entityId       = parseInt(searchParams.get("entityId") ?? "0");
  const fotogruppeIdP  = searchParams.get("fotogruppeId");
  const fotogruppeId   = fotogruppeIdP ? parseInt(fotogruppeIdP) : null;

  // Modus 1: Alle Links einer Fotogruppe in dieser Karte (mit Entity-Namen)
  if (fotogruppeId && !isNaN(fotogruppeId)) {
    try {
      const links = await db
        .select()
        .from(travelFotogruppenLinks)
        .where(and(
          eq(travelFotogruppenLinks.mapId, mapId),
          eq(travelFotogruppenLinks.fotogruppeId, fotogruppeId)
        ));

      // Entity-Namen nachschlagen
      const enriched = await Promise.all(links.map(async (l) => {
        let entityName = "";
        try {
          if (l.entityType === "city") {
            const rows = await db.select({ name: travelCities.name }).from(travelCities).where(eq(travelCities.id, l.entityId));
            entityName = rows[0]?.name ?? "";
          } else if (l.entityType === "country") {
            const rows = await db.select({ name: travelCountries.countryName }).from(travelCountries).where(eq(travelCountries.id, l.entityId));
            entityName = rows[0]?.name ?? "";
          } else if (l.entityType === "sight") {
            const rows = await db.select({ name: travelSights.name }).from(travelSights).where(eq(travelSights.id, l.entityId));
            entityName = rows[0]?.name ?? "";
          }
        } catch { /* ignorieren */ }
        return { ...l, entityName };
      }));

      return NextResponse.json(enriched);
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "entityType und entityId erforderlich" }, { status: 400 });
  }

  try {
    const links = await db
      .select()
      .from(travelFotogruppenLinks)
      .where(
        and(
          eq(travelFotogruppenLinks.entityType, entityType),
          eq(travelFotogruppenLinks.entityId, entityId),
        )
      );
    return NextResponse.json(links);
  } catch (error) {
    console.error("GET fotogruppen-links:", error);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// ── POST: Link hinzufügen ─────────────────────────────────────────────────────
export async function POST(req: NextRequest, { params }: Params) {
  const { mapId: mapIdStr } = await params;
  const mapId = parseInt(mapIdStr);
  const map = await checkAdmin(mapId);
  if (!map) return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });

  try {
    const body = await req.json() as {
      entityType: string;
      entityId: number;
      fotogruppeId: number;
      fotogruppeNname: string;
    };

    const { entityType, entityId, fotogruppeId, fotogruppeNname } = body;

    if (!["country", "city", "sight"].includes(entityType)) {
      return NextResponse.json({ error: "Ungültiger entityType" }, { status: 400 });
    }
    if (!entityId || !fotogruppeId) {
      return NextResponse.json({ error: "entityId und fotogruppeId erforderlich" }, { status: 400 });
    }

    const [result] = await db.insert(travelFotogruppenLinks).values({
      entityType,
      entityId,
      mapId,
      fotogruppeId,
      fotogruppeNname: fotogruppeNname ?? "",
    });

    return NextResponse.json({ id: Number((result as { insertId?: unknown }).insertId ?? 0), success: true }, { status: 201 });
  } catch (error: unknown) {
    // Doppelter UNIQUE-Key
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Diese Fotogruppe ist bereits verknüpft." }, { status: 409 });
    }
    console.error("POST fotogruppen-links:", error);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// ── DELETE: Link entfernen ────────────────────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: Params) {
  const { mapId: mapIdStr } = await params;
  const mapId = parseInt(mapIdStr);
  const map = await checkAdmin(mapId);
  if (!map) return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });

  try {
    // Unterstützt sowohl ?id= Query-Parameter als auch JSON-Body { id }
    const { searchParams: sp } = new URL(req.url);
    const qId = sp.get("id");
    let id: number;
    if (qId) {
      id = parseInt(qId);
    } else {
      const body = await req.json() as { id: number };
      id = body.id;
    }
    if (!id || isNaN(id)) return NextResponse.json({ error: "id erforderlich" }, { status: 400 });

    await db.delete(travelFotogruppenLinks).where(
      and(
        eq(travelFotogruppenLinks.id, id),
        eq(travelFotogruppenLinks.mapId, mapId),
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE fotogruppen-links:", error);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
