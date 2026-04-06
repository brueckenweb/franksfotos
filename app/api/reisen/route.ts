/**
 * GET  /api/reisen  – Eigene Karten des eingeloggten Users abrufen
 * POST /api/reisen  – Neue Karte anlegen
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { travelMaps, users } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const userId = parseInt(session.user.id as string);

  try {
    // Karten, bei denen der User Inhaber oder Partner ist
    const maps = await db
      .select({
        id:          travelMaps.id,
        name:        travelMaps.name,
        description: travelMaps.description,
        userId:      travelMaps.userId,
        partnerId:   travelMaps.partnerId,
        createdAt:   travelMaps.createdAt,
        updatedAt:   travelMaps.updatedAt,
      })
      .from(travelMaps)
      .where(
        or(
          eq(travelMaps.userId, userId),
          eq(travelMaps.partnerId, userId)
        )
      );

    return NextResponse.json(maps);
  } catch (error) {
    console.error("GET /api/reisen:", error);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const userId = parseInt(session.user.id as string);

  try {
    const body = await req.json();
    const { name, description, partnerId } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
    }

    // Partner-User prüfen falls angegeben
    if (partnerId) {
      const partnerUser = await db.select({ id: users.id }).from(users).where(eq(users.id, parseInt(partnerId)));
      if (partnerUser.length === 0) {
        return NextResponse.json({ error: "Partner-User nicht gefunden" }, { status: 400 });
      }
    }

    const [inserted] = await db.insert(travelMaps).values({
      userId,
      name: name.trim(),
      description: description?.trim() || null,
      partnerId: partnerId ? parseInt(partnerId) : null,
    });

    return NextResponse.json({ id: inserted.insertId, success: true }, { status: 201 });
  } catch (error) {
    console.error("POST /api/reisen:", error);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
