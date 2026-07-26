/**
 * GET /api/reisen/[mapId]/entities?q=&type=city|country|sight
 *
 * Suche nach Städten, Ländern oder Sehenswürdigkeiten in einer Reisekarte.
 * Nur für isMainAdmin zugänglich.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { travelCities, travelCountries, travelSights } from "@/lib/db/schema";
import { eq, like, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mapId: string }> }
) {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { mapId: mapIdStr } = await params;
  const mapId = parseInt(mapIdStr, 10);
  if (isNaN(mapId)) {
    return NextResponse.json({ error: "Ungültige mapId" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const q    = (searchParams.get("q") ?? "").trim();
  const type = searchParams.get("type") ?? "city";

  if (!q) {
    return NextResponse.json([]);
  }

  try {
    if (type === "city") {
      const results = await db
        .select({ id: travelCities.id, name: travelCities.name })
        .from(travelCities)
        .where(and(
          eq(travelCities.mapId, mapId),
          like(travelCities.name, `%${q}%`)
        ))
        .limit(20);
      return NextResponse.json(results.map((r) => ({ ...r, entityType: "city" })));
    }

    if (type === "country") {
      const results = await db
        .select({ id: travelCountries.id, name: travelCountries.countryName })
        .from(travelCountries)
        .where(and(
          eq(travelCountries.mapId, mapId),
          like(travelCountries.countryName, `%${q}%`)
        ))
        .limit(20);
      return NextResponse.json(results.map((r) => ({ id: r.id, name: r.name, entityType: "country" })));
    }

    if (type === "sight") {
      const results = await db
        .select({ id: travelSights.id, name: travelSights.name })
        .from(travelSights)
        .where(and(
          eq(travelSights.mapId, mapId),
          like(travelSights.name, `%${q}%`)
        ))
        .limit(20);
      return NextResponse.json(results.map((r) => ({ ...r, entityType: "sight" })));
    }

    return NextResponse.json([]);
  } catch (err) {
    console.error("Entities-GET Fehler:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
