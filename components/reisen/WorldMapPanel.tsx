"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Globe, Loader2, ArrowRight } from "lucide-react";
import { TOTAL_SOVEREIGN_COUNTRIES } from "@/lib/reisen/countries";
import type { VisitedCountry, CityMarker, SightMarker } from "./WorldMap";
import ReisenStats from "./ReisenStats";

const WorldMap = dynamic(() => import("./WorldMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full rounded-lg bg-gray-800 flex items-center justify-center" style={{ height: 280 }}>
      <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
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

interface WorldMapPanelProps {
  /** Gibt an, ob der aktuelle Besucher der Karteneigentümer ist (steuert den Bearbeiten-Link) */
  isOwner?: boolean;
}

export default function WorldMapPanel({ isOwner = false }: WorldMapPanelProps) {
  const [map, setMap]         = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [noMap, setNoMap]     = useState(false);

  useEffect(() => {
    fetch("/api/reisen/public")
      .then((r) => r.json())
      .then((data) => {
        if (!data || data.error) { setNoMap(true); return; }
        setMap(data);
      })
      .catch(() => setNoMap(true))
      .finally(() => setLoading(false));
  }, []);

  const countAll = map?.countries.length ?? 0;
  const pct      = ((countAll / TOTAL_SOVEREIGN_COUNTRIES) * 100).toFixed(1);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500/10 rounded-lg p-2">
              <Globe className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold">Bereiste Länder</h2>
              {map && (
                <p className="text-gray-500 text-xs">
                  {countAll} Länder ({pct}% der Welt)
                </p>
              )}
            </div>
          </div>
          {isOwner && (
            <Link
              href="/reisen"
              className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-sm font-medium transition-colors"
            >
              <ArrowRight className="w-4 h-4" />Bearbeiten
            </Link>
          )}
        </div>

        {/* Inhalt */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
          </div>
        ) : noMap || !map ? (
          /* Keine Karte vorhanden – Panel wird gar nicht angezeigt */
          null
        ) : (
          <div className="p-4">
            <WorldMap
              visitedCountries={map.countries}
              cities={[]}
              sights={[]}
              ownerName={map.ownerName}
              partnerName={map.partnerName}
              readOnly={true}
              height="650px"
            />
            <ReisenStats
              countries={map.countries}
              cities={map.cities}
              sights={map.sights}
              ownerName={map.ownerName}
              partnerName={map.partnerName}
            />
          </div>
        )}
      </div>
    </section>
  );
}
