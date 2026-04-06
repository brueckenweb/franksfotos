"use client";

import { useEffect, useRef, useState } from "react";
import { COUNTRY_MAP, COUNTRY_NAME_EN_MAP } from "@/lib/reisen/countries";

export interface VisitedCountry {
  id: number;
  countryCode: string;
  countryName: string;
  visitedBy: string; // 'user1' | 'user2' | 'both'
  visitedAt: string | null;
  notes: string | null;
}

export interface CityMarker {
  id: number;
  name: string;
  countryCode: string;
  lat: string | null;
  lng: string | null;
  visitedBy: string;
}

export interface SightMarker {
  id: number;
  name: string;
  category: string;
  countryCode: string;
  lat: string | null;
  lng: string | null;
  visitedBy: string;
}

interface WorldMapProps {
  visitedCountries: VisitedCountry[];
  cities: CityMarker[];
  sights: SightMarker[];
  ownerName: string;
  partnerName: string | null;
  readOnly?: boolean;
  /** Höhe der Karte, z. B. "500px" oder "700px". Standard: "500px" */
  height?: string;
  onCountryClick?: (code: string, name: string, existing: VisitedCountry | null) => void;
  onMapClick?: (lat: number, lng: number) => void;
}

// Farben für die 3 Zustände
const COLOR_BOTH  = "#22c55e"; // grün
const COLOR_USER1 = "#3b82f6"; // blau
const COLOR_USER2 = "#f97316"; // orange
const COLOR_NONE  = "#374151"; // dunkelgrau
const COLOR_HOVER = "#6b7280"; // hellgrau beim Hover

function getCountryColor(code: string, visited: Map<string, VisitedCountry>): string {
  const v = visited.get(code);
  if (!v) return COLOR_NONE;
  if (v.visitedBy === "both")  return COLOR_BOTH;
  if (v.visitedBy === "user2") return COLOR_USER2;
  return COLOR_USER1;
}

/** Normalisiert ISO_A2-Code: leer wenn ungültig ("-99", >2 Zeichen etc.) */
function normalizeCode(raw: unknown): string {
  if (!raw || typeof raw !== "string") return "";
  const c = raw.trim().toUpperCase();
  if (c.length !== 2 || c === "-99" || c.startsWith("-")) return "";
  return c;
}

/**
 * ISO-Code aus GeoJSON-Feature ermitteln.
 * Primär: ISO3166-1-Alpha-2 / ISO_A2.
 * Fallback: englischer Name → COUNTRY_NAME_EN_MAP
 * (einige Features im Datensatz haben "-99" als Code, z. B. Frankreich)
 */
function resolveCode(feature: { properties?: Record<string, unknown> } | null | undefined): string {
  const props = feature?.properties ?? {};
  const fromISO = normalizeCode(
    props["ISO3166-1-Alpha-2"] ?? props["ISO_A2"] ?? props["ISO_A2_EH"]
  );
  if (fromISO) return fromISO;
  // Fallback über englischen Namen
  const nameEn = (props["name"] ?? props["NAME"] ?? props["ADMIN"] ?? props["admin"] ?? "") as string;
  return nameEn ? (COUNTRY_NAME_EN_MAP.get(nameEn.toLowerCase()) ?? "") : "";
}

export default function WorldMap({
  visitedCountries,
  cities,
  sights,
  ownerName,
  partnerName,
  readOnly = false,
  height = "500px",
  onCountryClick,
  onMapClick,
}: WorldMapProps) {
  const mapRef          = useRef<HTMLDivElement>(null);
  const leafletMapRef   = useRef<unknown>(null);
  const geoJsonLayerRef = useRef<unknown>(null);
  const [mapReady, setMapReady] = useState(false);

  // ── Latest-Ref-Pattern: Props werden jeden Render aktualisiert ──────────
  // Leaflet-Handler schreiben nie in diese Refs, lesen sie nur – kein Loop.
  const onCountryClickRef  = useRef(onCountryClick);
  const onMapClickRef      = useRef(onMapClick);
  const visitedCountriesRef = useRef(visitedCountries);
  onCountryClickRef.current  = onCountryClick;
  onMapClickRef.current      = onMapClick;
  visitedCountriesRef.current = visitedCountries;

  // ── Leaflet einmalig initialisieren ────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !mapRef.current || leafletMapRef.current) return;
      const el = mapRef.current as unknown as { _leaflet_id?: number };
      if (el._leaflet_id) return;

      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      const map = L.map(mapRef.current!, {
        center: [20, 0], zoom: 2, minZoom: 1, maxZoom: 10,
        worldCopyJump: false,
        maxBounds: [[-90, -180], [90, 180]],
      });

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>', subdomains: "abcd", maxZoom: 19 }
      ).addTo(map);

      leafletMapRef.current = map;

      if (!readOnly) {
        map.on("click", (e: L.LeafletMouseEvent) => {
          onMapClickRef.current?.(e.latlng.lat, e.latlng.lng);
        });
      }

      // GeoJSON laden
      fetch("https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson")
        .then((r) => r.json())
        .then((geojson) => {
          if (cancelled) return;

          // Aktuelle visitedCountries via Ref (nicht Closure-Snapshot)
          const buildVisitedMap = () => new Map<string, VisitedCountry>(
            visitedCountriesRef.current.map((v) => [v.countryCode, v])
          );

          const layer = L.geoJSON(geojson, {
            style: (feature) => {
              const code = resolveCode(feature);
              return {
                fillColor: getCountryColor(code, buildVisitedMap()),
                weight: 0.5, opacity: 0.8,
                color: "#1f2937", fillOpacity: 0.75,
              };
            },
            onEachFeature: (feature, lyr: L.Layer) => {
              // resolveCode: ISO3166-1-Alpha-2 mit Name-Fallback (z. B. Frankreich hat "-99")
              const code   = resolveCode(feature);
              const nameEn = (feature.properties?.name
                ?? feature.properties?.NAME
                ?? feature.properties?.ADMIN
                ?? feature.properties?.admin
                ?? "") as string;
              // Reihenfolge: deutscher Name → englischer Name aus GeoJSON → ISO-Code → Fallback
              const nameDE = code
                ? ((COUNTRY_MAP.get(code)?.name ?? nameEn) || code)
                : (nameEn || code || "?");

              lyr.bindTooltip(nameDE, { sticky: true, className: "travel-tooltip" });

              if (!readOnly && code) {
                (lyr as L.Path).on("mouseover", (e) => {
                  const path = e.target as L.Path;
                  if (!buildVisitedMap().get(code)) {
                    path.setStyle({ fillColor: COLOR_HOVER, fillOpacity: 0.9 });
                  }
                  path.bringToFront();
                });
                (lyr as L.Path).on("mouseout", (e) => {
                  const path = e.target as L.Path;
                  path.setStyle({ fillColor: getCountryColor(code, buildVisitedMap()), fillOpacity: 0.75 });
                });
                (lyr as L.Path).on("click", (e: L.LeafletMouseEvent) => {
                  // Klick nicht zur Karte weitergeben (verhindert onMapClick-Überschneidung)
                  L.DomEvent.stopPropagation(e);
                  const existing = buildVisitedMap().get(code) ?? null;
                  const cb = onCountryClickRef.current;
                  if (cb) {
                    // setTimeout(0): React-State-Update außerhalb des Leaflet-Event-Stacks
                    setTimeout(() => cb(code, nameDE, existing), 0);
                  }
                });
              }
            },
          });

          layer.addTo(map);
          geoJsonLayerRef.current = layer;
          setMapReady(true);
        })
        .catch((err) => console.error("GeoJSON Ladefehler:", err));
    });

    return () => {
      cancelled = true;
      if (leafletMapRef.current) {
        (leafletMapRef.current as L.Map).remove();
        leafletMapRef.current = null;
        geoJsonLayerRef.current = null;
        setMapReady(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Länderfärbung aktualisieren wenn visitedCountries sich ändert ───────
  useEffect(() => {
    if (!mapReady || !geoJsonLayerRef.current) return;
    import("leaflet").then((L) => {
      const layer = geoJsonLayerRef.current as L.GeoJSON;
      const vm = new Map<string, VisitedCountry>(
        visitedCountries.map((v) => [v.countryCode, v])
      );
      layer.setStyle((feature) => {
        const code = resolveCode(feature);
        return {
          fillColor: getCountryColor(code, vm),
          weight: 0.5, opacity: 0.8,
          color: "#1f2937", fillOpacity: 0.75,
        };
      });
    });
  }, [visitedCountries, mapReady]);

  // ── Stadtmarker aktualisieren ───────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !leafletMapRef.current) return;
    import("leaflet").then((L) => {
      const map = leafletMapRef.current as L.Map;
      type MapWithCityLayer = L.Map & { _cityLayer?: L.LayerGroup };
      const m = map as MapWithCityLayer;

      m._cityLayer?.clearLayers();
      if (!m._cityLayer) {
        m._cityLayer = L.layerGroup().addTo(map);
      }
      const cityLayer = m._cityLayer!;

      cities.forEach((city) => {
        if (!city.lat || !city.lng) return;
        const lat = parseFloat(city.lat), lng = parseFloat(city.lng);
        if (isNaN(lat) || isNaN(lng)) return;
        const color = city.visitedBy === "both" ? COLOR_BOTH : city.visitedBy === "user2" ? COLOR_USER2 : COLOR_USER1;
        L.circleMarker([lat, lng], { radius: 6, fillColor: color, color: "#fff", weight: 1.5, fillOpacity: 0.9 })
          .bindTooltip(`🏙️ ${city.name}`, { className: "travel-tooltip" })
          .addTo(cityLayer);
      });

      sights.forEach((sight) => {
        if (!sight.lat || !sight.lng) return;
        const lat = parseFloat(sight.lat), lng = parseFloat(sight.lng);
        if (isNaN(lat) || isNaN(lng)) return;
        const color = sight.visitedBy === "both" ? COLOR_BOTH : sight.visitedBy === "user2" ? COLOR_USER2 : COLOR_USER1;
        L.circleMarker([lat, lng], { radius: 5, fillColor: color, color: "#f59e0b", weight: 1.5, fillOpacity: 0.9 })
          .bindTooltip(`⭐ ${sight.name}`, { className: "travel-tooltip" })
          .addTo(cityLayer);
      });
    });
  }, [cities, sights, mapReady]);

  return (
    <div className="relative w-full">
      <div
        ref={mapRef}
        className="w-full rounded-xl overflow-hidden border border-gray-700"
        style={{ height, background: "#111827" }}
      />

      {/* Legende */}
      <div className="absolute bottom-4 left-4 bg-gray-900/90 border border-gray-700 rounded-lg px-3 py-2 text-xs space-y-1 z-[1000]">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLOR_USER1 }} />
          <span className="text-gray-300">{ownerName}</span>
        </div>
        {partnerName && (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLOR_USER2 }} />
            <span className="text-gray-300">{partnerName}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLOR_BOTH }} />
          <span className="text-gray-300">Gemeinsam</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLOR_NONE }} />
          <span className="text-gray-400">Nicht bereist</span>
        </div>
        <div className="border-t border-gray-700 pt-1 mt-1 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-blue-300">●</span>
            <span className="text-gray-400">Stadt</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-yellow-400">●</span>
            <span className="text-gray-400">Sehenswürdigkeit</span>
          </div>
        </div>
      </div>

      <style>{`
        .travel-tooltip {
          background: #1f2937; border: 1px solid #374151; color: #f9fafb;
          font-size: 12px; padding: 3px 8px; border-radius: 6px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        }
        .travel-tooltip::before { display: none; }
        .leaflet-container { font-family: inherit; }
      `}</style>
    </div>
  );
}
