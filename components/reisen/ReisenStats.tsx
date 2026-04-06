"use client";

import { Globe, MapPin, Star, Users } from "lucide-react";
import { TOTAL_SOVEREIGN_COUNTRIES, COUNTRY_MAP, CONTINENTS } from "@/lib/reisen/countries";
import type { VisitedCountry, CityMarker, SightMarker } from "./WorldMap";

interface ReisenStatsProps {
  countries: VisitedCountry[];
  cities: CityMarker[];
  sights: SightMarker[];
  ownerName: string;
  partnerName: string | null;
}

export default function ReisenStats({ countries, cities, sights, ownerName, partnerName }: ReisenStatsProps) {
  const total = TOTAL_SOVEREIGN_COUNTRIES;
  const countBoth  = countries.filter((c) => c.visitedBy === "both").length;
  const countUser1 = countries.filter((c) => c.visitedBy === "user1").length;
  const countUser2 = countries.filter((c) => c.visitedBy === "user2").length;
  const countAll   = countries.length;

  const pct = ((countAll / total) * 100).toFixed(1);

  // Alle 7 Kontinente (inkl. Antarktika)
  const MAIN_CONTINENTS = [...CONTINENTS]; // Europa, Asien, Afrika, Nordamerika, Südamerika, Ozeanien, Antarktika
  const visitedContinentSet = new Set(
    countries
      .map((c) => COUNTRY_MAP.get(c.countryCode)?.continent)
      .filter((c): c is string => !!c)
  );
  const visitedContinentCount = visitedContinentSet.size;
  const totalContinents = MAIN_CONTINENTS.length; // 7

  return (
    <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
      {/* Länder gesamt */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="bg-amber-500/10 rounded-lg p-1.5">
            <Globe className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-gray-400 text-xs">Länder</span>
        </div>
        <div className="text-2xl font-bold text-white">{countAll}</div>
        <div className="text-xs text-gray-500 mt-0.5">von {total} ({pct}%)</div>
        {/* Fortschrittsbalken */}
        <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all"
            style={{ width: `${Math.min(100, (countAll / total) * 100)}%` }}
          />
        </div>
        {/* Kontinente */}
        <div className="mt-2 text-xs text-gray-400">
          <span className="text-amber-400 font-semibold">{visitedContinentCount}</span>
          <span className="text-gray-500"> / {totalContinents} Kontinente</span>
        </div>
        {visitedContinentCount > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {MAIN_CONTINENTS.map((cont) => (
              <span
                key={cont}
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  visitedContinentSet.has(cont)
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-gray-800 text-gray-600"
                }`}
              >
                {cont}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Aufteilung (nur bei Partner) */}
      {partnerName ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-green-500/10 rounded-lg p-1.5">
              <Users className="w-4 h-4 text-green-400" />
            </div>
            <span className="text-gray-400 text-xs">Aufteilung</span>
          </div>
          <div className="space-y-1 text-xs mt-1">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                <span className="text-gray-300 truncate max-w-[80px]">{ownerName}</span>
              </span>
              <span className="text-white font-bold">{countUser1}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
                <span className="text-gray-300 truncate max-w-[80px]">{partnerName}</span>
              </span>
              <span className="text-white font-bold">{countUser2}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                <span className="text-gray-300">Gemeinsam</span>
              </span>
              <span className="text-white font-bold">{countBoth}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-blue-500/10 rounded-lg p-1.5">
              <Globe className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-gray-400 text-xs">% bereist</span>
          </div>
          <div className="text-2xl font-bold text-blue-400">{pct}%</div>
          <div className="text-xs text-gray-500 mt-0.5">der Welt bereist</div>
        </div>
      )}

      {/* Städte */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="bg-purple-500/10 rounded-lg p-1.5">
            <MapPin className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-gray-400 text-xs">Städte</span>
        </div>
        <div className="text-2xl font-bold text-white">{cities.length}</div>
        <div className="text-xs text-gray-500 mt-0.5">eingetragen</div>
      </div>

      {/* Sehenswürdigkeiten */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="bg-yellow-500/10 rounded-lg p-1.5">
            <Star className="w-4 h-4 text-yellow-400" />
          </div>
          <span className="text-gray-400 text-xs">Sehenswürdigkeiten</span>
        </div>
        <div className="text-2xl font-bold text-white">{sights.length}</div>
        <div className="text-xs text-gray-500 mt-0.5">eingetragen</div>
      </div>
    </div>
  );
}
