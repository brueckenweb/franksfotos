/**
 * FranksFotos – Batch-Operationen für Fotos
 * PATCH  /api/photos/batch  → Fotos in ein Album verschieben
 * DELETE /api/photos/batch  → Mehrere Fotos löschen
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { photos } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";

/** PATCH – Fotos in ein Album verschieben */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const userPermissions = (session.user as { permissions?: string[] }).permissions ?? [];
    const isMainAdmin = (session.user as { isMainAdmin?: boolean }).isMainAdmin ?? false;

    if (!isMainAdmin && !hasPermission(userPermissions, PERMISSIONS.EDIT_MEDIA_INFO)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await request.json();
    const ids: number[] = body.ids;
    const albumId: number | null = body.albumId ?? null;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Keine Foto-IDs angegeben" }, { status: 400 });
    }

    await db
      .update(photos)
      .set({ albumId })
      .where(inArray(photos.id, ids));

    return NextResponse.json({ success: true, updated: ids.length });
  } catch (error) {
    console.error("PATCH /api/photos/batch Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}

/** DELETE – Mehrere Fotos löschen */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const userPermissions = (session.user as { permissions?: string[] }).permissions ?? [];
    const isMainAdmin = (session.user as { isMainAdmin?: boolean }).isMainAdmin ?? false;

    if (!isMainAdmin && !hasPermission(userPermissions, PERMISSIONS.DELETE_MEDIA)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await request.json();
    const ids: number[] = body.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Keine Foto-IDs angegeben" }, { status: 400 });
    }

    await db.delete(photos).where(inArray(photos.id, ids));

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error) {
    console.error("DELETE /api/photos/batch Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}
