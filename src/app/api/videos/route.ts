/**
 * FranksFotos – Videos API
 * GET  /api/videos – Liste aller Videos (Admin)
 * POST /api/videos – Neues Video anlegen (nach Upload)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { videos, albums } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
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
      conditions.push(eq(videos.albumId, parseInt(albumId)));
    }

    const allVideos = await db
      .select({
        id: videos.id,
        albumId: videos.albumId,
        filename: videos.filename,
        title: videos.title,
        description: videos.description,
        fileUrl: videos.fileUrl,
        thumbnailUrl: videos.thumbnailUrl,
        duration: videos.duration,
        width: videos.width,
        height: videos.height,
        fileSize: videos.fileSize,
        mimeType: videos.mimeType,
        isPrivate: videos.isPrivate,
        sortOrder: videos.sortOrder,
        bnummer: videos.bnummer,
        createdAt: videos.createdAt,
        albumName: albums.name,
      })
      .from(videos)
      .leftJoin(albums, eq(videos.albumId, albums.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(videos.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({ videos: allVideos });
  } catch (error) {
    console.error("GET /api/videos Fehler:", error);
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

    if (!isMainAdmin && !hasPermission(userPermissions, PERMISSIONS.UPLOAD_VIDEOS)) {
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
      duration,
      width,
      height,
      fileSize,
      mimeType,
      isPrivate,
      sortOrder,
      bnummer,
    } = body;

    if (!filename || !fileUrl) {
      return NextResponse.json({ error: "filename und fileUrl sind erforderlich" }, { status: 400 });
    }

    const userId = parseInt((session.user as { id: string }).id);

    const [inserted] = await db
      .insert(videos)
      .values({
        albumId: albumId || null,
        filename,
        title: title || null,
        description: description || null,
        fileUrl,
        thumbnailUrl: thumbnailUrl || null,
        duration: duration || null,
        width: width || null,
        height: height || null,
        fileSize: fileSize || null,
        mimeType: mimeType || null,
        isPrivate: isPrivate ?? false,
        sortOrder: sortOrder ?? 0,
        bnummer: bnummer || null,
        createdBy: userId,
      })
      .$returningId();

    return NextResponse.json({ success: true, videoId: inserted.id });
  } catch (error) {
    console.error("POST /api/videos Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}
