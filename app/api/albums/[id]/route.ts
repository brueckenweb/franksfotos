/**
 * FranksFotos – Album by ID
 * GET    /api/albums/[id]
 * PUT    /api/albums/[id]
 * DELETE /api/albums/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { albums, albumVisibility, groups, tags } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const { id } = await params;
    const albumId = parseInt(id);

    const albumResult = await db
      .select()
      .from(albums)
      .where(eq(albums.id, albumId))
      .limit(1);

    if (!albumResult[0]) {
      return NextResponse.json({ error: "Album nicht gefunden" }, { status: 404 });
    }

    // Sichtbarkeit laden
    const visibility = await db
      .select({ groupSlug: groups.slug, groupName: groups.name })
      .from(albumVisibility)
      .innerJoin(groups, eq(albumVisibility.groupId, groups.id))
      .where(eq(albumVisibility.albumId, albumId));

    return NextResponse.json({
      album: albumResult[0],
      visibility,
    });
  } catch (error) {
    console.error("GET /api/albums/[id] Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const userPermissions = (session.user as { permissions?: string[]; isMainAdmin?: boolean }).permissions ?? [];
    const isMainAdmin = (session.user as { isMainAdmin?: boolean }).isMainAdmin ?? false;

    if (!isMainAdmin && !hasPermission(userPermissions, PERMISSIONS.MANAGE_ALBUMS)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;
    const albumId = parseInt(id);
    const body = await request.json();
    const { name, slug, description, parentId, sortOrder, isActive, childSortMode, photoSortMode, coverPhotoId, visibleForGroups, sourceType, tagId } = body;

    const validPhotoSortModes = ["created_asc", "created_desc", "title_asc", "title_desc", "filename_asc", "manual"];
    const safePhotoSortMode = validPhotoSortModes.includes(photoSortMode) ? photoSortMode : "created_asc";
    const safeSourceType = sourceType === "tag" ? "tag" : "own";

    await db
      .update(albums)
      .set({
        name,
        slug,
        description: description || null,
        parentId: parentId || null,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
        childSortMode: ["alpha", "alpha_desc"].includes(childSortMode) ? childSortMode : "order",
        photoSortMode: safePhotoSortMode,
        coverPhotoId: coverPhotoId ?? null,
        sourceType: safeSourceType,
        tagId: safeSourceType === "tag" && tagId ? parseInt(tagId) : null,
      })
      .where(eq(albums.id, albumId));

    // Sichtbarkeit aktualisieren
    if (visibleForGroups !== undefined) {
      await db.delete(albumVisibility).where(eq(albumVisibility.albumId, albumId));

      if (Array.isArray(visibleForGroups) && visibleForGroups.length > 0) {
        for (const groupSlug of visibleForGroups) {
          const groupResult = await db
            .select({ id: groups.id })
            .from(groups)
            .where(eq(groups.slug, groupSlug))
            .limit(1);
          if (groupResult[0]) {
            await db
              .insert(albumVisibility)
              .values({ albumId, groupId: groupResult[0].id })
              .onDuplicateKeyUpdate({ set: { albumId, groupId: groupResult[0].id } });
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/albums/[id] Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const userPermissions = (session.user as { permissions?: string[]; isMainAdmin?: boolean }).permissions ?? [];
    const isMainAdmin = (session.user as { isMainAdmin?: boolean }).isMainAdmin ?? false;

    if (!isMainAdmin && !hasPermission(userPermissions, PERMISSIONS.MANAGE_ALBUMS)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;
    const albumId = parseInt(id);

    await db.delete(albums).where(eq(albums.id, albumId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/albums/[id] Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}
