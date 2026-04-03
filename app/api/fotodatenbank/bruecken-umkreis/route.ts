/**
 * API-Route: Brücken im Umkreis von ~5 km um einen GPS-Punkt laden
 * Fragt brueckendaten (dunkelblau) und brueckendaten_wartend (orange) ab.
 *
 * GET /api/fotodatenbank/bruecken-umkreis?lat=51.12345&lng=7.12345
 *
 * Nur für isMainAdmin zugänglich.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { brueckenDb } from "@/lib/db/brueckendb";
import { sql } from "drizzle-orm";

// Radius in km
const RADIUS_KM = 5;

// Bounding-Box-Deltas für den SQL-Vorfilter (≈ 5,5 km)
//   1° Breite  ≈ 111 km  → 0.050° ≈ 5,55 km
//   1° Länge bei 50°N ≈ 71 km → 0.075° ≈ 5,3 km
const LAT_DELTA = 0.05;
const LNG_DELTA = 0.075;

export async function GET(request: NextRequest) {
  // Auth-Check
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") ?? "0");
  const lng = parseFloat(searchParams.get("lng") ?? "0");

  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
    return NextResponse.json(
      { error: "Gültige lat/lng-Parameter erforderlich" },
      { status: 400 }
    );
  }

  // Bounding-Box-Grenzen (sicher gegen SQL-Injection da parseFloat)
  const latMin = lat - LAT_DELTA;
  const latMax = lat + LAT_DELTA;
  const lngMin = lng - LNG_DELTA;
  const lngMax = lng + LNG_DELTA;

  // Haversine-Ausdruck (Ergebnis in km)
  const haversine = (latCol: string, lngCol: string) => `
    (6371 * acos(
      GREATEST(-1, LEAST(1,
        cos(radians(${lat}))
        * cos(radians(CAST(${latCol} AS DECIMAL(14,10))))
        * cos(radians(CAST(${lngCol} AS DECIMAL(14,10))) - radians(${lng}))
        + sin(radians(${lat}))
        * sin(radians(CAST(${latCol} AS DECIMAL(14,10))))
      ))
    ))
  `;

  try {
    // ── brueckendaten (bestätigte Brücken) ──────────────────────────
    const bdRaw = await brueckenDb.execute(sql.raw(`
      SELECT
        brueckennummer,
        name,
        stadt,
        land,
        CAST(gpslat AS DECIMAL(14,10)) AS gpslat,
        CAST(gpslng AS DECIMAL(14,10)) AS gpslng,
        ${haversine("gpslat", "gpslng")} AS distanz_km
      FROM brueckendaten
      WHERE gpslat IS NOT NULL
        AND gpslng IS NOT NULL
        AND gpslat != 0
        AND gpslng != 0
        AND CAST(gpslat AS DECIMAL(14,10)) BETWEEN ${latMin} AND ${latMax}
        AND CAST(gpslng AS DECIMAL(14,10)) BETWEEN ${lngMin} AND ${lngMax}
      HAVING distanz_km <= ${RADIUS_KM}
      ORDER BY distanz_km ASC
      LIMIT 60
    `));

    // ── brueckendaten_wartend (wartende Brücken) ────────────────────
    const bwRaw = await brueckenDb.execute(sql.raw(`
      SELECT
        wbasid,
        wbas,
        name,
        stadt,
        land,
        CAST(gpslat AS DECIMAL(14,10)) AS gpslat,
        CAST(gpslng AS DECIMAL(14,10)) AS gpslng,
        ${haversine("gpslat", "gpslng")} AS distanz_km
      FROM brueckendaten_wartend
      WHERE aktiv = 'wartend'
        AND gpslat IS NOT NULL
        AND gpslng IS NOT NULL
        AND gpslat != 0
        AND gpslng != 0
        AND CAST(gpslat AS DECIMAL(14,10)) BETWEEN ${latMin} AND ${latMax}
        AND CAST(gpslng AS DECIMAL(14,10)) BETWEEN ${lngMin} AND ${lngMax}
      HAVING distanz_km <= ${RADIUS_KM}
      ORDER BY distanz_km ASC
      LIMIT 60
    `));

    // Drizzle liefert je nach Version [[rows], fields] oder [rows]
    function extractRows(raw: unknown): Record<string, unknown>[] {
      if (!Array.isArray(raw)) return [];
      if (Array.isArray(raw[0])) return raw[0] as Record<string, unknown>[];
      return raw as Record<string, unknown>[];
    }

    const bruecken = extractRows(bdRaw).map((r) => ({
      brueckennummer: Number(r.brueckennummer),
      bas:            String(r.brueckennummer),
      name:           String(r.name ?? ""),
      stadt:          String(r.stadt ?? ""),
      land:           String(r.land ?? ""),
      gpslat:         parseFloat(String(r.gpslat ?? 0)),
      gpslng:         parseFloat(String(r.gpslng ?? 0)),
      distanz:        Math.round(parseFloat(String(r.distanz_km ?? 0)) * 1000), // → Meter
      quelle:         "brueckendaten" as const,
    }));

    const wartend = extractRows(bwRaw).map((r) => ({
      brueckennummer: Number(r.wbasid),
      bas:            String(r.wbas ?? r.wbasid ?? ""),
      name:           String(r.name ?? ""),
      stadt:          String(r.stadt ?? ""),
      land:           String(r.land ?? ""),
      gpslat:         parseFloat(String(r.gpslat ?? 0)),
      gpslng:         parseFloat(String(r.gpslng ?? 0)),
      distanz:        Math.round(parseFloat(String(r.distanz_km ?? 0)) * 1000),
      quelle:         "wartend" as const,
    }));

    return NextResponse.json({ bruecken, wartend });
  } catch (error) {
    console.error("Fehler bei Brücken-Umkreissuche:", error);
    return NextResponse.json(
      { error: "Datenbankfehler bei der Umkreissuche" },
      { status: 500 }
    );
  }
}
