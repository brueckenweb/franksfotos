/**
 * GPX-Parsing-Utilities
 * Pure TypeScript – keine Browser-APIs, serverseitig und clientseitig nutzbar
 */

export interface GpxPoint {
  lat: number;
  lon: number;
  ele: number | null;
  time: Date | null;
}

export interface GpxTrackStats {
  laengeKm:  string;   // auf 2 Dezimalstellen gerundet
  hoehmAuf:  number;   // positive Höhenmeter (Aufstieg)
  datumTour: Date | null;
  punkte:    GpxPoint[];
  name:      string;
}

// ── Haversine-Formel ─────────────────────────────────────────────────────────
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Erdradius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ── GPX-XML parsen (Browser: DOMParser, Node.js: nicht verfügbar ohne Polyfill) ──
export function parseGpxText(gpxText: string): GpxTrackStats {
  const parser = new DOMParser();
  const doc = parser.parseFromString(gpxText, "application/xml");

  // Name des Tracks
  const nameEl = doc.querySelector("trk > name") ?? doc.querySelector("gpx > metadata > name");
  const name = nameEl?.textContent?.trim() ?? "";

  // Alle Trackpoints sammeln
  const trkpts = Array.from(doc.querySelectorAll("trkpt"));
  const punkte: GpxPoint[] = trkpts.map((pt) => {
    const lat  = parseFloat(pt.getAttribute("lat") ?? "0");
    const lon  = parseFloat(pt.getAttribute("lon") ?? "0");
    const eleEl = pt.querySelector("ele");
    const timeEl = pt.querySelector("time");
    const ele  = eleEl ? parseFloat(eleEl.textContent ?? "0") : null;
    const time = timeEl?.textContent ? new Date(timeEl.textContent) : null;
    return { lat, lon, ele, time };
  });

  // Falls keine trkpt → wpt versuchen (Wegpunkte)
  if (punkte.length === 0) {
    const wpts = Array.from(doc.querySelectorAll("wpt"));
    wpts.forEach((pt) => {
      const lat  = parseFloat(pt.getAttribute("lat") ?? "0");
      const lon  = parseFloat(pt.getAttribute("lon") ?? "0");
      const eleEl = pt.querySelector("ele");
      const timeEl = pt.querySelector("time");
      const ele  = eleEl ? parseFloat(eleEl.textContent ?? "0") : null;
      const time = timeEl?.textContent ? new Date(timeEl.textContent) : null;
      punkte.push({ lat, lon, ele, time });
    });
  }

  // Streckenlänge berechnen
  let totalKm = 0;
  for (let i = 1; i < punkte.length; i++) {
    totalKm += haversineKm(
      punkte[i - 1].lat, punkte[i - 1].lon,
      punkte[i].lat,     punkte[i].lon
    );
  }

  // Höhenmeter (nur positive Anstiege)
  let hoehmAuf = 0;
  for (let i = 1; i < punkte.length; i++) {
    const prev = punkte[i - 1].ele;
    const curr = punkte[i].ele;
    if (prev !== null && curr !== null && curr > prev) {
      hoehmAuf += curr - prev;
    }
  }

  // Datum: erstes gültiges time-Element
  const datumTour = punkte.find((p) => p.time !== null)?.time ?? null;

  return {
    laengeKm:  totalKm.toFixed(2),
    hoehmAuf:  Math.round(hoehmAuf),
    datumTour,
    punkte,
    name,
  };
}

// ── Track-Segmentierung für Editor ───────────────────────────────────────────
/**
 * Teilt einen Track in N gleichmäßige Segmente auf.
 * Gibt je Segment einen Mittelindex + Koordinaten zurück.
 */
export function segmentiere(punkte: GpxPoint[], segmentGroesse: number = 20): {
  segmentIdx: number;
  lat: number;
  lon: number;
  vonIdx: number;
  bisIdx: number;
}[] {
  if (punkte.length < 2) return [];
  const result = [];
  for (let i = 0; i < punkte.length; i += segmentGroesse) {
    const vonIdx = i;
    const bisIdx = Math.min(i + segmentGroesse - 1, punkte.length - 1);
    const mittelIdx = Math.floor((vonIdx + bisIdx) / 2);
    result.push({
      segmentIdx: mittelIdx,
      lat:        punkte[mittelIdx].lat,
      lon:        punkte[mittelIdx].lon,
      vonIdx,
      bisIdx,
    });
  }
  return result;
}

// ── GPX aus Punkteliste generieren ───────────────────────────────────────────
export function generateGpxText(punkte: GpxPoint[], name = "Track"): string {
  const header = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="FranksFotos" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>`;

  const footer = `
    </trkseg>
  </trk>
</gpx>`;

  const points = punkte.map((p) => {
    const ele  = p.ele  !== null ? `\n      <ele>${p.ele.toFixed(1)}</ele>` : "";
    const time = p.time !== null ? `\n      <time>${p.time.toISOString()}</time>` : "";
    return `\n      <trkpt lat="${p.lat}" lon="${p.lon}">${ele}${time}\n      </trkpt>`;
  }).join("");

  return header + points + footer;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Tour-Typ Emoji ────────────────────────────────────────────────────────────
export const TYP_EMOJI: Record<string, string> = {
  Wanderung:  "🥾",
  Autofahrt:  "🚗",
  Fahrrad:    "🚴",
  Schifffahrt:"⛵",
  Flugzeug:   "✈️",
};

export const TYP_FARBE: Record<string, string> = {
  Wanderung:  "#22c55e",   // grün
  Autofahrt:  "#3b82f6",   // blau
  Fahrrad:    "#f59e0b",   // gelb
  Schifffahrt:"#06b6d4",   // cyan
  Flugzeug:   "#a855f7",   // lila
};
