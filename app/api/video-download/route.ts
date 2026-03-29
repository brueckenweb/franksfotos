/**
 * FranksFotos – Video-Proxy (Streaming + Download)
 * GET /api/video-download?url=...&filename=...&inline=1
 *
 * Streamt Video-Dateien von pics.frank-sellke.de server-seitig durch.
 * - inline=1  → für den Player (Content-Disposition: inline)
 * - inline=0  → für den Download-Button (Content-Disposition: attachment)
 *
 * Unterstützt HTTP Range Requests (206 Partial Content) für Video-Seeking.
 * Nur für eingeloggte User.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const ALLOWED_HOSTS = ["pics.frank-sellke.de"];

export async function GET(request: NextRequest) {
  // Auth-Prüfung
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const url      = searchParams.get("url");
  const filename = searchParams.get("filename") ?? "video";
  const inline   = searchParams.get("inline") === "1";

  if (!url) {
    return NextResponse.json({ error: "url-Parameter fehlt" }, { status: 400 });
  }

  // Nur bekannte Hosts erlauben
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Ungültige URL" }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.includes(parsedUrl.hostname)) {
    return NextResponse.json({ error: "Host nicht erlaubt" }, { status: 403 });
  }

  // Range-Header vom Browser weiterleiten (wichtig für Seeking!)
  const rangeHeader = request.headers.get("range");

  const upstreamHeaders: Record<string, string> = {
    // Browser-ähnliche Headers, damit ModSecurity/Hotlink-Schutz nicht blockt
    "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept":          "video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5",
    "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
    "Origin":          "https://frank-sellke.de",
    "Referer":         "https://frank-sellke.de/",
  };
  if (rangeHeader) {
    upstreamHeaders["Range"] = rangeHeader;
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      headers: upstreamHeaders,
      // Kein Next.js-Caching für Video-Streams
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "Verbindung zum Medienserver fehlgeschlagen" },
      { status: 502 }
    );
  }

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { error: `Medienserver antwortete mit HTTP ${upstream.status}` },
      { status: upstream.status }
    );
  }

  const contentType   = upstream.headers.get("content-type")   ?? "video/mp4";
  const contentLength = upstream.headers.get("content-length");
  const contentRange  = upstream.headers.get("content-range");
  const acceptRanges  = upstream.headers.get("accept-ranges");

  const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const disposition  = inline
    ? `inline; filename="${safeFilename}"`
    : `attachment; filename="${safeFilename}"`;

  const responseHeaders: Record<string, string> = {
    "Content-Type":        contentType,
    "Content-Disposition": disposition,
    "Cache-Control":       inline ? "private, max-age=3600" : "no-store",
  };

  if (contentLength)  responseHeaders["Content-Length"]  = contentLength;
  if (contentRange)   responseHeaders["Content-Range"]   = contentRange;
  if (acceptRanges)   responseHeaders["Accept-Ranges"]   = acceptRanges;

  // 206 Partial Content für Range-Requests korrekt zurückgeben
  const status = upstream.status === 206 ? 206 : 200;

  return new NextResponse(upstream.body, { status, headers: responseHeaders });
}
