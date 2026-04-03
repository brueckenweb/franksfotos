/**
 * FranksFotos – Album-Photos API
 * GET /api/albums/[id]/photos?page=1&limit=50  – Fotos eines Albums (paginiert)
 * Unterstützt sourceType 'own' (klassisch via albumId) und 'tag' (via tagId).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { photos, albums, photoTags } from "@/lib/db/schema";
import { eq, and, count, inArray } from "drizzle-orm";

type Props = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const albumId = parseInt(id);

    if (isNaN(albumId)) {
      return NextResponse.json({ error: "Ungültige Album-ID" }, { status: 400 });
    }

    // Album existiert?
    const albumResult = await db
      .select({
        id: albums.id,
        isActive: albums.isActive,
        sourceType: albums.sourceType,
        tagId: albums.tagId,
      })
      .from(albums)
      .where(eq(albums.id, albumId))
      .limit(1);

    if (albumResult.length === 0 || !albumResult[0].isActive) {
      return NextResponse.json({ error: "Album nicht gefunden" }, { status: 404 });
    }

    const album = albumResult[0];

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")));
    const offset = (page - 1) * limit;

    const session = await auth();
    const isLoggedIn = !!session?.user;

    // ── Tag-Album: Fotos über photoTags abrufen ──────────────────────
    if (album.sourceType === "tag" && album.tagId) {
      const tagId = album.tagId;

      // Alle photo-IDs mit diesem Tag ermitteln
      const taggedPhotoRows = await db
        .select({ photoId: photoTags.photoId })
        .from(photoTags)
        .where(eq(photoTags.tagId, tagId));

      const taggedPhotoIds = taggedPhotoRows.map((r) => r.photoId);

      if (taggedPhotoIds.length === 0) {
        return NextResponse.json({
          photos: [],
          pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
        });
      }

      const conditions = isLoggedIn
        ? inArray(photos.id, taggedPhotoIds)
        : and(inArray(photos.id, taggedPhotoIds), eq(photos.isPrivate, false));

      const [tagPhotos, totalCount] = await Promise.all([
        db
          .select({
            id: photos.id,
            filename: photos.filename,
            title: photos.title,
            fileUrl: photos.fileUrl,
            thumbnailUrl: photos.thumbnailUrl,
            width: photos.width,
            height: photos.height,
            fileSize: photos.fileSize,
            isPrivate: photos.isPrivate,
            sortOrder: photos.sortOrder,
            createdAt: photos.createdAt,
          })
          .from(photos)
          .where(conditions)
          .orderBy(photos.createdAt)
          .limit(limit)
          .offset(offset),

        db.select({ cnt: count() }).from(photos).where(conditions),
      ]);

      const total = Number(totalCount[0]?.cnt ?? 0);
      const totalPages = Math.ceil(total / limit);

      return NextResponse.json({
        photos: tagPhotos,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      });
    }

    // ── Eigene Fotos: klassischer albumId-Query ──────────────────────
    const conditions = isLoggedIn
      ? eq(photos.albumId, albumId)
      : and(eq(photos.albumId, albumId), eq(photos.isPrivate, false));

    const [albumPhotos, totalCount] = await Promise.all([
      db
        .select({
          id: photos.id,
          filename: photos.filename,
          title: photos.title,
          fileUrl: photos.fileUrl,
          thumbnailUrl: photos.thumbnailUrl,
          width: photos.width,
          height: photos.height,
          fileSize: photos.fileSize,
          isPrivate: photos.isPrivate,
          sortOrder: photos.sortOrder,
          createdAt: photos.createdAt,
        })
        .from(photos)
        .where(conditions)
        .orderBy(photos.sortOrder, photos.createdAt)
        .limit(limit)
        .offset(offset),

      db
        .select({ cnt: count() })
        .from(photos)
        .where(conditions),
    ]);

    const total = Number(totalCount[0]?.cnt ?? 0);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      photos: albumPhotos,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("GET /api/albums/[id]/photos Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}
