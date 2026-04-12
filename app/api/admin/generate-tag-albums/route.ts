/**
 * POST /api/admin/generate-tag-albums
 * Legt für ausgewählte Tags automatisch Unteralben an.
 *
 * Body: {
 *   parentAlbumId: number,
 *   tagIds: number[],
 *   preview?: boolean   // true = nur Vorschau, kein Anlegen
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { albums, albumVisibility, tags } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

function makeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[äöüß]/g, (c: string) =>
      ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" }[c] ?? c)
    )
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const isMainAdmin = (session?.user as { isMainAdmin?: boolean })?.isMainAdmin;

    if (!session?.user || !isMainAdmin) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await request.json();
    const { parentAlbumId, tagIds, preview = false } = body as {
      parentAlbumId: number;
      tagIds: number[];
      preview?: boolean;
    };

    if (!parentAlbumId || !Array.isArray(tagIds) || tagIds.length === 0) {
      return NextResponse.json(
        { error: "parentAlbumId und tagIds sind erforderlich" },
        { status: 400 }
      );
    }

    // 1. Ausgewählte Tags laden
    const selectedTags = await db
      .select({ id: tags.id, name: tags.name, slug: tags.slug })
      .from(tags)
      .where(inArray(tags.id, tagIds));

    // 2. Bestehende Unteralben des Eltern-Albums laden (Duplikat-Check)
    const existingChildren = await db
      .select({ name: albums.name })
      .from(albums)
      .where(eq(albums.parentId, parentAlbumId));

    const existingNames = new Set(
      existingChildren.map((c) => c.name.toLowerCase())
    );

    // 3. Sichtbarkeit des Eltern-Albums laden (wird kopiert)
    const parentVisibility = await db
      .select({ groupId: albumVisibility.groupId })
      .from(albumVisibility)
      .where(eq(albumVisibility.albumId, parentAlbumId));

    const userId = parseInt((session.user as { id: string }).id);

    const created: { id?: number; name: string; slug: string }[] = [];
    const skipped: { name: string; reason: string }[] = [];

    for (const tag of selectedTags) {
      const tagNameLower = tag.name.toLowerCase();

      if (existingNames.has(tagNameLower)) {
        skipped.push({ name: tag.name, reason: "Unteralbum existiert bereits" });
        continue;
      }

      const slug = makeSlug(tag.name) || `tag-${tag.id}`;

      if (preview) {
        // Nur Vorschau – nichts anlegen
        created.push({ name: tag.name, slug });
        continue;
      }

      // Album anlegen
      const [inserted] = await db
        .insert(albums)
        .values({
          parentId: parentAlbumId,
          name: tag.name,
          slug,
          sourceType: "tag",
          tagId: tag.id,
          isActive: true,
          createdBy: userId,
        })
        .$returningId();

      // Sichtbarkeit vom Eltern-Album kopieren
      if (parentVisibility.length > 0) {
        await db.insert(albumVisibility).values(
          parentVisibility.map((v) => ({
            albumId: inserted.id,
            groupId: v.groupId,
          }))
        );
      }

      created.push({ id: inserted.id, name: tag.name, slug });

      // Verhindert Doppelanlage innerhalb desselben Aufrufs
      existingNames.add(tagNameLower);
    }

    return NextResponse.json({ created, skipped, preview });
  } catch (error) {
    console.error("POST /api/admin/generate-tag-albums Fehler:", error);
    return NextResponse.json(
      { error: "Interner Server-Fehler" },
      { status: 500 }
    );
  }
}
