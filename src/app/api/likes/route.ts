/**
 * FranksFotos – Likes API
 * POST   /api/likes  – Like hinzufügen  { photoId? / videoId? }
 * DELETE /api/likes  – Like entfernen   { photoId? / videoId? }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { likes } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const body = await request.json();
    const { photoId, videoId } = body;

    if (!photoId && !videoId) {
      return NextResponse.json(
        { error: "photoId oder videoId ist erforderlich" },
        { status: 400 }
      );
    }

    const userId = parseInt((session.user as { id: string }).id);

    await db.insert(likes).values({
      photoId: photoId ?? null,
      videoId: videoId ?? null,
      userId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/likes Fehler:", error);
    // Duplicate-Key-Fehler (bereits geliked) → kein Fehler für den Client
    return NextResponse.json({ success: true });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const body = await request.json();
    const { photoId, videoId } = body;

    if (!photoId && !videoId) {
      return NextResponse.json(
        { error: "photoId oder videoId ist erforderlich" },
        { status: 400 }
      );
    }

    const userId = parseInt((session.user as { id: string }).id);

    if (photoId) {
      await db
        .delete(likes)
        .where(and(eq(likes.photoId, photoId), eq(likes.userId, userId)));
    } else if (videoId) {
      await db
        .delete(likes)
        .where(and(eq(likes.videoId, videoId), eq(likes.userId, userId)));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/likes Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}
