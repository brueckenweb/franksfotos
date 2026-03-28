import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { photoTags } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const isMainAdmin = (session.user as { isMainAdmin?: boolean }).isMainAdmin ?? false;
    if (!isMainAdmin) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;
    const photoId = parseInt(id);
    if (isNaN(photoId)) {
      return NextResponse.json({ error: "Ungültige Foto-ID" }, { status: 400 });
    }

    const { tagId } = await request.json();
    if (!tagId) {
      return NextResponse.json({ error: "Tag-ID ist erforderlich" }, { status: 400 });
    }

    // Prüfen, ob die Kombination bereits existiert
    const existing = await db
      .select()
      .from(photoTags)
      .where(and(eq(photoTags.photoId, photoId), eq(photoTags.tagId, tagId)))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ error: "Tag ist bereits zugewiesen" }, { status: 409 });
    }

    await db.insert(photoTags).values({
      photoId,
      tagId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fehler beim Hinzufügen des Tags:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}