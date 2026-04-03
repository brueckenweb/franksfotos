/**
 * FranksFotos – Foto-Suche über alle Alben
 * GET /api/photos/search?q=...&page=1&limit=24
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { photos, albums } from "@/lib/db/schema";
import { eq, like, or, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(48, Math.max(6, parseInt(searchParams.get("limit") ?? "24", 10) || 24));

    if (!q) {
      return NextResponse.json({ photos: [], total: 0 });
    }

    const pattern = `%${q}%`;

    const rows = await db
      .select({
        id: photos.id,
        filename: photos.filename,
        title: photos.title,
        fileUrl: photos.fileUrl,
        thumbnailUrl: photos.thumbnailUrl,
        albumName: albums.name,
        albumId: photos.albumId,
      })
      .from(photos)
      .leftJoin(albums, eq(photos.albumId, albums.id))
      .where(
        or(
          like(photos.title, pattern),
          like(photos.filename, pattern)
        )
      )
      .orderBy(desc(photos.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    return NextResponse.json({ photos: rows });
  } catch (error) {
    console.error("GET /api/photos/search Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}
