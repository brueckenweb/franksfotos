/**
 * GET    /api/reisen/[mapId]/cities     – Alle Städte einer Karte
 * POST   /api/reisen/[mapId]/cities     – Stadt hinzufügen
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { travelMaps, travelCities } from "@/lib/db/schema";
import { eq, and, or } from "drizzle-orm";

type Params = { params: Promise<{ mapId: string }> };

async function checkMapAccess(mapId: number, userId: number) {
  const maps = await db.select().from(travelMaps).where(
    and(eq(travelMaps.id, mapId), or(eq(travelMaps.userId, userId), eq(travelMaps.partnerId, userId)))
  );
  return maps[0] ?? null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const userId = parseInt(session.user.id as string);
  const { mapId: mapIdStr } = await params;
  const mapId = parseInt(mapIdStr);

  const map = await checkMapAccess(mapId, userId);
  if (!map) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const cities = await db.select().from(travelCities).where(eq(travelCities.mapId, mapId));
  return NextResponse.json(cities);
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const userId = parseInt(session.user.id as string);
  const { mapId: mapIdStr } = await params;
  const mapId = parseInt(mapIdStr);

  const map = await checkMapAccess(mapId, userId);
  if (!map) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  try {
    const body = await req.json();
    const { name, countryCode, countryName, lat, lng, visitedBy, visitedAt, notes } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
    if (!countryCode) return NextResponse.json({ error: "Ländercode ist erforderlich" }, { status: 400 });

    const [inserted] = await db.insert(travelCities).values({
      mapId,
      name: name.trim(),
      countryCode: countryCode.toUpperCase(),
      countryName: countryName ?? "",
      lat: lat ? String(lat) : null,
      lng: lng ? String(lng) : null,
      visitedBy: visitedBy ?? "user1",
      visitedAt: visitedAt ?? null,
      notes: notes ?? null,
    });

    return NextResponse.json({ id: inserted.insertId, success: true }, { status: 201 });
  } catch (error) {
    console.error("POST /api/reisen/[mapId]/cities:", error);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
