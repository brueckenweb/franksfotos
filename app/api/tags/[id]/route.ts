/**
 * FranksFotos – Tag bearbeiten
 * PATCH /api/tags/[id] – Gruppe eines Tags ändern
 * DELETE /api/tags/[id] – Tag löschen (alternativ zu ?id=)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { tags } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type SessionUser = { isMainAdmin?: boolean; id?: string; permissions?: string[] };

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    const user = session?.user as SessionUser | undefined;
    if (!user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }
    if (!user.isMainAdmin) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;
    const tagId = parseInt(id);
    if (!tagId) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

    const body = await request.json();
    const { groupId } = body;

    await db
      .update(tags)
      .set({ groupId: groupId ? parseInt(String(groupId)) : null })
      .where(eq(tags.id, tagId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/tags/[id] Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    const user = session?.user as SessionUser | undefined;
    if (!user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }
    if (!user.isMainAdmin) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;
    const tagId = parseInt(id);
    if (!tagId) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

    await db.delete(tags).where(eq(tags.id, tagId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/tags/[id] Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}
