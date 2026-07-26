/**
 * POST /api/reisen/[mapId]/admin-cities
 *
 * Legt eine neue Stadt in einer Reisekarte an – nur für isMainAdmin.
 * Wird aus der FotogruppenListe heraus aufgerufen (Geocoding-Flow).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { travelMaps, travelCities } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ mapId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { mapId: mapIdStr } = await params;
  const mapId = parseInt(mapIdStr, 10);
  if (isNaN(mapId)) {
    return NextResponse.json({ error: "Ungültige mapId" }, { status: 400 });
  }

  // Karte muss existieren
  const maps = await db.select().from(travelMaps).where(eq(travelMaps.id, mapId));
  if (!maps[0]) {
    return NextResponse.json({ error: "Reisekarte nicht gefunden" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const { name, countryCode, countryName, lat, lng, visitedBy, visitedAt, notes } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
    }
    if (!countryCode) {
      return NextResponse.json({ error: "Ländercode ist erforderlich" }, { status: 400 });
    }

    const [inserted] = await db.insert(travelCities).values({
      mapId,
      name: name.trim(),
      countryCode: String(countryCode).toUpperCase(),
      countryName: countryName ?? "",
      lat: lat ? String(lat) : null,
      lng: lng ? String(lng) : null,
      visitedBy: visitedBy ?? "user1",
      visitedAt: visitedAt ?? null,
      notes: notes ?? null,
    });

    const insertId = (inserted as { insertId?: number }).insertId ?? 0;
    return NextResponse.json({ id: insertId, success: true }, { status: 201 });
  } catch (error) {
    console.error("POST /api/reisen/[mapId]/admin-cities:", error);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
