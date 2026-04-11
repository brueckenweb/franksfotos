"use client";

/**
 * GpxPreviewMap – Leaflet-Kartenvorschau für lokal geparste GPX-Punkte
 * Wird mit dynamic({ ssr: false }) in GpxUploadForm eingebunden.
 * Empfängt die bereits geparsten GpxPoint[] direkt (kein URL-Fetch nötig).
 */

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TYP_FARBE, type GpxPoint } from "@/lib/gpx/utils";

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

export interface GpxPreviewMapProps {
  punkte:  GpxPoint[];
  typ?:    string;
  hoehe?:  string;
}

export default function GpxPreviewMap({
  punkte,
  typ = "Wanderung",
  hoehe = "300px",
}: GpxPreviewMapProps) {
  const fixedRef = useRef(false);

  useEffect(() => {
    if (!fixedRef.current) {
      fixLeafletIcons();
      fixedRef.current = true;
    }
  }, []);

  const farbe = TYP_FARBE[typ] ?? "#3b82f6";
  const latlngs: [number, number][] = punkte.map((p) => [p.lat, p.lon]);
  const startPunkt = punkte[0];
  const endPunkt   = punkte[punkte.length - 1];

  if (punkte.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-gray-800 rounded-xl border border-gray-700 text-gray-500 text-sm"
        style={{ height: hoehe }}
      >
        Keine Trackpunkte gefunden.
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-gray-700" style={{ height: hoehe }}>
      <MapContainer
        center={[startPunkt.lat, startPunkt.lon]}
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
    </div>
  );
}
