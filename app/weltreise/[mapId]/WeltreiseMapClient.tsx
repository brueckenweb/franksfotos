"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Globe, Loader2, Home, MapPin } from "lucide-react";
import { TOTAL_SOVEREIGN_COUNTRIES } from "@/lib/reisen/countries";
import type { VisitedCountry, CityMarker, SightMarker } from "@/components/reisen/WorldMap";
import ReisenStats from "@/components/reisen/ReisenStats";

const WorldMap = dynamic(() => import("@/components/reisen/WorldMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full rounded-xl bg-gray-800 flex items-center justify-center" style={{ height: 500 }}>
      <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
    </div>
  ),
});

interface MapData {
  id: number;
  name: string;
  ownerName: string;
  partnerName: string | null;
  countries: VisitedCountry[];
  cities: CityMarker[];
  sights: SightMarker[];
}

export default function WeltreiseMapClient({ mapId }: { mapId: number }) {
  const [map, setMap]         = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [noMap, setNoMap]     = useState(false);
  const [mapView, setMapView] = useState<"laender" | "staedte">("laender");

  useEffect(() => {
    fetch(`/api/reisen/${mapId}/public`)
      .then((r) => r.json())
      .then((data) => {
        if (!data || data.error) { setNoMap(true); return; }
        setMap(data);
      })
      .catch(() => setNoMap(true))
      .finally(() => setLoading(false));
  }, [mapId]);

  const countAll = map?.countries.length ?? 0;
  const pct      = ((countAll / TOTAL_SOVEREIGN_COUNTRIES) * 100).toFixed(1);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Page-Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500/10 rounded-lg p-2.5">
              <Globe className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {map ? map.name : "Weltreise"}
              </h1>
              {map && (
                <p className="text-gray-400 text-sm">
                  {countAll} Länder bereist · {pct}% der Welt · {map.cities.length} Städte · {map.sights.length} Sehenswürdigkeiten
                </p>
              )}
            </div>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-gray-400 hover:text-amber-400 text-sm transition-colors"
          >
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">Zur Startseite</span>
          </Link>
        </div>

        {/* Inhalt */}
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
          </div>
        ) : noMap || !map ? (
          <div className="text-center py-32">
            <Globe className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-400">Keine Reisekarte gefunden.</p>
          </div>
        ) : (
          <>
            {/* Karten-Modus-Toggle */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex bg-gray-800 border border-gray-700 rounded-lg p-0.5 gap-0.5">
                <button
                  onClick={() => setMapView("laender")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    mapView === "laender" ? "bg-amber-500 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />Länderkarte
                </button>
                <button
                  onClick={() => setMapView("staedte")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    mapView === "staedte" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />Städte & Sehenswürdigkeiten
                </button>
              </div>
            </div>

            {/* Länderkarte */}
            {mapView === "laender" && (
              <WorldMap
                visitedCountries={map.countries}
                cities={[]}
                sights={[]}
                ownerName={map.ownerName}
                partnerName={map.partnerName}
                readOnly={true}
                height="600px"
              />
            )}

            {/* Städte- & Sehenswürdigkeitenkarte */}
            {mapView === "staedte" && (
              <WorldMap
                visitedCountries={[]}
                cities={map.cities}
                sights={map.sights}
                ownerName={map.ownerName}
                partnerName={map.partnerName}
                readOnly={true}
                height="600px"
              />
            )}

            <ReisenStats
              countries={map.countries}
              cities={map.cities}
              sights={map.sights}
              ownerName={map.ownerName}
              partnerName={map.partnerName}
            />
          </>
        )}
      </div>
    </div>
  );
}
