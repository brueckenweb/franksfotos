/**
 * GET /api/alben – Alle Alben (Admin-Liste für Dropdowns etc.)
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { albums } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const all = await db
      .select({
        id: albums.id,
        name: albums.name,
        slug: albums.slug,
        parentId: albums.parentId,
        sortOrder: albums.sortOrder,
      })
      .from(albums)
      .orderBy(asc(albums.sortOrder), asc(albums.name));

    return NextResponse.json(all);
  } catch (error) {
    console.error("GET /api/alben Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}
