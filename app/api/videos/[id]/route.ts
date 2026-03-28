/**
 * FranksFotos – Video by ID
 * GET    /api/videos/[id]
 * PUT    /api/videos/[id]
 * DELETE /api/videos/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { videos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";

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
    const videoId = parseInt(id);

    await db.delete(videos).where(eq(videos.id, videoId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/videos/[id] Fehler:", error);
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
    const videoId = parseInt(id);
    const body = await request.json();
    const { title, description, albumId, isPrivate, sortOrder, bnummer } = body;

    await db
      .update(videos)
      .set({
        title: title ?? null,
        description: description ?? null,
        albumId: albumId ?? null,
        isPrivate: isPrivate ?? false,
        sortOrder: sortOrder ?? 0,
        bnummer: bnummer ?? null,
      })
      .where(eq(videos.id, videoId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/videos/[id] Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}
