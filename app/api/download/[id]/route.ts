/**
 * FranksFotos – Download API mit Wasserzeichen
 * Fügt beim Download ein sichtbares Wasserzeichen ein (Sharp.js)
 * Das Original auf dem Server bleibt unverändert
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { photos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import sharp from "sharp";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const photoId = parseInt(id);

    if (isNaN(photoId)) {
      return NextResponse.json({ error: "Ungültige Foto-ID" }, { status: 400 });
    }

    // Foto aus der Datenbank laden
    const photoResult = await db
      .select()
      .from(photos)
      .where(eq(photos.id, photoId))
      .limit(1);

    const photo = photoResult[0];
    if (!photo) {
      return NextResponse.json({ error: "Foto nicht gefunden" }, { status: 404 });
    }

    // Sichtbarkeits-Check
    const session = await auth();
    if (photo.isPrivate && !session?.user) {
      return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
    }

    // Originalbild von pics.frank-sellke.de laden
    const imageResponse = await fetch(photo.fileUrl, {
      headers: { "User-Agent": "FranksFotos/1.0" },
    });

    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: "Originalbild nicht erreichbar" },
        { status: 502 }
      );
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Wasserzeichen-Text
    const watermarkText =
      process.env.WATERMARK_TEXT || "© FranksFotos – frank-sellke.de";
    const opacity = parseFloat(process.env.WATERMARK_OPACITY || "0.4");

    // Bildgröße ermitteln
    const imageInfo = await sharp(imageBuffer).metadata();
    const width = imageInfo.width || 800;
    const height = imageInfo.height || 600;

    // Wasserzeichen-SVG erstellen
    const fontSize = Math.max(24, Math.round(width * 0.025));
    const padding = 20;
    const textWidth = watermarkText.length * (fontSize * 0.6);
    const textHeight = fontSize + 10;

    const watermarkSvg = `
      <svg width="${textWidth + padding * 2}" height="${textHeight + padding}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.4)" rx="4"/>
        <text
          x="${(textWidth + padding * 2) / 2}"
          y="${textHeight - 5}"
          font-family="Arial, sans-serif"
          font-size="${fontSize}px"
          font-weight="bold"
          fill="rgba(255,255,255,${opacity + 0.3})"
          text-anchor="middle"
        >${watermarkText}</text>
      </svg>
    `;

    const watermarkBuffer = Buffer.from(watermarkSvg);

    // Wasserzeichen auf das Bild legen (unten rechts)
    const processedBuffer = await sharp(imageBuffer)
      .composite([
        {
          input: watermarkBuffer,
          gravity: "southeast",
          blend: "over",
        },
      ])
      .jpeg({ quality: 90 })
      .toBuffer();

    // Dateiname für Download
    const downloadFilename =
      photo.filename.replace(/\.[^/.]+$/, "") + "_franksfotos.jpg";

    return new NextResponse(new Uint8Array(processedBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": `attachment; filename="${downloadFilename}"`,
        "Content-Length": processedBuffer.length.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Download-Fehler:", error);
    return NextResponse.json(
      { error: "Fehler beim Download" },
      { status: 500 }
    );
  }
}
