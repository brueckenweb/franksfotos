import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { photoTags } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; tagId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const isMainAdmin = (session.user as { isMainAdmin?: boolean }).isMainAdmin ?? false;
    if (!isMainAdmin) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id, tagId } = await params;
    const photoId = parseInt(id);
    const tagIdNum = parseInt(tagId);

    if (isNaN(photoId) || isNaN(tagIdNum)) {
      return NextResponse.json({ error: "Ungültige IDs" }, { status: 400 });
    }

    await db
      .delete(photoTags)
      .where(and(eq(photoTags.photoId, photoId), eq(photoTags.tagId, tagIdNum)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fehler beim Entfernen des Tags:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}