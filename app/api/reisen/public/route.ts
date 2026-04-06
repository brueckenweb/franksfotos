/**
 * GET /api/reisen/public
 * Gibt die erste Reisekarte von User 1 zurück (keine Authentifizierung nötig).
 * Wird auf der Startseite für alle Besucher angezeigt.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { travelMaps, travelCountries, travelCities, travelSights, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    // Erste Karte von User 1 laden
    const maps = await db
      .select()
      .from(travelMaps)
      .where(eq(travelMaps.userId, 1))
      .limit(1);

    if (maps.length === 0) {
      return NextResponse.json(null);
    }

    const map = maps[0];

    const [countries, cities, sights, ownerArr] = await Promise.all([
      db.select().from(travelCountries).where(eq(travelCountries.mapId, map.id)),
      db.select().from(travelCities).where(eq(travelCities.mapId, map.id)),
      db.select().from(travelSights).where(eq(travelSights.mapId, map.id)),
      db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, map.userId)),
    ]);

    return NextResponse.json({
      id:          map.id,
      name:        map.name,
      ownerName:   ownerArr[0]?.name ?? "",
      partnerName: null,
      countries,
      cities,
      sights,
    });
  } catch (error) {
    console.error("GET /api/reisen/public:", error);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
