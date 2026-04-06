"use client";

/**
 * GpxEditor – Interaktiver Track-Editor
 * - Segment-Handles verschieben (Drag & Drop)
 * - Anfang / Ende abschneiden
 * - Track an einem Punkt teilen (→ zwei neue Einträge)
 * - Geändertes GPX speichern
 */

import { useEffect, useState, useRef, useCallback } from "react";
import {
  MapContainer, TileLayer, Polyline, Marker, Popup, useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  parseGpxText, segmentiere, generateGpxText, haversineKm,
  TYP_FARBE, type GpxPoint,
} from "@/lib/gpx/utils";
import { Scissors, Split, Save, RotateCcw, Info } from "lucide-react";

// Leaflet-Icons reparieren
function fixIcons() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

function FitBounds({ punkte }: { punkte: GpxPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (punkte.length < 2) return;
    const bounds = L.latLngBounds(punkte.map((p) => [p.lat, p.lon]));
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [map, punkte]);
  return null;
}

function dotIcon(color: string, size = 12) {
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.6);cursor:move"></div>`,
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function schnittIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:18px;height:18px;border-radius:3px;background:#ef4444;border:2px solid white;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.6);color:white;font-size:10px;font-weight:bold">✂</div>`,
    iconSize:   [18, 18],
    iconAnchor: [9, 9],
  });
}

// ── Stats neu berechnen ────────────────────────────────────────────────────
function recalc(punkte: GpxPoint[]) {
  let km = 0;
  let auf = 0;
  for (let i = 1; i < punkte.length; i++) {
    km += haversineKm(punkte[i-1].lat, punkte[i-1].lon, punkte[i].lat, punkte[i].lon);
    const d = (punkte[i].ele ?? 0) - (punkte[i-1].ele ?? 0);
    if (d > 0) auf += d;
  }
  return { km: km.toFixed(2), auf: Math.round(auf) };
}

// ── Props ─────────────────────────────────────────────────────────────────
interface GpxEditorProps {
  trackId:   number;
  gpxUrl:    string;
  titel:     string;
  typ:       string;
  onSaved?:  (newGpxUrl: string, stats: { laengeKm: string; hoehmAuf: number }) => void;
  onSplit?:  (teil1: string, teil2: string) => void; // GPX-Texte der zwei Teile
  uploadUrl: string;   // PHP-Endpoint z.B. https://pics.frank-sellke.de/gpx-upload.php
  uploadKey: string;   // X-Upload-Key
}

// ── Hauptkomponente ──────────────────────────────────────────────────────────
export default function GpxEditor({
  trackId, gpxUrl, titel, typ, onSaved, onSplit, uploadUrl, uploadKey,
}: GpxEditorProps) {
  const [punkteOrig, setPunkteOrig] = useState<GpxPoint[]>([]);
  const [punkte,     setPunkte]     = useState<GpxPoint[]>([]);
  const [laden,      setLaden]      = useState(true);
  const [fehler,     setFehler]     = useState<string | null>(null);
  const [speichern,  setSpeichern]  = useState(false);
  const [modus,      setModus]      = useState<"normal" | "trim" | "split">("normal");
  const [trimStart,  setTrimStart]  = useState(0);
  const [trimEnd,    setTrimEnd]    = useState(100);
  const [splitAt,    setSplitAt]    = useState(50);
  const [stats,      setStats]      = useState({ km: "0.00", auf: 0 });
  const [meldung,    setMeldung]    = useState<{ typ: "ok"|"err"; text: string } | null>(null);
  const fixedRef = useRef(false);

  useEffect(() => {
    if (!fixedRef.current) { fixIcons(); fixedRef.current = true; }
  }, []);

  // GPX laden
  useEffect(() => {
    if (!gpxUrl) return;
    setLaden(true);
    fetch(gpxUrl)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then(text => {
        const s = parseGpxText(text);
        setPunkteOrig(s.punkte);
        setPunkte(s.punkte);
        setStats(recalc(s.punkte));
        setTrimStart(0);
        setTrimEnd(100);
        setSplitAt(50);
      })
      .catch(e => setFehler(e.message))
      .finally(() => setLaden(false));
  }, [gpxUrl]);

  // Segmente für Drag-Handles
  const SEGSIZE = Math.max(10, Math.floor(punkte.length / 30));
  const segmente = segmentiere(punkte, SEGSIZE);

  // Trim-Punkte berechnen
  const trimPunkte = useCallback(() => {
    const von = Math.floor((trimStart / 100) * (punkte.length - 1));
    const bis = Math.floor((trimEnd   / 100) * (punkte.length - 1));
    return punkte.slice(von, bis + 1);
  }, [punkte, trimStart, trimEnd]);

  // Segment-Drag-Handler
  const onSegmentDrag = useCallback((segIdx: number, vonIdx: number, bisIdx: number, newLat: number, newLon: number) => {
    const altLat = punkte[segIdx].lat;
    const altLon = punkte[segIdx].lon;
    const dLat = newLat - altLat;
    const dLon = newLon - altLon;
    setPunkte(prev => prev.map((p, i) => {
      if (i >= vonIdx && i <= bisIdx) {
        return { ...p, lat: p.lat + dLat, lon: p.lon + dLon };
      }
      return p;
    }));
  }, [punkte]);

  // GPX-Text aus aktuellen Punkten
  const getGpxText = (pts: GpxPoint[]) => generateGpxText(pts, titel);

  // Upload-Funktion
  const uploadGpx = async (gpxText: string, suffix = "") => {
    const blob = new Blob([gpxText], { type: "application/gpx+xml" });
    const fname = `${Date.now()}${suffix}_${titel.slice(0, 30).replace(/\s+/g, "-")}.gpx`;
    const fd = new FormData();
    fd.append("gpxFile", blob, fname);
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: { "X-Upload-Key": uploadKey },
      body: fd,
    });
    if (!res.ok) throw new Error("Upload fehlgeschlagen");
    const data = await res.json();
    return data.url as string;
  };

  // Speichern (trim)
  const handleSpeichern = async () => {
    const pts = modus === "trim" ? trimPunkte() : punkte;
    if (pts.length < 2) return;
    setSpeichern(true);
    setMeldung(null);
    try {
      const gpxText = getGpxText(pts);
      const newUrl  = await uploadGpx(gpxText);
      const st = recalc(pts);
      // DB aktualisieren
      await fetch(`/api/gpx/${trackId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gpxUrl: newUrl, laengeKm: st.km, hoehmAuf: st.auf }),
      });
      setMeldung({ typ: "ok", text: "Track gespeichert!" });
      onSaved?.(newUrl, { laengeKm: st.km, hoehmAuf: st.auf });
      setPunkteOrig(pts);
      setPunkte(pts);
      setStats(st);
    } catch (e: unknown) {
      setMeldung({ typ: "err", text: "Fehler: " + (e instanceof Error ? e.message : String(e)) });
    } finally {
      setSpeichern(false);
    }
  };

  // Teilen
  const handleSplit = async () => {
    const splitIdx = Math.floor((splitAt / 100) * (punkte.length - 1));
    const teil1 = punkte.slice(0, splitIdx + 1);
    const teil2 = punkte.slice(splitIdx);
    if (teil1.length < 2 || teil2.length < 2) {
      setMeldung({ typ: "err", text: "Zu wenige Punkte zum Teilen" });
      return;
    }
    setSpeichern(true);
    setMeldung(null);
    try {
      const gpx1 = getGpxText(teil1);
      const gpx2 = getGpxText(teil2);
      onSplit?.(gpx1, gpx2);
      setMeldung({ typ: "ok", text: "Track geteilt! Bitte die zwei neuen Tracks speichern." });
    } catch (e: unknown) {
      setMeldung({ typ: "err", text: "Fehler: " + (e instanceof Error ? e.message : String(e)) });
    } finally {
      setSpeichern(false);
    }
  };

  const handleReset = () => {
    setPunkte(punkteOrig);
    setStats(recalc(punkteOrig));
    setTrimStart(0);
    setTrimEnd(100);
    setSplitAt(50);
    setModus("normal");
    setMeldung(null);
  };

  const farbe = TYP_FARBE[typ] ?? "#3b82f6";

  const anzeigedPunkte = modus === "trim" ? trimPunkte() : punkte;
  const latlngs: [number, number][] = anzeigedPunkte.map(p => [p.lat, p.lon]);

  if (laden) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400 mr-2" />
      GPX wird geladen…
    </div>
  );
  if (fehler) return <div className="text-red-400 p-4">{fehler}</div>;

  const splitIdx = Math.floor((splitAt / 100) * (punkte.length - 1));
  const splitPunkt = punkte[splitIdx];

  return (
    <div className="space-y-4">
      {/* Werkzeug-Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={() => setModus(modus === "trim" ? "normal" : "trim")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            modus === "trim"
              ? "bg-amber-500 text-black"
              : "bg-gray-700 text-gray-200 hover:bg-gray-600"
          }`}
        >
          <Scissors className="w-4 h-4" />
          Abschneiden
        </button>

        <button
          onClick={() => setModus(modus === "split" ? "normal" : "split")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            modus === "split"
              ? "bg-purple-500 text-white"
              : "bg-gray-700 text-gray-200 hover:bg-gray-600"
          }`}
        >
          <Split className="w-4 h-4" />
          Teilen
        </button>

        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Zurücksetzen
        </button>

        <div className="flex-1" />

        <div className="text-xs text-gray-400 flex items-center gap-1">
          <Info className="w-3.5 h-3.5" />
          {punkte.length} Punkte · {stats.km} km · ↑{stats.auf} m
        </div>

        {modus !== "split" && (
          <button
            onClick={handleSpeichern}
            disabled={speichern}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {speichern ? "Wird gespeichert…" : "Speichern"}
          </button>
        )}
      </div>

      {/* Trim-Slider */}
      {modus === "trim" && (
        <div className="bg-gray-800 rounded-lg p-4 space-y-3">
          <p className="text-xs text-gray-400">Anfang und Ende des Tracks abschneiden:</p>
          <label className="flex items-center gap-3 text-xs text-gray-300">
            <span className="w-16 flex-shrink-0">Anfang {trimStart}%</span>
            <input
              type="range" min={0} max={trimEnd - 1} value={trimStart}
              onChange={e => setTrimStart(parseInt(e.target.value))}
              className="flex-1 accent-amber-400"
            />
          </label>
          <label className="flex items-center gap-3 text-xs text-gray-300">
            <span className="w-16 flex-shrink-0">Ende {trimEnd}%</span>
            <input
              type="range" min={trimStart + 1} max={100} value={trimEnd}
              onChange={e => setTrimEnd(parseInt(e.target.value))}
              className="flex-1 accent-amber-400"
            />
          </label>
          <p className="text-xs text-gray-500">
            Verbleibende Punkte: {trimPunkte().length} von {punkte.length}
          </p>
        </div>
      )}

      {/* Split-Slider */}
      {modus === "split" && (
        <div className="bg-gray-800 rounded-lg p-4 space-y-3">
          <p className="text-xs text-gray-400">Track an diesem Punkt aufteilen:</p>
          <label className="flex items-center gap-3 text-xs text-gray-300">
            <span className="w-20 flex-shrink-0">Position {splitAt}%</span>
            <input
              type="range" min={1} max={99} value={splitAt}
              onChange={e => setSplitAt(parseInt(e.target.value))}
              className="flex-1 accent-purple-400"
            />
          </label>
          <p className="text-xs text-gray-500">
            Teil 1: {splitIdx + 1} Punkte · Teil 2: {punkte.length - splitIdx} Punkte
          </p>
          <button
            onClick={handleSplit}
            disabled={speichern}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:opacity-50"
          >
            <Split className="w-4 h-4" />
            {speichern ? "Wird verarbeitet…" : "Track jetzt teilen"}
          </button>
        </div>
      )}

      {/* Meldung */}
      {meldung && (
        <div className={`px-3 py-2 rounded-lg text-sm ${
          meldung.typ === "ok" ? "bg-green-900/50 text-green-300 border border-green-700" : "bg-red-900/50 text-red-300 border border-red-700"
        }`}>
          {meldung.text}
        </div>
      )}

      {/* Karte */}
      {punkte.length > 0 && (
        <div className="rounded-xl overflow-hidden border border-gray-700">
          <MapContainer
            center={[punkte[0].lat, punkte[0].lon]}
            zoom={13}
            style={{ height: "500px", width: "100%" }}
            scrollWheelZoom
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />

            {/* Track */}
            <Polyline positions={latlngs} color={farbe} weight={3} opacity={0.85} />

            {/* Segment-Drag-Handles (nur im Normal-Modus) */}
            {modus === "normal" && segmente.map((seg) => (
              <Marker
                key={seg.segmentIdx}
                position={[seg.lat, seg.lon]}
                icon={dotIcon("#60a5fa", 14)}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const m = e.target as L.Marker;
                    const { lat, lng } = m.getLatLng();
                    onSegmentDrag(seg.segmentIdx, seg.vonIdx, seg.bisIdx, lat, lng);
                  },
                }}
              >
                <Popup>Segment verschieben</Popup>
              </Marker>
            ))}

            {/* Split-Marker */}
            {modus === "split" && splitPunkt && (
              <Marker
                position={[splitPunkt.lat, splitPunkt.lon]}
                icon={schnittIcon()}
                draggable={false}
              >
                <Popup>Teilungspunkt</Popup>
              </Marker>
            )}

            {/* Start / Ziel */}
            {anzeigedPunkte[0] && (
              <Marker position={[anzeigedPunkte[0].lat, anzeigedPunkte[0].lon]} icon={dotIcon("#22c55e")}>
                <Popup>Start</Popup>
              </Marker>
            )}
            {anzeigedPunkte.length > 1 && (
              <Marker
                position={[anzeigedPunkte[anzeigedPunkte.length - 1].lat, anzeigedPunkte[anzeigedPunkte.length - 1].lon]}
                icon={dotIcon("#ef4444")}
              >
                <Popup>Ziel</Popup>
              </Marker>
            )}

            <FitBounds punkte={punkte} />
          </MapContainer>
        </div>
      )}

      {modus === "normal" && punkte.length > 0 && (
        <p className="text-xs text-gray-500 text-center">
          💡 Die blauen Punkte sind verschiebbare Segment-Handles. Ziehen zum Korrigieren des Track-Verlaufs.
        </p>
      )}
    </div>
  );
}
