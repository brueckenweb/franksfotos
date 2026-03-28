/**
 * FranksFotos – Tag-Gruppen API
 * GET    /api/tag-groups – Alle Tag-Gruppen
 * POST   /api/tag-groups – Neue Gruppe anlegen
 * DELETE /api/tag-groups?id= – Gruppe löschen
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { tagGroups, tags } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[äöüß]/g, (c: string) => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" }[c] ?? c))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type SessionUser = { isMainAdmin?: boolean; id?: string };

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const groups = await db
      .select({
        id: tagGroups.id,
        name: tagGroups.name,
        slug: tagGroups.slug,
        color: tagGroups.color,
        tagCount: count(tags.id),
        createdAt: tagGroups.createdAt,
      })
      .from(tagGroups)
      .leftJoin(tags, eq(tags.groupId, tagGroups.id))
      .groupBy(tagGroups.id)
      .orderBy(tagGroups.name);

    return NextResponse.json(groups);
  } catch (error) {
    console.error("GET /api/tag-groups Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    // Alle eingeloggten User dürfen Gruppen anlegen
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const body = await request.json();
    const { name, color } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
    }

    const hexColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#6b7280";
    const slug = slugify(name.trim());
    const userId = parseInt(((session.user as SessionUser).id) ?? "0");

    const [inserted] = await db
      .insert(tagGroups)
      .values({ name: name.trim(), slug, color: hexColor, createdBy: userId })
      .$returningId();

    return NextResponse.json({ success: true, id: inserted.id, slug });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Gruppe existiert bereits" }, { status: 409 });
    }
    console.error("POST /api/tag-groups Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    const isAdmin = !!(session?.user as SessionUser)?.isMainAdmin;
    if (!session?.user || !isAdmin) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get("id") ?? "0");
    if (!id) return NextResponse.json({ error: "ID fehlt" }, { status: 400 });

    await db.delete(tagGroups).where(eq(tagGroups.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/tag-groups Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}
