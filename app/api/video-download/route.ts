/**
 * FranksFotos – Video-Download-Proxy
 * GET /api/video-download?url=...&filename=...
 *
 * Streamt eine Video-Datei von pics.frank-sellke.de server-seitig durch,
 * damit der Browser sie als Download bekommt (Cross-Origin-Download-Problem umgehen).
 * Nur für eingeloggte User.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET(request: NextRequest) {
  // Auth-Prüfung: nur eingeloggte User dürfen herunterladen
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const url      = searchParams.get("url");
  const filename = searchParams.get("filename") ?? "video";

  if (!url) {
    return NextResponse.json({ error: "url-Parameter fehlt" }, { status: 400 });
  }

  // Nur URLs von pics.frank-sellke.de erlauben (Sicherheit)
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Ungültige URL" }, { status: 400 });
  }

  const allowedHosts = [
    "pics.frank-sellke.de",
  ];
  if (!allowedHosts.includes(parsedUrl.hostname)) {
    return NextResponse.json({ error: "Host nicht erlaubt" }, { status: 403 });
  }

  // Datei vom Medienserver holen
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      headers: {
        // Referer mitsenden, falls der Server das prüft
        "Referer": "https://frank-sellke.de/",
        "User-Agent": "FranksFotos/1.0",
      },
    });
  } catch {
    return NextResponse.json({ error: "Verbindung zum Medienserver fehlgeschlagen" }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Medienserver antwortete mit HTTP ${upstream.status}` },
      { status: upstream.status }
    );
  }

  const contentType   = upstream.headers.get("content-type") ?? "video/mp4";
  const contentLength = upstream.headers.get("content-length");

  // Sicherer Dateiname (keine Path-Traversal)
  const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");

  const headers: Record<string, string> = {
    "Content-Type":        contentType,
    "Content-Disposition": `attachment; filename="${safeFilename}"`,
    "Cache-Control":       "no-store",
  };
  if (contentLength) {
    headers["Content-Length"] = contentLength;
  }

  return new NextResponse(upstream.body, { headers });
}
