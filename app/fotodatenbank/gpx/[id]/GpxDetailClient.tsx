"use client";

/**
 * GpxDetailClient – Tab-Switcher zwischen Vorschau (GpxMap) und Editor (GpxEditor)
 * Wird vom Server-Component /fotodatenbank/gpx/[id]/page.tsx eingebunden.
 *
 * Beim Split werden zwei neue Tracks per POST /api/gpx angelegt und der
 * ursprüngliche Track per DELETE entfernt.
 */

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Map, Pencil, Split, Loader2 } from "lucide-react";
import { parseGpxText } from "@/lib/gpx/utils";

// SSR-unsafe – Leaflet nutzt window/document
const GpxMap = dynamic(() => import("@/components/gpx/GpxMap"), { ssr: false });
const GpxEditor = dynamic(() => import("@/components/gpx/GpxEditor"), { ssr: false });

interface AlbumOption {
  id: number;
  name: string;
}

interface Props {
  trackId:   number;
  gpxUrl:    string;
  titel:     string;
  typ:       string;
  laengeKm:  string | null;
  hoehmAuf:  number | null;
  datumTour: Date | string | null;
  alben:     AlbumOption[];
  albumId:   number | null;
}

type Tab = "karte" | "editor";

export default function GpxDetailClient({
  trackId,
  gpxUrl,
  titel,
  typ,
  laengeKm,
  hoehmAuf,
  datumTour,
  alben,
  albumId,
}: Props) {
  const router = useRouter();
  const [tab,       setTab]       = useState<Tab>("karte");
  const [splitting, setSplitting] = useState(false);
  const [splitMsg,  setSplitMsg]  = useState<{ typ: "ok" | "err"; text: string } | null>(null);

  // Nach erfolgreichem Speichern im Editor: Seite neu laden um Header-Stats zu aktualisieren
  const handleSaved = (newGpxUrl: string, stats: { laengeKm: string; hoehmAuf: number }) => {
    console.log("Gespeichert:", newGpxUrl, stats);
    router.refresh();
  };

  // Split-Callback: zwei GPX-Texte → zwei neue Einträge anlegen, Original löschen
  const handleSplit = async (gpx1: string, gpx2: string) => {
    setSplitting(true);
    setSplitMsg(null);
    try {
      // Stats aus GPX-Texten berechnen
      const s1 = parseGpxText(gpx1);
      const s2 = parseGpxText(gpx2);

      // Beide Teile hochladen (via Proxy-Route)
      const uploadTeil = async (gpxText: string, suffix: string): Promise<string> => {
        const blob = new Blob([gpxText], { type: "application/gpx+xml" });
        const fname = `${Date.now()}${suffix}_${titel.slice(0, 30).replace(/\s+/g, "-")}.gpx`;
        const fd = new FormData();
        fd.append("gpxFile", blob, fname);
        const res = await fetch("/api/gpx/upload", { method: "POST", body: fd });
        if (!res.ok) throw new Error("Upload Teil" + suffix + " fehlgeschlagen");
        const data = await res.json();
        return data.url as string;
      };

      const [url1, url2] = await Promise.all([
        uploadTeil(gpx1, "_teil1"),
        uploadTeil(gpx2, "_teil2"),
      ]);

      // Zwei neue Einträge anlegen
      const body1 = {
        titel:     `${titel} (Teil 1)`,
        typ,
        laengeKm:  s1.laengeKm,
        hoehmAuf:  s1.hoehmAuf,
        datumTour: s1.datumTour ?? datumTour,
        albumId,
        gpxUrl:    url1,
        gpxDateiname: url1.split("/").pop() ?? "",
      };
      const body2 = {
        titel:     `${titel} (Teil 2)`,
        typ,
        laengeKm:  s2.laengeKm,
        hoehmAuf:  s2.hoehmAuf,
        datumTour: s2.datumTour ?? datumTour,
        albumId,
        gpxUrl:    url2,
        gpxDateiname: url2.split("/").pop() ?? "",
      };

      const [r1, r2] = await Promise.all([
        fetch("/api/gpx", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body1) }),
        fetch("/api/gpx", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body2) }),
      ]);
      if (!r1.ok || !r2.ok) throw new Error("Fehler beim Anlegen der geteilten Tracks");

      // Original löschen
      await fetch(`/api/gpx/${trackId}`, { method: "DELETE" });

      setSplitMsg({ typ: "ok", text: "Track geteilt! Du wirst zur Liste weitergeleitet…" });
      setTimeout(() => router.push("/fotodatenbank/gpx"), 2000);
    } catch (e: unknown) {
      setSplitMsg({ typ: "err", text: "Fehler: " + (e instanceof Error ? e.message : String(e)) });
      setSplitting(false);
    }
  };

  const datumStr = datumTour
    ? (typeof datumTour === "string" ? datumTour : datumTour.toISOString().slice(0, 10))
    : undefined;

  return (
    <div className="space-y-4">
      {/* Tab-Leiste */}
      <div className="flex items-center gap-1 bg-gray-900 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("karte")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "karte"
              ? "bg-gray-700 text-white shadow"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Map className="w-4 h-4" />
          Karte
        </button>
        <button
          onClick={() => setTab("editor")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "editor"
              ? "bg-gray-700 text-white shadow"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Pencil className="w-4 h-4" />
          Editor
        </button>
      </div>

      {/* Split-Meldung */}
      {splitMsg && (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border ${
          splitMsg.typ === "ok"
            ? "bg-green-900/50 text-green-300 border-green-700"
            : "bg-red-900/50 text-red-300 border-red-700"
        }`}>
          {splitting && <Loader2 className="w-4 h-4 animate-spin" />}
          <Split className="w-4 h-4" />
          {splitMsg.text}
        </div>
      )}

      {/* Tab-Inhalt */}
      <div>
        {tab === "karte" ? (
          <GpxMap
            gpxUrl={gpxUrl}
            titel={titel}
            typ={typ}
            laengeKm={laengeKm ?? undefined}
            hoehmAuf={hoehmAuf ?? undefined}
            datumTour={datumStr}
            hoehe="500px"
          />
        ) : (
          <GpxEditor
            trackId={trackId}
            gpxUrl={gpxUrl}
            titel={titel}
            typ={typ}
            onSaved={handleSaved}
            onSplit={handleSplit}
            uploadUrl="/api/gpx/upload"
            uploadKey=""
          />
        )}
      </div>

      {/* Alben-Info (falls zugeordnet) */}
      {albumId != null && alben.length > 0 && (
        <div className="text-xs text-gray-500 mt-2">
          {(() => {
            const alb = alben.find(a => a.id === albumId);
            return alb ? `Album: ${alb.name}` : null;
          })()}
        </div>
      )}
    </div>
  );
}
