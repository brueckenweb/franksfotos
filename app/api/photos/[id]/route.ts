/**
 * FranksFotos – Photo by ID
 * GET    /api/photos/[id]
 * PUT    /api/photos/[id]
 * DELETE /api/photos/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { photos } from "@/lib/db/schema";
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
    const photoId = parseInt(id);

    const result = await db
      .select()
      .from(photos)
      .where(eq(photos.id, photoId))
      .limit(1);

    if (!result[0]) {
      return NextResponse.json({ error: "Foto nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json({ photo: result[0] });
  } catch (error) {
    console.error("GET /api/photos/[id] Fehler:", error);
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

    if (!isMainAdmin && !hasPermission(userPermissions, PERMISSIONS.EDIT_MEDIA_INFO)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;
    const photoId = parseInt(id);
    const body = await request.json();

    const { title, description, albumId, isPrivate, sortOrder, bnummer } = body;

    await db
      .update(photos)
      .set({
        title: title ?? null,
        description: description ?? null,
        albumId: albumId ?? null,
        isPrivate: isPrivate ?? false,
        sortOrder: sortOrder ?? 0,
        bnummer: bnummer ?? null,
      })
      .where(eq(photos.id, photoId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/photos/[id] Fehler:", error);
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

    if (!isMainAdmin && !hasPermission(userPermissions, PERMISSIONS.DELETE_MEDIA)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;
    const photoId = parseInt(id);

    await db.delete(photos).where(eq(photos.id, photoId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/photos/[id] Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}
