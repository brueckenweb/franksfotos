/**
 * API: GPX-Datei-Upload (Server-Proxy → PHP-Endpoint)
 * POST /api/gpx/upload  multipart/form-data { gpxFile: File }
 * Nur für isMainAdmin. Proxied den Upload zu pics.frank-sellke.de/gpx-upload.php.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const GPX_UPLOAD_PHP =
  process.env.GPX_UPLOAD_PHP_ENDPOINT ?? "https://pics.frank-sellke.de/gpx-upload.php";
const UPLOAD_KEY = process.env.UPLOAD_API_KEY ?? process.env.UPLOAD_KEY ?? "";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("gpxFile") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Keine Datei" }, { status: 400 });
    }

    // An PHP-Endpoint weiterleiten
    const fd = new FormData();
    fd.append("gpxFile", file, file.name);

    const res = await fetch(GPX_UPLOAD_PHP, {
      method: "POST",
      headers: { "X-API-Key": UPLOAD_KEY },
      body: fd,
    });

    // Antwort-Body als Text lesen, dann ggf. als JSON parsen
    const rawText = await res.text();
    const contentType = res.headers.get("content-type") ?? "";

    let data: Record<string, unknown> = {};
    if (contentType.includes("application/json")) {
      try {
        data = JSON.parse(rawText);
      } catch {
        // JSON-Parse-Fehler → data bleibt leer
      }
    }

    if (!res.ok || !data.success) {
      const errMsg = data.error as string | undefined
        ?? (rawText.length < 200 ? rawText : `HTTP ${res.status} – PHP-Endpoint nicht erreichbar`);
      console.error("[GPX upload] PHP-Antwort:", res.status, rawText.slice(0, 300));
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    return NextResponse.json({
      success:      true,
      url:          data.url,
      filename:     data.filename,
      originalName: data.originalName,
    });
  } catch (err) {
    console.error("[GPX upload]", err);
    return NextResponse.json({ error: "Server-Fehler" }, { status: 500 });
  }
}
