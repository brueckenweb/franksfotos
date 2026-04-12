/**
 * FranksFotos – Tags API
 * GET  /api/tags – Alle Tags
 * POST /api/tags – Neuen Tag anlegen
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { tags, tagGroups, photoTags, videoTags } from "@/lib/db/schema";
import { eq, count, desc } from "drizzle-orm";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const allTags = await db
      .select({
        id: tags.id,
        name: tags.name,
        slug: tags.slug,
        groupId: tags.groupId,
        groupName: tagGroups.name,
        groupSlug: tagGroups.slug,
        groupColor: tagGroups.color,
        createdAt: tags.createdAt,
      })
      .from(tags)
      .leftJoin(tagGroups, eq(tags.groupId, tagGroups.id))
      .orderBy(tagGroups.name, tags.name);

    return NextResponse.json(allTags);
  } catch (error) {
    console.error("GET /api/tags Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    // Alle eingeloggten User dürfen Tags anlegen
    const body = await request.json();
    const { name, groupId } = body;

    if (!name) {
      return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
    }

    // Slug aus Name generieren
    const slug = name
      .toLowerCase()
      .replace(/[äöüß]/g, (c: string) => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" }[c] || c))
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const userId = parseInt((session.user as { id: string }).id);

    const [inserted] = await db
      .insert(tags)
      .values({
        name,
        slug,
        groupId: groupId ? parseInt(String(groupId)) : null,
        createdBy: userId,
      })
      .$returningId();

    return NextResponse.json({ success: true, tagId: inserted.id, slug });
  } catch (error: unknown) {
    // Drizzle wraps mysql2-Fehler in Error.cause → beide Ebenen prüfen
    const isDuplicate = (e: unknown): boolean => {
      if (!e || typeof e !== "object") return false;
      const err = e as { code?: string; errno?: number; message?: string; cause?: unknown };
      if (err.code === "ER_DUP_ENTRY" || err.errno === 1062) return true;
      if (typeof err.message === "string" && err.message.includes("Duplicate entry")) return true;
      // Drizzle wraps the original error in .cause
      if (err.cause) return isDuplicate(err.cause);
      return false;
    };
    if (isDuplicate(error)) {
      return NextResponse.json({ error: "Tag existiert bereits" }, { status: 409 });
    }
    console.error("POST /api/tags Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const userPermissions = (session.user as { permissions?: string[]; isMainAdmin?: boolean }).permissions ?? [];
    const isMainAdmin = (session.user as { isMainAdmin?: boolean }).isMainAdmin ?? false;

    if (!isMainAdmin && !hasPermission(userPermissions, PERMISSIONS.CREATE_TAGS)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tagId = parseInt(searchParams.get("id") || "0");

    if (!tagId) {
      return NextResponse.json({ error: "Tag-ID fehlt" }, { status: 400 });
    }

    await db.delete(tags).where(eq(tags.id, tagId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/tags Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}
