"use client";

/**
 * GpxMetaEdit – Modal zum Bearbeiten der GPX-Metadaten
 */

import { useState } from "react";
import { X, Save } from "lucide-react";
import { TYP_EMOJI } from "@/lib/gpx/utils";
import AlbumTreeSelect from "@/app/admin/alben/AlbumTreeSelect";

const TYPEN = ["Wanderung", "Autofahrt", "Fahrrad", "Schifffahrt", "Flugzeug"] as const;

interface Album { id: number; name: string; parentId: number | null }
interface Fotogruppe { idfgruppe: number; name: string }

export interface GpxTrackMeta {
  id: number;
  titel: string;
  beschreibung: string | null;
  typ: string;
  land: string | null;
  laengeKm: string | null;
  hoehmAuf: number | null;
  datumTour: Date | string | null;
  albumId: number | null;
  fotogruppeId: number | null;
}

interface GpxMetaEditProps {
  track: GpxTrackMeta;
  alben: Album[];
  fotogruppen?: Fotogruppe[];
  onClose: () => void;
  onSaved: (updated: GpxTrackMeta) => void;
}

export default function GpxMetaEdit({ track, alben, fotogruppen = [], onClose, onSaved }: GpxMetaEditProps) {
  const [titel,        setTitel]        = useState(track.titel);
  const [beschreibung, setBeschreibung] = useState(track.beschreibung ?? "");
  const [typ,          setTyp]          = useState(track.typ);
  const [land,         setLand]         = useState(track.land ?? "");
  const [laengeKm,     setLaengeKm]     = useState(track.laengeKm ?? "");
  const [hoehmAuf,     setHoehmAuf]     = useState(String(track.hoehmAuf ?? ""));
  const [datumTour,    setDatumTour]    = useState(() => {
    if (!track.datumTour) return "";
    const d = typeof track.datumTour === "string" ? new Date(track.datumTour) : track.datumTour;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  });
  const [albumId,      setAlbumId]      = useState(String(track.albumId ?? ""));
  const [fotogruppeId, setFotogruppeId] = useState(String(track.fotogruppeId ?? ""));
  const [speichern,    setSpeichern]    = useState(false);
  const [fehler,       setFehler]       = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titel.trim()) return;
    setSpeichern(true);
    setFehler(null);
    try {
      const res = await fetch(`/api/gpx/${track.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titel:        titel.trim(),
          beschreibung: beschreibung.trim() || null,
          typ,
          land:         land.trim() || null,
          laengeKm:     laengeKm || null,
          hoehmAuf:     hoehmAuf ? parseInt(hoehmAuf) : null,
          datumTour:    datumTour || null,
          albumId:      albumId      ? parseInt(albumId)      : null,
          fotogruppeId: fotogruppeId ? parseInt(fotogruppeId) : null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Fehler");
      onSaved({
        ...track,
        titel:        titel.trim(),
        beschreibung: beschreibung.trim() || null,
        typ,
        land:         land.trim() || null,
        laengeKm:     laengeKm || null,
        hoehmAuf:     hoehmAuf ? parseInt(hoehmAuf) : null,
        datumTour:    datumTour ? new Date(datumTour) : null,
        albumId:      albumId      ? parseInt(albumId)      : null,
        fotogruppeId: fotogruppeId ? parseInt(fotogruppeId) : null,
      });
      onClose();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e));
    } finally {
      setSpeichern(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Track bearbeiten</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Titel *</label>
            <input
              type="text" value={titel} onChange={e => setTitel(e.target.value)} required
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Beschreibung</label>
            <textarea
              value={beschreibung} onChange={e => setBeschreibung(e.target.value)} rows={3}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Typ</label>
              <select value={typ} onChange={e => setTyp(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                {TYPEN.map(t => <option key={t} value={t}>{TYP_EMOJI[t]} {t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Land</label>
              <input type="text" value={land} onChange={e => setLand(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="z.B. Deutschland" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Länge (km)</label>
              <input type="number" step="0.01" value={laengeKm} onChange={e => setLaengeKm(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Höhenmeter ↑</label>
              <input type="number" value={hoehmAuf} onChange={e => setHoehmAuf(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Datum</label>
              <input type="date" value={datumTour} onChange={e => setDatumTour(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Fotogruppe</label>
            <select
              value={fotogruppeId}
              onChange={e => setFotogruppeId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">– keine Fotogruppe –</option>
              {fotogruppen.map(g => (
                <option key={g.idfgruppe} value={String(g.idfgruppe)}>{g.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Album</label>
            <AlbumTreeSelect
              albums={alben}
              value={albumId}
              onChange={setAlbumId}
              noSelectionLabel="– kein Album –"
            />
          </div>

          {fehler && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-2 text-sm text-red-300">{fehler}</div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors">
              Abbrechen
            </button>
            <button type="submit" disabled={speichern}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50">
              <Save className="w-4 h-4" />
              {speichern ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
