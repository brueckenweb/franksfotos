/**
 * FranksFotos – Diashow-Musik API
 * GET  /api/albums/[id]/slideshow-music   – Musikliste laden
 * POST /api/albums/[id]/slideshow-music   – MP3 hochladen + DB-Eintrag
 * PUT  /api/albums/[id]/slideshow-music   – Reihenfolge speichern
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { albumSlideshowMusic, albums } from "@/lib/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { UPLOAD_CONFIG, UploadConfigHelper } from "@/lib/upload/config";

type Props = { params: Promise<{ id: string }> };

// ── GET: Musikliste laden ────────────────────────────────────────────
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const albumId = parseInt(id);
    if (isNaN(albumId)) {
      return NextResponse.json({ error: "Ungültige Album-ID" }, { status: 400 });
    }

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const music = await db
      .select()
      .from(albumSlideshowMusic)
      .where(eq(albumSlideshowMusic.albumId, albumId))
      .orderBy(asc(albumSlideshowMusic.sortOrder), asc(albumSlideshowMusic.createdAt));

    return NextResponse.json({ music });
  } catch (error) {
    console.error("GET slideshow-music Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}

// ── POST: MP3 hochladen ──────────────────────────────────────────────
export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const albumId = parseInt(id);
    if (isNaN(albumId)) {
      return NextResponse.json({ error: "Ungültige Album-ID" }, { status: 400 });
    }

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const isMainAdmin = (session.user as { isMainAdmin?: boolean }).isMainAdmin ?? false;
    if (!isMainAdmin) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    // Album existiert?
    const albumResult = await db
      .select({ id: albums.id })
      .from(albums)
      .where(eq(albums.id, albumId))
      .limit(1);
    if (!albumResult[0]) {
      return NextResponse.json({ error: "Album nicht gefunden" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string | null) ?? null;
    const durationSecRaw = formData.get("durationSec");
    const durationSec = durationSecRaw ? parseInt(durationSecRaw as string) : null;

    if (!file) {
      return NextResponse.json({ error: "Keine Datei übermittelt" }, { status: 400 });
    }

    // Validierung
    const validation = UploadConfigHelper.validateFile(
      { name: file.name, size: file.size, type: file.type },
      "music"
    );
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Dateiname generieren
    const finalFileName = UploadConfigHelper.generateUniqueFilename(file.name);
    const targetConfig = UPLOAD_CONFIG.targets["music"];
    const phpEndpoint = UPLOAD_CONFIG.phpEndpoint;
    const fileBuffer = await file.arrayBuffer();

    // Upload zum PHP-Server
    const uploadResponse = await fetch(phpEndpoint, {
      method: "POST",
      headers: {
        "X-API-Key":      process.env.UPLOAD_API_KEY || "",
        "X-Upload-Path":  "musik",
        "X-Upload-Name":  finalFileName,
        "Content-Type":   file.type || "audio/mpeg",
        "Content-Length": String(file.size),
      },
      body: fileBuffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("Upload-Fehler:", errorText);
      return NextResponse.json({ error: "Upload zum Server fehlgeschlagen" }, { status: 500 });
    }

    let phpResult: { fileName?: string; fileUrl?: string } = {};
    try {
      phpResult = await uploadResponse.json();
    } catch {
      // Fallback
    }

    const actualFileName = phpResult.fileName ?? finalFileName;
    const fileUrl = phpResult.fileUrl ?? `${targetConfig.remote}${actualFileName}`;

    // Nächste sortOrder ermitteln
    const existing = await db
      .select({ sortOrder: albumSlideshowMusic.sortOrder })
      .from(albumSlideshowMusic)
      .where(eq(albumSlideshowMusic.albumId, albumId))
      .orderBy(asc(albumSlideshowMusic.sortOrder));

    const nextSortOrder = existing.length > 0
      ? Math.max(...existing.map((e) => e.sortOrder)) + 1
      : 1;

    // DB-Eintrag anlegen
    const resolvedTitle = title || actualFileName.replace(/\.[^/.]+$/, "");
    const resolvedDuration = durationSec && !isNaN(durationSec) ? durationSec : null;

    await db.insert(albumSlideshowMusic).values({
      albumId,
      filename: actualFileName,
      fileUrl,
      title: resolvedTitle,
      durationSec: resolvedDuration,
      sortOrder: nextSortOrder,
    });

    // ID des neuen Eintrags zuverlässig aus der DB holen
    const inserted = await db
      .select()
      .from(albumSlideshowMusic)
      .where(eq(albumSlideshowMusic.albumId, albumId))
      .orderBy(desc(albumSlideshowMusic.id))
      .limit(1);

    const newEntry = inserted[0];

    return NextResponse.json({
      success: true,
      music: {
        id: newEntry.id,
        albumId,
        filename: actualFileName,
        fileUrl,
        title: resolvedTitle,
        durationSec: resolvedDuration,
        sortOrder: nextSortOrder,
      },
    });
  } catch (error) {
    console.error("POST slideshow-music Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}

// ── PUT: Reihenfolge speichern ───────────────────────────────────────
export async function PUT(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const albumId = parseInt(id);
    if (isNaN(albumId)) {
      return NextResponse.json({ error: "Ungültige Album-ID" }, { status: 400 });
    }

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const isMainAdmin = (session.user as { isMainAdmin?: boolean }).isMainAdmin ?? false;
    if (!isMainAdmin) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await request.json();
    const { order } = body as { order: Array<{ id: number; sortOrder: number }> };

    if (!Array.isArray(order)) {
      return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
    }

    for (const item of order) {
      await db
        .update(albumSlideshowMusic)
        .set({ sortOrder: item.sortOrder })
        .where(eq(albumSlideshowMusic.id, item.id));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT slideshow-music Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}
