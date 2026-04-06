/**
 * GET    /api/reisen/[mapId]/countries  – Alle Länder einer Karte
 * POST   /api/reisen/[mapId]/countries  – Land hinzufügen / aktualisieren (upsert)
 * DELETE /api/reisen/[mapId]/countries  – Land entfernen (body: { countryCode })
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { travelMaps, travelCountries } from "@/lib/db/schema";
import { eq, and, or } from "drizzle-orm";
import { COUNTRY_MAP } from "@/lib/reisen/countries";

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

  const countries = await db.select().from(travelCountries).where(eq(travelCountries.mapId, mapId));
  return NextResponse.json(countries);
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
    const { countryCode, visitedBy, visitedAt, notes } = body;

    if (!countryCode || countryCode.length !== 2) {
      return NextResponse.json({ error: "Ungültiger Ländercode" }, { status: 400 });
    }

    const countryInfo = COUNTRY_MAP.get(countryCode.toUpperCase());
    const countryName = countryInfo?.name ?? countryCode;

    // Upsert: prüfen ob schon vorhanden
    const existing = await db.select().from(travelCountries).where(
      and(eq(travelCountries.mapId, mapId), eq(travelCountries.countryCode, countryCode.toUpperCase()))
    );

    if (existing.length > 0) {
      await db.update(travelCountries).set({
        visitedBy: visitedBy ?? "user1",
        visitedAt: visitedAt || null,   // "" → null (MariaDB akzeptiert kein leeres String für DATE)
        notes: notes || null,
      }).where(eq(travelCountries.id, existing[0].id));
      return NextResponse.json({ id: existing[0].id, updated: true });
    } else {
      const [inserted] = await db.insert(travelCountries).values({
        mapId,
        countryCode: countryCode.toUpperCase(),
        countryName,
        visitedBy: visitedBy ?? "user1",
        visitedAt: visitedAt || null,   // "" → null
        notes: notes || null,
      });
      return NextResponse.json({ id: inserted.insertId, created: true }, { status: 201 });
    }
  } catch (error) {
    console.error("POST /api/reisen/[mapId]/countries:", error);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const userId = parseInt(session.user.id as string);
  const { mapId: mapIdStr } = await params;
  const mapId = parseInt(mapIdStr);

  const map = await checkMapAccess(mapId, userId);
  if (!map) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  try {
    const body = await req.json();
    const { countryCode } = body;
    if (!countryCode) return NextResponse.json({ error: "countryCode fehlt" }, { status: 400 });

    await db.delete(travelCountries).where(
      and(eq(travelCountries.mapId, mapId), eq(travelCountries.countryCode, countryCode.toUpperCase()))
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/reisen/[mapId]/countries:", error);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
