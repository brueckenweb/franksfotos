/**
 * GET /api/reisen/[mapId]/public
 * Gibt eine bestimmte Reisekarte öffentlich zurück (keine Authentifizierung nötig).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { travelMaps, travelCountries, travelCities, travelSights, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ mapId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { mapId: mapIdStr } = await params;
  const mapId = parseInt(mapIdStr);

  if (isNaN(mapId)) {
    return NextResponse.json({ error: "Ungültige Karten-ID" }, { status: 400 });
  }

  try {
    const maps = await db
      .select()
      .from(travelMaps)
      .where(eq(travelMaps.id, mapId))
      .limit(1);

    if (maps.length === 0) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    const map = maps[0];

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
      id:          map.id,
      name:        map.name,
      ownerName:   ownerArr[0]?.name ?? "",
      partnerName: partnerArr[0]?.name ?? null,
      countries,
      cities,
      sights,
    });
  } catch (error) {
    console.error("GET /api/reisen/[mapId]/public:", error);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
