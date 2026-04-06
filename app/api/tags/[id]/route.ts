/**
 * FranksFotos – Tag bearbeiten
 * PATCH /api/tags/[id] – Name und/oder Gruppe eines Tags ändern
 * DELETE /api/tags/[id] – Tag löschen
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { tags } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[äöüß]/g, (c: string) => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" }[c] ?? c))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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
    const { groupId, name } = body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};

    if ("groupId" in body) {
      updateData.groupId = groupId ? parseInt(String(groupId)) : null;
    }

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) {
        return NextResponse.json({ error: "Name darf nicht leer sein" }, { status: 400 });
      }
      updateData.name = trimmed;
      updateData.slug = slugify(trimmed);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Keine Änderungen" }, { status: 400 });
    }

    await db.update(tags).set(updateData).where(eq(tags.id, tagId));

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
