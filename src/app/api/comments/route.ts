/**
 * FranksFotos – Comments API
 * GET   /api/comments?photoId=X  – Kommentare laden
 * POST  /api/comments            – Kommentar erstellen
 * PATCH /api/comments?id=X       – Kommentar genehmigen/ablehnen
 * DELETE /api/comments?id=X      – Kommentar löschen
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { comments, users } from "@/lib/db/schema";
import { eq, desc, isNull, and, or } from "drizzle-orm";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    const { searchParams } = new URL(request.url);
    const photoId = searchParams.get("photoId");
    const videoId = searchParams.get("videoId");
    const all = searchParams.get("all"); // Admin: alle Kommentare

    const conditions = [];

    if (photoId) {
      conditions.push(eq(comments.photoId, parseInt(photoId)));
    } else if (videoId) {
      conditions.push(eq(comments.videoId, parseInt(videoId)));
    }

    if (!all) {
      conditions.push(eq(comments.isApproved, true));
    } else {
      // Admin-Modus: Auth prüfen
      if (!session?.user) {
        return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
      }
    }

    const allComments = await db
      .select({
        id: comments.id,
        photoId: comments.photoId,
        videoId: comments.videoId,
        content: comments.content,
        isApproved: comments.isApproved,
        createdAt: comments.createdAt,
        userName: users.name,
        userAvatar: users.avatar,
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(comments.createdAt));

    return NextResponse.json({ comments: allComments });
  } catch (error) {
    console.error("GET /api/comments Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const userPermissions = (session.user as { permissions?: string[]; isMainAdmin?: boolean }).permissions ?? [];
    const isMainAdmin = (session.user as { isMainAdmin?: boolean }).isMainAdmin ?? false;

    if (!isMainAdmin && !hasPermission(userPermissions, PERMISSIONS.COMMENT)) {
      return NextResponse.json({ error: "Keine Berechtigung zum Kommentieren" }, { status: 403 });
    }

    const body = await request.json();
    const { photoId, videoId, content } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: "Kommentar darf nicht leer sein" }, { status: 400 });
    }

    if (!photoId && !videoId) {
      return NextResponse.json({ error: "photoId oder videoId ist erforderlich" }, { status: 400 });
    }

    const userId = parseInt((session.user as { id: string }).id);

    const [inserted] = await db
      .insert(comments)
      .values({
        photoId: photoId || null,
        videoId: videoId || null,
        userId,
        content: content.trim(),
        isApproved: isMainAdmin, // Admins brauchen keine Freigabe
      })
      .$returningId();

    return NextResponse.json({ success: true, commentId: inserted.id });
  } catch (error) {
    console.error("POST /api/comments Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const userPermissions = (session.user as { permissions?: string[]; isMainAdmin?: boolean }).permissions ?? [];
    const isMainAdmin = (session.user as { isMainAdmin?: boolean }).isMainAdmin ?? false;

    if (!isMainAdmin) {
      return NextResponse.json({ error: "Nur Admins können Kommentare freigeben" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const commentId = parseInt(searchParams.get("id") || "0");

    const body = await request.json();
    const { isApproved } = body;

    await db
      .update(comments)
      .set({ isApproved })
      .where(eq(comments.id, commentId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/comments Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const isMainAdmin = (session.user as { isMainAdmin?: boolean }).isMainAdmin ?? false;
    if (!isMainAdmin) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const commentId = parseInt(searchParams.get("id") || "0");

    await db.delete(comments).where(eq(comments.id, commentId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/comments Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}
