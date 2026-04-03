/**
 * FranksFotos – Albums API
 * GET /api/albums  – Liste aller Alben
 * POST /api/albums – Neues Album erstellen
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { albums, albumVisibility, groups } from "@/lib/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";

// GET – Alle Alben (Admin-Sicht)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get("parentId");

    const allAlbums = await db
      .select({
        id: albums.id,
        parentId: albums.parentId,
        name: albums.name,
        slug: albums.slug,
        description: albums.description,
        sortOrder: albums.sortOrder,
        isActive: albums.isActive,
        createdAt: albums.createdAt,
      })
      .from(albums)
      .orderBy(albums.sortOrder, albums.name);

    return NextResponse.json({ albums: allAlbums });
  } catch (error) {
    console.error("GET /api/albums Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}

// POST – Neues Album erstellen
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { name, slug, description, parentId, sortOrder, childSortMode, photoSortMode, visibleForGroups, sourceType, tagId } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: "Name und Slug sind erforderlich" }, { status: 400 });
    }

    const validPhotoSortModes = ["created_asc", "created_desc", "title_asc", "title_desc", "filename_asc", "manual"];
    const safePhotoSortMode = validPhotoSortModes.includes(photoSortMode) ? photoSortMode : "created_asc";

    const userId = parseInt((session.user as { id: string }).id);

    const safeSourceType = sourceType === "tag" ? "tag" : "own";

    const [inserted] = await db
      .insert(albums)
      .values({
        name,
        slug,
        description: description || null,
        parentId: parentId || null,
        sortOrder: sortOrder || 0,
        childSortMode: ["alpha", "alpha_desc"].includes(childSortMode) ? childSortMode : "order",
        photoSortMode: safePhotoSortMode,
        isActive: true,
        sourceType: safeSourceType,
        tagId: safeSourceType === "tag" && tagId ? parseInt(tagId) : null,
        createdBy: userId,
      })
      .$returningId();

    const albumId = inserted.id;

    // Sichtbarkeit für Gruppen setzen
    if (visibleForGroups && Array.isArray(visibleForGroups) && visibleForGroups.length > 0) {
      const groupRows = await db
        .select({ id: groups.id })
        .from(groups)
        .where(eq(groups.slug, visibleForGroups[0]));

      const visibilityValues = [];
      for (const groupSlug of visibleForGroups) {
        const groupResult = await db
          .select({ id: groups.id })
          .from(groups)
          .where(eq(groups.slug, groupSlug))
          .limit(1);
        if (groupResult[0]) {
          visibilityValues.push({ albumId, groupId: groupResult[0].id });
        }
      }

      if (visibilityValues.length > 0) {
        await db.insert(albumVisibility).values(visibilityValues);
      }
    }

    return NextResponse.json({ success: true, albumId });
  } catch (error) {
    console.error("POST /api/albums Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}
