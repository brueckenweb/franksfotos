"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Map, Trash2 } from "lucide-react";
import { TYP_EMOJI } from "@/lib/gpx/utils";
import GpxMetaEdit, { type GpxTrackMeta } from "@/components/gpx/GpxMetaEdit";

interface Track {
  id: number;
  titel: string;
  typ: string;
  land: string | null;
  laengeKm: string | null;
  hoehmAuf: number | null;
  datumTour: Date | string | null;
  eingetragen: Date | string;
  albumId: number | null;
  albumName: string | null;
  albumSlug: string | null;
  fotogruppeId: number | null;
  fotogruppenName: string | null;
  userName: string | null;
}

interface Album { id: number; name: string; parentId: number | null }
interface Fotogruppe { idfgruppe: number; name: string }

interface Props {
  tracks: Track[];
  alben: Album[];
  fotogruppen: Fotogruppe[];
}

export default function GpxListClient({ tracks: initial, alben, fotogruppen }: Props) {
  const router = useRouter();
  const [tracks, setTracks] = useState<Track[]>(initial);
  const [editTrack, setEditTrack] = useState<Track | null>(null);
  const [delConfirm, setDelConfirm] = useState<number | null>(null);

  const formatDatum = (d: Date | string | null) => {
    if (!d) return "–";
    return new Date(d).toLocaleDateString("de-DE");
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/gpx/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTracks(prev => prev.filter(t => t.id !== id));
      setDelConfirm(null);
    }
  };

  const handleSaved = (updated: GpxTrackMeta) => {
    setTracks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
    setEditTrack(null);
    router.refresh();
  };

  if (tracks.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <div className="text-4xl mb-3">🗺️</div>
        <p>Noch keine GPX-Tracks vorhanden.</p>
        <Link href="/fotodatenbank/gpx/neu" className="mt-4 inline-block text-blue-400 hover:text-blue-300 text-sm">
          Ersten Track hochladen →
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 bg-gray-800/50 text-gray-400 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3">Typ</th>
              <th className="text-left px-4 py-3">Titel</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Land</th>
              <th className="text-right px-4 py-3 hidden sm:table-cell">km</th>
              <th className="text-right px-4 py-3 hidden sm:table-cell">↑ m</th>
              <th className="text-left px-4 py-3 hidden lg:table-cell">Datum</th>
              <th className="text-left px-4 py-3 hidden lg:table-cell">Fotogruppe</th>
              <th className="text-left px-4 py-3 hidden xl:table-cell">Album</th>
              <th className="text-left px-4 py-3 hidden xl:table-cell">Eingetragen</th>
              <th className="px-4 py-3 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((t, i) => (
              <tr key={t.id} className={`border-b border-gray-800 hover:bg-gray-800/30 transition-colors ${i % 2 === 0 ? "" : "bg-gray-900/30"}`}>
                <td className="px-4 py-3 text-lg">{TYP_EMOJI[t.typ] ?? "🗺️"}</td>
                <td className="px-4 py-3">
                  <Link href={`/fotodatenbank/gpx/${t.id}`} className="text-white hover:text-blue-300 font-medium transition-colors">
                    {t.titel}
                  </Link>
                  {t.typ && <span className="ml-2 text-xs text-gray-500">{t.typ}</span>}
                </td>
                <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{t.land ?? "–"}</td>
                <td className="px-4 py-3 text-gray-300 text-right hidden sm:table-cell">
                  {t.laengeKm ? parseFloat(t.laengeKm).toFixed(1) : "–"}
                </td>
                <td className="px-4 py-3 text-gray-300 text-right hidden sm:table-cell">
                  {t.hoehmAuf ?? "–"}
                </td>
                <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{formatDatum(t.datumTour)}</td>
                {/* Fotogruppe */}
                <td className="px-4 py-3 hidden lg:table-cell">
                  {t.fotogruppenName ? (
                    <span className="inline-block bg-amber-900/30 text-amber-400 text-xs px-2 py-0.5 rounded border border-amber-800/50 truncate max-w-[140px]" title={t.fotogruppenName}>
                      {t.fotogruppenName}
                    </span>
                  ) : (
                    <span className="text-gray-600 text-xs">–</span>
                  )}
                </td>
                {/* Album */}
                <td className="px-4 py-3 hidden xl:table-cell">
                  {t.albumSlug ? (
                    <Link href={`/alben/${t.albumSlug}`} className="text-blue-400 hover:text-blue-300 text-xs transition-colors">
                      {t.albumName}
                    </Link>
                  ) : <span className="text-gray-600 text-xs">–</span>}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs hidden xl:table-cell">{formatDatum(t.eingetragen)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => setEditTrack(t)}
                      className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                      title="Metadaten bearbeiten"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <Link
                      href={`/fotodatenbank/gpx/${t.id}`}
                      className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                      title="Track-Editor"
                    >
                      <Map className="w-3.5 h-3.5" />
                    </Link>
                    {delConfirm === t.id ? (
                      <span className="flex items-center gap-1 ml-1">
                        <button onClick={() => handleDelete(t.id)} className="text-xs text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded bg-red-900/30 border border-red-700">Löschen</button>
                        <button onClick={() => setDelConfirm(null)} className="text-xs text-gray-400 hover:text-gray-300 px-1.5 py-0.5 rounded bg-gray-700">Abbrechen</button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setDelConfirm(t.id)}
                        className="p-1.5 rounded hover:bg-red-900/30 text-gray-500 hover:text-red-400 transition-colors"
                        title="Löschen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editTrack && (
        <GpxMetaEdit
          track={{
            id:           editTrack.id,
            titel:        editTrack.titel,
            beschreibung: null,
            typ:          editTrack.typ,
            land:         editTrack.land,
            laengeKm:     editTrack.laengeKm,
            hoehmAuf:     editTrack.hoehmAuf,
            datumTour:    editTrack.datumTour,
            albumId:      editTrack.albumId,
            fotogruppeId: editTrack.fotogruppeId,
          }}
          alben={alben}
          fotogruppen={fotogruppen}
          onClose={() => setEditTrack(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
