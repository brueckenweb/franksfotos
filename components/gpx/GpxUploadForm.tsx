"use client";

/**
 * GpxUploadForm – Formular zum Hochladen eines GPX-Tracks
 * - GPX-Datei auswählen → automatische Analyse (Länge, Höhenmeter, Datum, Land)
 * - Metadaten eingeben
 * - Album verknüpfen
 * - Upload starten
 */

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, MapPin, Mountain, Calendar, Info } from "lucide-react";
import { parseGpxText, TYP_EMOJI } from "@/lib/gpx/utils";
import AlbumTreeSelect from "@/app/admin/alben/AlbumTreeSelect";

const TYPEN = ["Wanderung", "Autofahrt", "Fahrrad", "Schifffahrt", "Flugzeug"] as const;

interface Album { id: number; name: string; slug: string; parentId: number | null }

interface GpxUploadFormProps {
  alben: Album[];
}

export default function GpxUploadForm({ alben }: GpxUploadFormProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [datei,        setDatei]        = useState<File | null>(null);
  const [titel,        setTitel]        = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [typ,          setTyp]          = useState<string>("Wanderung");
  const [land,         setLand]         = useState("");
  const [laengeKm,     setLaengeKm]     = useState("");
  const [hoehmAuf,     setHoehmAuf]     = useState("");
  const [datumTour,    setDatumTour]    = useState("");
  const [albumId,      setAlbumId]      = useState("");
  const [analysiert,   setAnalysiert]   = useState(false);
  const [analyseFehler,setAnalyseFehler]= useState<string | null>(null);
  const [uploading,    setUploading]    = useState(false);
  const [fehler,       setFehler]       = useState<string | null>(null);
  const [geoLaden,     setGeoLaden]     = useState(false);

  // GPX-Datei auswählen → automatisch analysieren
  const onDateiAuswaehlen = useCallback(async (file: File) => {
    setDatei(file);
    setAnalysiert(false);
    setAnalyseFehler(null);

    // Dateiname als Titel-Vorschlag
    if (!titel) {
      const name = file.name.replace(/\.gpx$/i, "").replace(/[_-]+/g, " ");
      setTitel(name.charAt(0).toUpperCase() + name.slice(1));
    }

    try {
      const text = await file.text();
      const stats = parseGpxText(text);

      if (stats.punkte.length === 0) {
        setAnalyseFehler("Keine Trackpunkte gefunden.");
        return;
      }

      setLaengeKm(stats.laengeKm);
      setHoehmAuf(String(stats.hoehmAuf));
      if (stats.datumTour) {
        const d = stats.datumTour;
        const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
        setDatumTour(iso);
      }
      if (stats.name && !titel) setTitel(stats.name);

      // Reverse Geocoding für Land
      const ersterPunkt = stats.punkte[0];
      if (ersterPunkt) {
        setGeoLaden(true);
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${ersterPunkt.lat}&lon=${ersterPunkt.lon}&format=json&zoom=3`,
            { headers: { "Accept-Language": "de", "User-Agent": "FranksFotos/1.0" } }
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            const land = geoData.address?.country ?? "";
            if (land) setLand(land);
          }
        } catch { /* ignorieren */ }
        finally { setGeoLaden(false); }
      }

      setAnalysiert(true);
    } catch (e) {
      setAnalyseFehler("GPX konnte nicht gelesen werden: " + (e instanceof Error ? e.message : String(e)));
    }
  }, [titel]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onDateiAuswaehlen(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.name.toLowerCase().endsWith(".gpx")) onDateiAuswaehlen(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!datei || !titel.trim()) return;
    setUploading(true);
    setFehler(null);

    try {
      // 1. Datei hochladen
      const fd = new FormData();
      fd.append("gpxFile", datei, datei.name);
      const uploadRes = await fetch("/api/gpx/upload", { method: "POST", body: fd });
      if (!uploadRes.ok) {
        const d = await uploadRes.json();
        throw new Error(d.error ?? "Upload fehlgeschlagen");
      }
      const { url, filename } = await uploadRes.json();

      // 2. Datenbankentrag anlegen
      const dbRes = await fetch("/api/gpx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titel: titel.trim(),
          beschreibung: beschreibung.trim() || null,
          typ,
          land: land.trim() || null,
          laengeKm: laengeKm || null,
          hoehmAuf:  hoehmAuf ? parseInt(hoehmAuf) : null,
          datumTour: datumTour || null,
          albumId:   albumId  ? parseInt(albumId)   : null,
          gpxDateiname: filename,
          gpxUrl: url,
        }),
      });
      if (!dbRes.ok) {
        const d = await dbRes.json();
        throw new Error(d.error ?? "Speichern fehlgeschlagen");
      }
      const { id } = await dbRes.json();
      router.push(`/fotodatenbank/gpx/${id}`);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e));
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Datei-Dropzone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          datei
            ? "border-green-600 bg-green-900/10"
            : "border-gray-600 hover:border-blue-500 bg-gray-800/50"
        }`}
      >
        <input ref={fileRef} type="file" accept=".gpx" onChange={handleFileInput} className="hidden" />
        <Upload className={`w-10 h-10 mx-auto mb-3 ${datei ? "text-green-400" : "text-gray-500"}`} />
        {datei ? (
          <div>
            <p className="text-green-300 font-medium">{datei.name}</p>
            <p className="text-xs text-gray-500 mt-1">{(datei.size / 1024).toFixed(0)} KB</p>
          </div>
        ) : (
          <div>
            <p className="text-gray-300">GPX-Datei hier ablegen oder klicken</p>
            <p className="text-xs text-gray-500 mt-1">Nur .gpx Dateien, max. 50 MB</p>
          </div>
        )}
      </div>

      {/* Analyse-Ergebnis */}
      {analysiert && (
        <div className="bg-gray-800 rounded-lg p-4 grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2 text-gray-300">
            <MapPin className="w-4 h-4 text-blue-400" />
            <span>{parseFloat(laengeKm || "0").toFixed(1)} km</span>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <Mountain className="w-4 h-4 text-green-400" />
            <span>↑ {hoehmAuf} m</span>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>{datumTour || "–"}</span>
          </div>
          {geoLaden && (
            <div className="col-span-3 text-xs text-gray-500 flex items-center gap-1">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400" />
              Land wird ermittelt…
            </div>
          )}
        </div>
      )}
      {analyseFehler && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-sm text-red-300">
          {analyseFehler}
        </div>
      )}

      {/* Metadaten */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Titel *</label>
          <input
            type="text" value={titel} onChange={e => setTitel(e.target.value)} required
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            placeholder="Titel der Tour"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Beschreibung</label>
          <textarea
            value={beschreibung} onChange={e => setBeschreibung(e.target.value)} rows={3}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
            placeholder="Optionale Beschreibung…"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Typ</label>
            <select
              value={typ} onChange={e => setTyp(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            >
              {TYPEN.map(t => (
                <option key={t} value={t}>{TYP_EMOJI[t]} {t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Land {geoLaden && <span className="text-gray-500 text-xs">(wird ermittelt…)</span>}
            </label>
            <input
              type="text" value={land} onChange={e => setLand(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="z.B. Deutschland"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-blue-400" /> Länge (km)
            </label>
            <input
              type="number" step="0.01" value={laengeKm} onChange={e => setLaengeKm(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-1">
              <Mountain className="w-3.5 h-3.5 text-green-400" /> Höhenmeter ↑
            </label>
            <input
              type="number" value={hoehmAuf} onChange={e => setHoehmAuf(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-400" /> Datum Tour
            </label>
            <input
              type="date" value={datumTour} onChange={e => setDatumTour(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Album verknüpfen</label>
          <AlbumTreeSelect
            albums={alben}
            value={albumId}
            onChange={setAlbumId}
            noSelectionLabel="– kein Album –"
          />
        </div>
      </div>

      {fehler && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-sm text-red-300 flex items-center gap-2">
          <Info className="w-4 h-4 flex-shrink-0" />
          {fehler}
        </div>
      )}

      <button
        type="submit"
        disabled={!!(uploading || !datei || !titel.trim())}
        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
      >
        <Upload className="w-4 h-4" />
        {uploading ? "Wird hochgeladen…" : "Track hochladen & speichern"}
      </button>
    </form>
  );
}
