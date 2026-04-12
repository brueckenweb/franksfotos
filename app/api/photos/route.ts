/**
 * FranksFotos – Photos API
 * GET  /api/photos – Liste aller Fotos (Admin)
 * POST /api/photos – Neues Foto anlegen (nach Upload)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { photos, albums, photoTags } from "@/lib/db/schema";
import { eq, desc, like, and, isNull } from "drizzle-orm";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const albumId = searchParams.get("albumId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    const conditions = [];
    if (albumId) {
      conditions.push(eq(photos.albumId, parseInt(albumId)));
    }

    const allPhotos = await db
      .select({
        id: photos.id,
        albumId: photos.albumId,
        filename: photos.filename,
        title: photos.title,
        description: photos.description,
        fileUrl: photos.fileUrl,
        thumbnailUrl: photos.thumbnailUrl,
        width: photos.width,
        height: photos.height,
        fileSize: photos.fileSize,
        isPrivate: photos.isPrivate,
        sortOrder: photos.sortOrder,
        bnummer: photos.bnummer,
        createdAt: photos.createdAt,
        albumName: albums.name,
      })
      .from(photos)
      .leftJoin(albums, eq(photos.albumId, albums.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(photos.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({ photos: allPhotos });
  } catch (error) {
    console.error("GET /api/photos Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const userPermissions = (session.user as { permissions?: string[]; isMainAdmin?: boolean }).permissions ?? [];
    const isMainAdmin = (session.user as { isMainAdmin?: boolean }).isMainAdmin ?? false;

    if (!isMainAdmin && !hasPermission(userPermissions, PERMISSIONS.UPLOAD_PHOTOS)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await request.json();
    const {
      albumId,
      filename,
      title,
      description,
      fileUrl,
      thumbnailUrl,
      width,
      height,
      fileSize,
      exifData,
      isPrivate,
      sortOrder,
      bnummer,
      tagIds,
    } = body;

    if (!filename || !fileUrl) {
      return NextResponse.json({ error: "filename und fileUrl sind erforderlich" }, { status: 400 });
    }

    const userId = parseInt((session.user as { id: string }).id);

    const [inserted] = await db
      .insert(photos)
      .values({
        albumId: albumId || null,
        filename,
        title: title || null,
        description: description || null,
        fileUrl,
        thumbnailUrl: thumbnailUrl || null,
        width: width || null,
        height: height || null,
        fileSize: fileSize || null,
        exifData: exifData || null,
        isPrivate: isPrivate ?? false,
        sortOrder: sortOrder ?? 0,
        bnummer: bnummer || null,
        createdBy: userId,
      })
      .$returningId();

    // Tags speichern (falls übergeben)
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      await db.insert(photoTags).values(
        tagIds.map((tagId: number) => ({ photoId: inserted.id, tagId }))
      );
    }

    return NextResponse.json({ success: true, photoId: inserted.id });
  } catch (error) {
    console.error("POST /api/photos Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}
