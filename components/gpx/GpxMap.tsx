"use client";

/**
 * GpxMap – Leaflet-Kartenansicht für einen GPX-Track
 * Wird mit dynamic({ ssr: false }) eingebunden, da Leaflet SSR nicht unterstützt.
 */

import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { parseGpxText, TYP_FARBE, type GpxPoint } from "@/lib/gpx/utils";

// Leaflet-Marker-Icons reparieren (Next.js-Bug)
function fixLeafletIcons() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

// Karte automatisch auf den Track anpassen
function FitBounds({ punkte }: { punkte: GpxPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (punkte.length < 2) return;
    const bounds = L.latLngBounds(punkte.map((p) => [p.lat, p.lon]));
    map.fitBounds(bounds, { padding: [20, 20] });
  }, [map, punkte]);
  return null;
}

// Farbige Start/Ziel-Marker
function colorMarker(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:${color};border:2px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,.5)
    "></div>`,
    iconSize:   [14, 14],
    iconAnchor: [7, 7],
  });
}

// ── Props ──────────────────────────────────────────────────────────────────
export interface GpxMapProps {
  gpxUrl:       string;
  titel?:       string;
  typ?:         string;
  laengeKm?:    string | null;
  hoehmAuf?:    number | null;
  datumTour?:   string | Date | null;
  hoehe?:       string;   // CSS-Höhe der Karte, default "400px"
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function GpxMap({
  gpxUrl,
  titel,
  typ = "Wanderung",
  laengeKm,
  hoehmAuf,
  datumTour,
  hoehe = "400px",
}: GpxMapProps) {
  const [punkte, setPunkte] = useState<GpxPoint[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laden, setLaden] = useState(true);
  const fixedRef = useRef(false);

  useEffect(() => {
    if (!fixedRef.current) {
      fixLeafletIcons();
      fixedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!gpxUrl) return;
    setLaden(true);
    setFehler(null);

    fetch(gpxUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        const stats = parseGpxText(text);
        setPunkte(stats.punkte);
      })
      .catch((e) => {
        setFehler("GPX-Datei konnte nicht geladen werden: " + e.message);
      })
      .finally(() => setLaden(false));
  }, [gpxUrl]);

  const farbe = TYP_FARBE[typ] ?? "#3b82f6";

  const latlngs: [number, number][] = punkte.map((p) => [p.lat, p.lon]);
  const startPunkt = punkte[0];
  const endPunkt   = punkte[punkte.length - 1];

  const formatDatum = (d: string | Date | null | undefined) => {
    if (!d) return null;
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-700">
      {/* Ladezustand */}
      {laden && (
        <div
          className="flex items-center justify-center bg-gray-800 text-gray-400 text-sm"
          style={{ height: hoehe }}
        >
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400 mr-2" />
          Track wird geladen…
        </div>
      )}

      {/* Fehler */}
      {!laden && fehler && (
        <div
          className="flex items-center justify-center bg-gray-800 text-red-400 text-sm p-4"
          style={{ height: hoehe }}
        >
          {fehler}
        </div>
      )}

      {/* Karte */}
      {!laden && !fehler && punkte.length > 0 && (
        <MapContainer
          center={[punkte[0].lat, punkte[0].lon]}
          zoom={13}
          style={{ height: hoehe, width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          {/* Track-Linie */}
          <Polyline positions={latlngs} color={farbe} weight={3} opacity={0.85} />

          {/* Start-Marker (grün) */}
          {startPunkt && (
            <Marker position={[startPunkt.lat, startPunkt.lon]} icon={colorMarker("#22c55e")}>
              <Popup>Start</Popup>
            </Marker>
          )}

          {/* Ziel-Marker (rot) – nur wenn Start ≠ Ziel */}
          {endPunkt && punkte.length > 1 && (
            <Marker position={[endPunkt.lat, endPunkt.lon]} icon={colorMarker("#ef4444")}>
              <Popup>Ziel</Popup>
            </Marker>
          )}

          <FitBounds punkte={punkte} />
        </MapContainer>
      )}

      {!laden && !fehler && punkte.length === 0 && (
        <div
          className="flex items-center justify-center bg-gray-800 text-gray-500 text-sm"
          style={{ height: hoehe }}
        >
          Keine Trackpunkte gefunden.
        </div>
      )}
    </div>
  );
}
