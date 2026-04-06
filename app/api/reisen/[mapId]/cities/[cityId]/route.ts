/**
 * PUT    /api/reisen/[mapId]/cities/[cityId]  – Stadt aktualisieren
 * DELETE /api/reisen/[mapId]/cities/[cityId]  – Stadt löschen
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { travelMaps, travelCities } from "@/lib/db/schema";
import { eq, and, or } from "drizzle-orm";

type Params = { params: Promise<{ mapId: string; cityId: string }> };

async function checkMapAccess(mapId: number, userId: number) {
  const maps = await db.select().from(travelMaps).where(
    and(eq(travelMaps.id, mapId), or(eq(travelMaps.userId, userId), eq(travelMaps.partnerId, userId)))
  );
  return maps[0] ?? null;
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const userId = parseInt(session.user.id as string);
  const { mapId: mapIdStr, cityId: cityIdStr } = await params;
  const mapId = parseInt(mapIdStr);
  const cityId = parseInt(cityIdStr);

  const map = await checkMapAccess(mapId, userId);
  if (!map) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  try {
    const body = await req.json();
    const { name, countryCode, countryName, lat, lng, visitedBy, visitedAt, notes } = body;

    await db.update(travelCities).set({
      name: name?.trim(),
      countryCode: countryCode?.toUpperCase(),
      countryName: countryName ?? "",
      lat: lat ? String(lat) : null,
      lng: lng ? String(lng) : null,
      visitedBy: visitedBy ?? "user1",
      visitedAt: visitedAt ?? null,
      notes: notes ?? null,
    }).where(and(eq(travelCities.id, cityId), eq(travelCities.mapId, mapId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/reisen/.../cities/[cityId]:", error);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const userId = parseInt(session.user.id as string);
  const { mapId: mapIdStr, cityId: cityIdStr } = await params;
  const mapId = parseInt(mapIdStr);
  const cityId = parseInt(cityIdStr);

  const map = await checkMapAccess(mapId, userId);
  if (!map) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  try {
    await db.delete(travelCities).where(and(eq(travelCities.id, cityId), eq(travelCities.mapId, mapId)));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/reisen/.../cities/[cityId]:", error);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
