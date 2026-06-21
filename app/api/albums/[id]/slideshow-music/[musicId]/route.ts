/**
 * FranksFotos – Einzelne Diashow-Musik
 * DELETE /api/albums/[id]/slideshow-music/[musicId]
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { albumSlideshowMusic } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

type Props = { params: Promise<{ id: string; musicId: string }> };

export async function DELETE(request: NextRequest, { params }: Props) {
  try {
    const { id, musicId } = await params;
    const albumId = parseInt(id);
    const musicIdNum = parseInt(musicId);

    if (isNaN(albumId) || isNaN(musicIdNum)) {
      return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
    }

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const isMainAdmin = (session.user as { isMainAdmin?: boolean }).isMainAdmin ?? false;
    if (!isMainAdmin) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    await db
      .delete(albumSlideshowMusic)
      .where(
        and(
          eq(albumSlideshowMusic.id, musicIdNum),
          eq(albumSlideshowMusic.albumId, albumId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE slideshow-music Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}
