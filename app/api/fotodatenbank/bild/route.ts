/**
 * API-Route: Bild/Video aus zuverarbeiten-Ordner on-the-fly ausliefern
 * GET /api/fotodatenbank/bild?datei=1234.jpg
 * Nur für isMainAdmin zugänglich
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import fs from "fs";
import path from "path";

const BASE_PATH =
  process.env.FS_FOTODATENBANK_PATH ?? "C:\\FS_Fotodatenbank";
const ZUVERARBEITEN_PATH = path.join(BASE_PATH, "zuverarbeiten");

const MIME_TYPES: Record<string, string> = {
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  dsc:  "image/jpeg",
  mp4:  "video/mp4",
  mov:  "video/quicktime",
  png:  "image/png",
  gif:  "image/gif",
  webp: "image/webp",
};

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return new NextResponse("Kein Zugriff", { status: 403 });
  }

  const datei = request.nextUrl.searchParams.get("datei");

  // Sicherheitscheck: keine Pfad-Traversals
  if (
    !datei ||
    datei.includes("..") ||
    datei.includes("/") ||
    datei.includes("\\")
  ) {
    return new NextResponse("Ungültige Datei", { status: 400 });
  }

  const filePath = path.join(ZUVERARBEITEN_PATH, datei);

  if (!fs.existsSync(filePath)) {
    return new NextResponse("Datei nicht gefunden", { status: 404 });
  }

  const ext = path.extname(datei).toLowerCase().replace(".", "");
  const mimeType = MIME_TYPES[ext] ?? "application/octet-stream";

  try {
    const buffer = fs.readFileSync(filePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "no-store",
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    console.error("Bild-Auslieferungs-Fehler:", error);
    return new NextResponse("Fehler beim Lesen der Datei", { status: 500 });
  }
}
