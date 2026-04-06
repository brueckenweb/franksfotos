"use client";

/**
 * AlbumGpxPanel – zeigt alle GPX-Tracks eines Albums
 * Wird clientseitig geladen (Leaflet braucht Browser-Kontext)
 */

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { MapPin, Mountain, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { TYP_EMOJI, TYP_FARBE } from "@/lib/gpx/utils";

// GpxMap nur clientseitig laden
const GpxMap = dynamic(() => import("./GpxMap"), { ssr: false, loading: () => (
  <div className="h-64 flex items-center justify-center bg-gray-800 rounded-xl">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400" />
  </div>
)});

interface Track {
  id: number;
  titel: string;
  beschreibung: string | null;
  typ: string;
  land: string | null;
  laengeKm: string | null;
  hoehmAuf: number | null;
  datumTour: string | null;
  gpxUrl: string;
}

interface AlbumGpxPanelProps {
  albumId: number;
}

export default function AlbumGpxPanel({ albumId }: AlbumGpxPanelProps) {
  const [tracks,   setTracks]   = useState<Track[]>([]);
  const [laden,    setLaden]    = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch(`/api/gpx/album/${albumId}`)
      .then(r => r.json())
      .then(d => {
        const list: Track[] = d.tracks ?? [];
        setTracks(list);
        // Alle Tracks standardmäßig aufklappen
        setExpanded(new Set(list.map(t => t.id)));
      })
      .catch(() => setTracks([]))
      .finally(() => setLaden(false));
  }, [albumId]);

  if (laden) return (
    <div className="flex items-center justify-center h-20 text-gray-500 text-sm">
      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400 mr-2" />
      Tracks werden geladen…
    </div>
  );

  if (tracks.length === 0) return null;

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatDatum = (d: string | null) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        🗺️ GPS-Tracks
        <span className="text-gray-500 font-normal text-sm">({tracks.length})</span>
      </h2>

      <div className="space-y-3">
        {tracks.map(track => {
          const isOpen = expanded.has(track.id);
          const farbe  = TYP_FARBE[track.typ] ?? "#3b82f6";
          return (
            <div key={track.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {/* Header */}
              <button
                onClick={() => toggleExpand(track.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors text-left"
              >
                <span className="text-xl">{TYP_EMOJI[track.typ] ?? "🗺️"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{track.titel}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
                    {track.laengeKm && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="w-3 h-3" />
                        {parseFloat(track.laengeKm).toFixed(1)} km
                      </span>
                    )}
                    {track.hoehmAuf != null && track.hoehmAuf > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Mountain className="w-3 h-3" />
                        ↑{track.hoehmAuf} m
                      </span>
                    )}
                    {formatDatum(track.datumTour) && (
                      <span className="flex items-center gap-0.5">
                        <Calendar className="w-3 h-3" />
                        {formatDatum(track.datumTour)}
                      </span>
                    )}
                    {track.land && <span>📍 {track.land}</span>}
                    <span style={{ color: farbe }} className="font-medium">{track.typ}</span>
                  </div>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />}
              </button>

              {/* Kartenansicht */}
              {isOpen && (
                <div className="px-4 pb-4">
                  {track.beschreibung && (
                    <p className="text-gray-400 text-sm mb-3">{track.beschreibung}</p>
                  )}
                  <GpxMap
                    gpxUrl={track.gpxUrl}
                    titel={track.titel}
                    typ={track.typ}
                    laengeKm={track.laengeKm}
                    hoehmAuf={track.hoehmAuf}
                    datumTour={track.datumTour}
                    hoehe="350px"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
