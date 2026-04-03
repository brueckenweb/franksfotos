/**
 * Diese Route wird nicht mehr verwendet.
 * Die Bildvorschau erfolgt jetzt direkt im Browser via Blob-URL
 * (File System Access API in FotodatenbankEingabe.tsx).
 */
import { NextResponse } from "next/server";

export function GET() {
  return new NextResponse("Nicht mehr verfügbar – Vorschau läuft jetzt client-seitig.", { status: 410 });
}
