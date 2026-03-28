/**
 * FranksFotos – Search API
 * GET /api/search?q=suchbegriff&type=photos|albums|tags  – Suche
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { photos, albums, tags } from "@/lib/db/schema";
import { like, or, and, eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const type = searchParams.get("type"); // "photos" | "albums" | "tags" | null (alle)

    if (!q || q.length < 2) {
      return NextResponse.json({ photos: [], albums: [], tags: [] });
    }

    const searchTerm = `%${q}%`;

    const searchPhotos = !type || type === "photos";
    const searchAlbums = !type || type === "albums";
    const searchTags = !type || type === "tags";

    const [foundPhotos, foundAlbums, foundTags] = await Promise.all([
      searchPhotos
        ? db
            .select({
              id: photos.id,
              title: photos.title,
              filename: photos.filename,
              thumbnailUrl: photos.thumbnailUrl,
              fileUrl: photos.fileUrl,
              albumId: photos.albumId,
            })
            .from(photos)
            .where(
              and(
                eq(photos.isPrivate, false),
                or(
                  like(photos.title, searchTerm),
                  like(photos.filename, searchTerm),
                  like(photos.description, searchTerm)
                )
              )
            )
            .limit(24)
        : Promise.resolve([]),

      searchAlbums
        ? db
            .select({
              id: albums.id,
              name: albums.name,
              slug: albums.slug,
              description: albums.description,
            })
            .from(albums)
            .where(
              and(
                eq(albums.isActive, true),
                or(
                  like(albums.name, searchTerm),
                  like(albums.description, searchTerm)
                )
              )
            )
            .limit(10)
        : Promise.resolve([]),

      searchTags
        ? db
            .select({ id: tags.id, name: tags.name, slug: tags.slug })
            .from(tags)
            .where(like(tags.name, searchTerm))
            .limit(10)
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      query: q,
      photos: foundPhotos,
      albums: foundAlbums,
      tags: foundTags,
      total: foundPhotos.length + foundAlbums.length + foundTags.length,
    });
  } catch (error) {
    console.error("GET /api/search Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}
