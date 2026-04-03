/**
 * OpenStreetMap-Karte für die Fotodatenbank-Eingabe
 * – Foto-Position: roter, DRAG-fähiger Marker
 *   – Mit Richtungs-EXIF (GPSImgDirection): Pfeil in Blickrichtung
 *   – Ohne Richtung: einfacher roter Kreis
 * – Brücken aus brueckendaten: dunkelblau
 * – Brücken aus brueckendaten_wartend (aktiv='wartend'): orange
 * Wird dynamisch geladen (kein SSR) – react-leaflet braucht window
 */

"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";

// ── Typen ──────────────────────────────────────────────────────────────────

export interface BrueckeNearby {
  brueckennummer: number;
  bas:            string;
  name:           string;
  stadt:          string;
  land:           string;
  gpslat:         number;
  gpslng:         number;
  distanz:        number; // Meter
  quelle:         "brueckendaten" | "wartend";
}

// ── Marker-Icons ──────────────────────────────────────────────────────────

/** Einfacher roter Kreis (kein Richtungs-EXIF) */
const RED_DOT_ICON = L.divIcon({
  html: `<div style="
    width:22px;height:22px;
    background:radial-gradient(circle at 38% 35%,#ff8080,#dc2626 70%);
    border:2.5px solid #fff;
    border-radius:50%;
    box-shadow:0 2px 8px rgba(0,0,0,.45),0 0 0 3px rgba(220,38,38,.30);
    cursor:grab;
    box-sizing:border-box;
  "></div>`,
  iconSize:   [22, 22],
  iconAnchor: [11, 11],
  className:  "",
});

/**
 * Richtungs-Pfeil-Icon.
 * Der Pfeil zeigt nach oben (Nord = 0°).
 * Das SVG-Group-Element wird um `grad` Grad um den Mittelpunkt gedreht.
 *
 * Aufbau:
 *  – Roter Kreis in der Mitte (Position des Fotografen)
 *  – Dreieck / Pfeil, der in Blickrichtung zeigt
 */
function createRichtungIcon(grad: number): L.DivIcon {
  const size = 44;
  const cx = size / 2;   // 22
  const cy = size / 2;   // 22

  const svg = `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"
     xmlns="http://www.w3.org/2000/svg">
  <!-- Pfeil-Spitze, zeigt initial nach oben (Nord=0°), dann rotiert -->
  <g transform="rotate(${grad},${cx},${cy})">
    <!-- Pfeilschaft + Spitze -->
    <polygon
      points="${cx},3 ${cx + 5},${cy - 2} ${cx - 5},${cy - 2}"
      fill="#dc2626" stroke="white" stroke-width="1.5"
      stroke-linejoin="round"/>
    <rect
      x="${cx - 2}" y="${cy - 2}" width="4" height="${cy - 4}"
      fill="#dc2626" stroke="white" stroke-width="0"/>
  </g>
  <!-- Roter Kreis in der Mitte -->
  <circle cx="${cx}" cy="${cy}" r="9"
    fill="#ef4444" stroke="white" stroke-width="2.5"/>
  <!-- Kleines Loch / Marker-Punkt -->
  <circle cx="${cx}" cy="${cy}" r="3" fill="white" opacity="0.7"/>
</svg>`.trim();

  return L.divIcon({
    html: `<div style="cursor:grab;line-height:0;">${svg}</div>`,
    iconSize:   [size, size],
    iconAnchor: [cx, cy],
    className:  "",
  });
}

// ── Hilfkomponente: Karte neu zentrieren wenn GPS-Werte sich ändern ──
function MapUpdater({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat !== 0 || lng !== 0) {
      map.setView([lat, lng], map.getZoom() < 10 ? 13 : map.getZoom());
    }
  }, [lat, lng, map]);
  return null;
}

// ── Marker-Stile für Brücken ──────────────────────────────────────────────

const BRUECKE_STYLE = {
  color:       "#1e3a8a",
  fillColor:   "#2563eb",
  fillOpacity: 0.85,
  weight:      2,
  radius:      8,
};

const WARTEND_STYLE = {
  color:       "#c2410c",
  fillColor:   "#f97316",
  fillOpacity: 0.85,
  weight:      2,
  radius:      8,
};

// ── Hauptkomponente ──────────────────────────────────────────────────
interface FotodatenbankMapProps {
  lat:               number;
  lng:               number;
  /** Kamerarichtung aus EXIF (GPSImgDirection), 0–360°. -1 = nicht vorhanden */
  richtung?:         number;
  onPositionChange?: (lat: number, lng: number) => void;
  onBrueckeSelect?:  (bas: string, name: string) => void;
}

export default function FotodatenbankMap({
  lat,
  lng,
  richtung = -1,
  onPositionChange,
  onBrueckeSelect,
}: FotodatenbankMapProps) {
  const hasGps     = lat !== 0 || lng !== 0;
  const hasRichtung = richtung >= 0;
  const center: [number, number] = hasGps ? [lat, lng] : [51.0, 10.0];
  const zoom = hasGps ? 13 : 5;

  const [bruecken,   setBruecken]   = useState<BrueckeNearby[]>([]);
  const [wartend,    setWartend]    = useState<BrueckeNearby[]>([]);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Richtungs-Icon wird aus den Props gebaut (stabil per useMemo würde SSR-Probleme geben)
  const markerIcon = hasRichtung
    ? createRichtungIcon(richtung)
    : RED_DOT_ICON;

  // ── Brücken laden (debounced, 1.5 s nach letzter Koordinatenänderung) ──
  useEffect(() => {
    if (!hasGps) {
      setBruecken([]);
      setWartend([]);
      setLadeFehler(null);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        setLadeFehler(null);
        const res = await fetch(
          `/api/fotodatenbank/bruecken-umkreis?lat=${lat}&lng=${lng}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setBruecken(Array.isArray(data.bruecken) ? data.bruecken : []);
        setWartend(Array.isArray(data.wartend)   ? data.wartend  : []);
      } catch (err) {
        console.warn("Brücken-Umkreissuche fehlgeschlagen:", err);
        setLadeFehler("Brücken konnten nicht geladen werden");
      }
    }, 1500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [lat, lng, hasGps]);

  // ── Popup-Inhalt für Brücken ──────────────────────────────────────
  function BrueckePopup({ b }: { b: BrueckeNearby }) {
    const isWartend = b.quelle === "wartend";
    return (
      <div style={{ minWidth: 200, fontSize: 13 }}>
        <div style={{ fontWeight: 700, marginBottom: 4, lineHeight: 1.3 }}>
          {b.name || "(kein Name)"}
        </div>
        <div style={{ color: "#555", marginBottom: 2 }}>
          {isWartend ? (
            <span style={{ color: "#ea580c", fontWeight: 600 }}>
              ⏳ Wartend – WBAS: {b.bas}
            </span>
          ) : (
            <span style={{ color: "#1d4ed8", fontWeight: 600 }}>
              🌉 BAS: {b.bas}
            </span>
          )}
        </div>
        {b.stadt && (
          <div style={{ color: "#666", fontSize: 12 }}>
            📍 {b.stadt}{b.land ? `, ${b.land}` : ""}
          </div>
        )}
        <div style={{ color: "#888", fontSize: 11, marginTop: 3 }}>
          {b.distanz < 1000
            ? `${b.distanz} m entfernt`
            : `${(b.distanz / 1000).toFixed(1)} km entfernt`}
        </div>
        {onBrueckeSelect && (
          <button
            onClick={() => onBrueckeSelect(b.bas, b.name)}
            style={{
              marginTop: 8,
              width: "100%",
              background: isWartend ? "#f97316" : "#2563eb",
              color: "white",
              border: "none",
              borderRadius: 5,
              padding: "5px 10px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            ↩ BAS übernehmen
          </button>
        )}
        <div style={{ marginTop: 6, textAlign: "center" }}>
          <a
            href={`https://www.brueckenweb.de/de/bruecke/${b.brueckennummer}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#2563eb", fontSize: 11 }}
          >
            brueckenweb.de ↗
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "560px", width: "100%", borderRadius: "0.5rem" }}
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* ── Foto-Position: roter Kreis oder Richtungspfeil ── */}
        {hasGps && (
          <Marker
            position={[lat, lng]}
            icon={markerIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const pos = (e.target as L.Marker).getLatLng();
                onPositionChange?.(pos.lat, pos.lng);
              },
            }}
          >
            <Popup>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                📷 Foto-Position
              </div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
                {lat.toFixed(6)}, {lng.toFixed(6)}
              </div>
              {hasRichtung && (
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                  🧭 Blickrichtung: {Math.round(richtung)}°{" "}
                  {richtungZuText(richtung)}
                </div>
              )}
              <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>
                Zum Verschieben ziehen
              </div>
            </Popup>
          </Marker>
        )}

        {/* ── Brücken aus brueckendaten: dunkelblau ── */}
        {bruecken.map((b) => (
          <CircleMarker
            key={`bd-${b.brueckennummer}`}
            center={[b.gpslat, b.gpslng]}
            pathOptions={BRUECKE_STYLE}
            radius={BRUECKE_STYLE.radius}
          >
            <Popup>
              <BrueckePopup b={b} />
            </Popup>
          </CircleMarker>
        ))}

        {/* ── Brücken aus brueckendaten_wartend: orange ── */}
        {wartend.map((b) => (
          <CircleMarker
            key={`bw-${b.brueckennummer}`}
            center={[b.gpslat, b.gpslng]}
            pathOptions={WARTEND_STYLE}
            radius={WARTEND_STYLE.radius}
          >
            <Popup>
              <BrueckePopup b={b} />
            </Popup>
          </CircleMarker>
        ))}

        <MapUpdater lat={lat} lng={lng} />
      </MapContainer>

      {/* ── Legende ── */}
      <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span
            style={{
              display: "inline-block",
              width: 13,
              height: 13,
              borderRadius: "50%",
              background: "#ef4444",
              border: "2px solid #dc2626",
            }}
          />
          {hasRichtung
            ? `Foto-Position (${Math.round(richtung)}° ${richtungZuText(richtung)})`
            : "Foto-Position (ziehbar)"}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            style={{
              display: "inline-block",
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#2563eb",
              border: "2px solid #1e3a8a",
            }}
          />
          Brücke ({bruecken.length})
        </span>
        <span className="flex items-center gap-1.5">
          <span
            style={{
              display: "inline-block",
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#f97316",
              border: "2px solid #c2410c",
            }}
          />
          Wartend ({wartend.length})
        </span>
        {ladeFehler && (
          <span className="text-red-400 ml-2">⚠ {ladeFehler}</span>
        )}
        {hasGps && bruecken.length === 0 && wartend.length === 0 && !ladeFehler && (
          <span className="text-gray-500 ml-2">
            Keine Brücken im 5-km-Umkreis
          </span>
        )}
      </div>
    </div>
  );
}

// ── Hilfsfunktion: Grad → Himmelsrichtungs-Text ───────────────────────────

function richtungZuText(grad: number): string {
  const richtungen = ["N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO",
                      "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const idx = Math.round(grad / 22.5) % 16;
  return richtungen[idx] ?? "";
}
