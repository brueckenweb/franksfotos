/**
 * GET    /api/reisen/[mapId]  – Karte laden (mit allen Daten)
 * PUT    /api/reisen/[mapId]  – Karte aktualisieren
 * DELETE /api/reisen/[mapId]  – Karte löschen
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { travelMaps, travelCountries, travelCities, travelSights, users } from "@/lib/db/schema";
import { eq, or, and } from "drizzle-orm";

type Params = { params: Promise<{ mapId: string }> };

async function getMapAndCheckAccess(mapId: number, userId: number) {
  const maps = await db
    .select()
    .from(travelMaps)
    .where(
      and(
        eq(travelMaps.id, mapId),
        or(eq(travelMaps.userId, userId), eq(travelMaps.partnerId, userId))
      )
    );
  return maps[0] ?? null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const userId = parseInt(session.user.id as string);
  const { mapId: mapIdStr } = await params;
  const mapId = parseInt(mapIdStr);

  try {
    const map = await getMapAndCheckAccess(mapId, userId);
    if (!map) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    // Alles parallel laden
    const [countries, cities, sights, ownerArr, partnerArr] = await Promise.all([
      db.select().from(travelCountries).where(eq(travelCountries.mapId, mapId)),
      db.select().from(travelCities).where(eq(travelCities.mapId, mapId)),
      db.select().from(travelSights).where(eq(travelSights.mapId, mapId)),
      db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, map.userId)),
      map.partnerId
        ? db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, map.partnerId))
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      ...map,
      ownerName:   ownerArr[0]?.name ?? "",
      partnerName: partnerArr[0]?.name ?? null,
      countries,
      cities,
      sights,
    });
  } catch (error) {
    console.error("GET /api/reisen/[mapId]:", error);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const userId = parseInt(session.user.id as string);
  const { mapId: mapIdStr } = await params;
  const mapId = parseInt(mapIdStr);

  try {
    const map = await getMapAndCheckAccess(mapId, userId);
    if (!map) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    // Nur der Eigentümer darf bearbeiten
    if (map.userId !== userId) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

    const body = await req.json();
    const { name, description, partnerId } = body;

    await db.update(travelMaps).set({
      name:        name?.trim() ?? map.name,
      description: description?.trim() ?? map.description,
      partnerId:   partnerId !== undefined ? (partnerId ? parseInt(partnerId) : null) : map.partnerId,
    }).where(eq(travelMaps.id, mapId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/reisen/[mapId]:", error);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const userId = parseInt(session.user.id as string);
  const { mapId: mapIdStr } = await params;
  const mapId = parseInt(mapIdStr);

  try {
    const map = await getMapAndCheckAccess(mapId, userId);
    if (!map) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    if (map.userId !== userId) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

    await db.delete(travelMaps).where(eq(travelMaps.id, mapId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/reisen/[mapId]:", error);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
