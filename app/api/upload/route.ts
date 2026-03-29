/**
 * FranksFotos – Upload API Route
 * Empfängt Dateien und leitet sie zu pics.frank-sellke.de weiter
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { UPLOAD_CONFIG, UploadConfigHelper } from "@/lib/upload/config";
import { hasPermission } from "@/lib/auth/permissions";

export async function POST(request: NextRequest) {
  try {
    // Auth prüfen
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const targetKey = formData.get("target") as string || "photos";
    const fileName = formData.get("fileName") as string;
    const subfolder = formData.get("subfolder") as string || "";
    const albumSlug = (formData.get("albumSlug") as string || "").trim();

    if (!file) {
      return NextResponse.json({ error: "Keine Datei übermittelt" }, { status: 400 });
    }

    // Upload-Ziel-Konfiguration laden
    const targetConfig = UPLOAD_CONFIG.targets[targetKey];
    if (!targetConfig) {
      return NextResponse.json({ error: `Unbekanntes Upload-Ziel: ${targetKey}` }, { status: 400 });
    }

    // Berechtigungen prüfen
    if (targetConfig.requiresPermission) {
      const userPermissions = (session.user as { permissions?: string[]; isMainAdmin?: boolean }).permissions ?? [];
      const isMainAdmin = (session.user as { isMainAdmin?: boolean }).isMainAdmin ?? false;

      if (!isMainAdmin && !hasPermission(userPermissions, targetConfig.requiresPermission as never)) {
        return NextResponse.json(
          { error: `Keine Berechtigung: ${targetConfig.requiresPermission}` },
          { status: 403 }
        );
      }
    }

    // Datei validieren
    const validation = UploadConfigHelper.validateFile(
      { name: file.name, size: file.size, type: file.type },
      targetKey
    );
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Dateiname vorbereiten
    const finalFileName = fileName || UploadConfigHelper.generateUniqueFilename(file.name);

    // targetKey → PHP-Ordnername mappen
    const phpFolderMap: Record<string, string> = {
      photos: "fotos",
      videos: "videos",
      videoThumbnails: "video-thumbs",
      avatars: "avatars",
    };
    const phpFolder = phpFolderMap[targetKey] ?? targetKey;

    // Pfad auf dem PHP-Server: fotos/album-slug  oder  fotos
    const phpPath = albumSlug ? `${phpFolder}/${albumSlug}` : phpFolder;

    const phpEndpoint = UPLOAD_CONFIG.phpEndpoint;

    // Datei als raw binary senden (application/octet-stream).
    // Das umgeht PHP's post_max_size-Limit, das multipart/form-data-Uploads
    // auf 8 MB (Standard) begrenzt. php://input ist davon NICHT betroffen.
    // Metadaten (Pfad, Dateiname) gehen als HTTP-Header mit.
    const fileBuffer = await file.arrayBuffer();

    const uploadResponse = await fetch(phpEndpoint, {
      method: "POST",
      headers: {
        "X-API-Key":      process.env.UPLOAD_API_KEY || "",
        "X-Upload-Path":  phpPath,
        "X-Upload-Name":  finalFileName,
        "Content-Type":   file.type || "application/octet-stream",
        "Content-Length": String(file.size),
      },
      body: fileBuffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("Upload-Fehler:", errorText);
      return NextResponse.json(
        { error: "Upload zum Server fehlgeschlagen" },
        { status: 500 }
      );
    }

    // PHP-Antwort parsen – fileUrl kommt direkt vom Server und ist garantiert korrekt.
    // (PHP bereinigt/normalisiert den Dateinamen; wir verwenden daher NICHT den lokal
    //  generierten Namen, um Inkonsistenzen zwischen DB und tatsächlichem Dateinamen
    //  zu vermeiden.)
    let phpResult: { fileName?: string; fileUrl?: string } = {};
    try {
      phpResult = await uploadResponse.json();
    } catch {
      console.warn("PHP-Antwort konnte nicht als JSON gelesen werden – verwende lokale URL-Konstruktion");
    }

    // PHP-URL bevorzugen; Fallback: lokal konstruierte URL
    const actualFileName = phpResult.fileName ?? finalFileName;
    const fileUrl = phpResult.fileUrl ?? (
      albumSlug
        ? `${targetConfig.remote}${albumSlug}/${actualFileName}`
        : `${targetConfig.remote}${actualFileName}`
    );

    // Thumbnail-URL: Dateiname ggf. von PHP (lowercase) übernehmen
    const thumbName = actualFileName.replace(/\.[^/.]+$/, "_thumb.jpg");
    const thumbnailUrl = targetConfig.thumbnailPath
      ? albumSlug
        ? `${targetConfig.thumbnailPath}${albumSlug}/${thumbName}`
        : `${targetConfig.thumbnailPath}${thumbName}`
      : null;

    return NextResponse.json({
      success: true,
      fileName: actualFileName,
      fileUrl,
      thumbnailUrl,
    });

  } catch (error) {
    console.error("Upload-API-Fehler:", error);
    return NextResponse.json(
      { error: "Interner Server-Fehler" },
      { status: 500 }
    );
  }
}

