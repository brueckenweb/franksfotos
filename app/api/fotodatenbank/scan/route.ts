/**
 * API-Route: DB-Daten für Fotodatenbank-Eingabe holen
 * GET /api/fotodatenbank/scan?lat=...&lon=...
 *
 * HINWEIS: Das Lesen der lokalen Dateien (zuverarbeiten-Ordner) und die
 * EXIF-Extraktion finden jetzt client-seitig via File System Access API statt.
 * Dieser Endpunkt liefert nur noch Datenbankdaten + Reverse-Geocoding.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fdFotodatenbank, fdFotogruppenverkn } from "@/lib/db/schema";
import { max, desc } from "drizzle-orm";

export async function GET(request: Request) {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const latStr = searchParams.get("lat");
  const lonStr = searchParams.get("lon");
  const lat = latStr ? parseFloat(latStr) : NaN;
  const lon = lonStr ? parseFloat(lonStr) : NaN;

  // 1. Nächste bnummer ermitteln
  const [maxResult] = await db
    .select({ max: max(fdFotodatenbank.bnummer) })
    .from(fdFotodatenbank);
  const bnummer = Number(maxResult?.max ?? 0) + 1;

  // 2. Reverse-Geocoding via Nominatim (nur wenn GPS vorhanden)
  let geoLand = "";
  let geoOrt  = "";
  if (!isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0)) {
    try {
      const nominatimUrl =
        `https://nominatim.openstreetmap.org/reverse` +
        `?lat=${lat}&lon=${lon}&format=json&accept-language=de`;
      const geoRes = await fetch(nominatimUrl, {
        headers: {
          "User-Agent":      "FranksFotos/1.0 (frank@brueckenweb.de)",
          "Accept-Language": "de",
        },
        signal: AbortSignal.timeout(5000),
      });
      if (geoRes.ok) {
        const geoJson = await geoRes.json() as {
          address?: {
            country?: string; city?: string; town?: string;
            village?: string; municipality?: string; suburb?: string; county?: string;
          };
        };
        const addr = geoJson.address ?? {};
        geoLand = addr.country ?? "";
        geoOrt  =
          addr.city ?? addr.town ?? addr.village ??
          addr.municipality ?? addr.suburb ?? addr.county ?? "";
      }
    } catch { /* Geocoding-Fehler ignorieren */ }
  }

  // 3. Letzten Eintrag für Vorgabewerte laden
  const [letzterEintrag] = await db
    .select({
      land:     fdFotodatenbank.land,
      ort:      fdFotodatenbank.ort,
      fotograf: fdFotodatenbank.fotograf,
      titel:    fdFotodatenbank.titel,
    })
    .from(fdFotodatenbank)
    .orderBy(desc(fdFotodatenbank.bnummer))
    .limit(1);

  // 4. Letzte verwendete Fotogruppe laden
  const [letzteGruppe] = await db
    .select({ idfgruppe: fdFotogruppenverkn.idfgruppe })
    .from(fdFotogruppenverkn)
    .orderBy(desc(fdFotogruppenverkn.bnummer))
    .limit(1);

  return NextResponse.json({
    bnummer,
    letzterEintrag:  letzterEintrag ?? null,
    letzteIdfgruppe: letzteGruppe?.idfgruppe ?? null,
    geoLand,
    geoOrt,
  });
}
