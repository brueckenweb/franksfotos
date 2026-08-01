"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Map as MapIcon, Trash2, ArrowUpDown, ChevronUp, ChevronDown, Check, FolderOpen } from "lucide-react";
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
  sortOrder: number;
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

type SortKey = "typ" | "titel" | "land" | "laengeKm" | "hoehmAuf" | "datumTour" | "fotogruppenName" | "albumName" | "eingetragen";
type SortDir = "asc" | "desc";

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30 inline-block" />;
  return sortDir === "asc"
    ? <ChevronUp   className="w-3 h-3 ml-1 text-blue-400 inline-block" />
    : <ChevronDown className="w-3 h-3 ml-1 text-blue-400 inline-block" />;
}

export default function GpxListClient({ tracks: initial, alben, fotogruppen }: Props) {
  const router = useRouter();
  const [tracks, setTracks] = useState<Track[]>(initial);
  const [editTrack, setEditTrack] = useState<Track | null>(null);
  const [delConfirm, setDelConfirm] = useState<number | null>(null);
  const [sortierModus, setSortierModus] = useState(false);
  const [sortierTracks, setSortierTracks] = useState<Track[]>([]);
  const [savingSort, setSavingSort] = useState(false);
  const [sortSaved, setSortSaved] = useState(false);

  // ── Spalten-Sortierung ───────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<SortKey>("eingetragen");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedTracks = useMemo(() => {
    return [...tracks].sort((a, b) => {
      let valA: string | number | null = null;
      let valB: string | number | null = null;

      switch (sortKey) {
        case "typ":
          valA = a.typ ?? "";
          valB = b.typ ?? "";
          break;
        case "titel":
          valA = a.titel ?? "";
          valB = b.titel ?? "";
          break;
        case "land":
          valA = a.land ?? "";
          valB = b.land ?? "";
          break;
        case "laengeKm":
          valA = a.laengeKm ? parseFloat(a.laengeKm) : -1;
          valB = b.laengeKm ? parseFloat(b.laengeKm) : -1;
          break;
        case "hoehmAuf":
          valA = a.hoehmAuf ?? -1;
          valB = b.hoehmAuf ?? -1;
          break;
        case "datumTour":
          valA = a.datumTour ? new Date(a.datumTour).getTime() : -1;
          valB = b.datumTour ? new Date(b.datumTour).getTime() : -1;
          break;
        case "fotogruppenName":
          valA = a.fotogruppenName ?? "";
          valB = b.fotogruppenName ?? "";
          break;
        case "albumName":
          valA = a.albumName ?? "";
          valB = b.albumName ?? "";
          break;
        case "eingetragen":
          valA = new Date(a.eingetragen).getTime();
          valB = new Date(b.eingetragen).getTime();
          break;
      }

      if (typeof valA === "string" && typeof valB === "string") {
        const cmp = valA.localeCompare(valB, "de", { sensitivity: "base" });
        return sortDir === "asc" ? cmp : -cmp;
      }
      const numA = valA as number;
      const numB = valB as number;
      return sortDir === "asc" ? numA - numB : numB - numA;
    });
  }, [tracks, sortKey, sortDir]);

  // ── Hilfsfunktionen ──────────────────────────────────────────────────
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

  // Sortier-Modus aktivieren: nur Tracks mit Album gruppieren
  const startSortieren = () => {
    const mitAlbum = tracks.filter(t => t.albumId !== null);
    const sorted = [...mitAlbum].sort((a, b) =>
      (a.albumId ?? 0) - (b.albumId ?? 0) ||
      a.sortOrder - b.sortOrder ||
      a.titel.localeCompare(b.titel, "de")
    );
    setSortierTracks(sorted);
    setSortierModus(true);
    setSortSaved(false);
  };

  // Einen Track innerhalb seines Albums nach oben/unten verschieben
  const moveTrack = (id: number, direction: "up" | "down") => {
    setSortierTracks(prev => {
      const idx = prev.findIndex(t => t.id === id);
      if (idx === -1) return prev;
      const track = prev[idx];
      const albumId = track.albumId;

      const albumTracks = prev.filter(t => t.albumId === albumId);
      const albumIdx = albumTracks.findIndex(t => t.id === id);

      if (direction === "up" && albumIdx === 0) return prev;
      if (direction === "down" && albumIdx === albumTracks.length - 1) return prev;

      const swapWith = direction === "up" ? albumTracks[albumIdx - 1] : albumTracks[albumIdx + 1];
      const swapIdx = prev.findIndex(t => t.id === swapWith.id);

      const newArr = [...prev];
      [newArr[idx], newArr[swapIdx]] = [newArr[swapIdx], newArr[idx]];
      return newArr;
    });
    setSortSaved(false);
  };

  // Reihenfolge speichern
  const saveSortOrder = async () => {
    setSavingSort(true);
    try {
      const albumGroups = new Map<number, Track[]>();
      for (const t of sortierTracks) {
        if (t.albumId !== null) {
          if (!albumGroups.has(t.albumId)) albumGroups.set(t.albumId, []);
          albumGroups.get(t.albumId)!.push(t);
        }
      }

      const updates: { id: number; sortOrder: number }[] = [];
      for (const group of albumGroups.values()) {
        group.forEach((t, i) => updates.push({ id: t.id, sortOrder: i }));
      }

      const res = await fetch("/api/gpx/sort-order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        setTracks(prev =>
          prev.map(t => {
            const upd = updates.find(u => u.id === t.id);
            return upd ? { ...t, sortOrder: upd.sortOrder } : t;
          })
        );
        setSortSaved(true);
        router.refresh();
      }
    } finally {
      setSavingSort(false);
    }
  };

  // Album-Gruppen für den Sortier-Modus
  const albumGruppen = (() => {
    const map = new Map<number, { albumName: string; albumSlug: string | null; tracks: Track[] }>();
    for (const t of sortierTracks) {
      if (t.albumId === null) continue;
      if (!map.has(t.albumId)) {
        map.set(t.albumId, { albumName: t.albumName ?? `Album ${t.albumId}`, albumSlug: t.albumSlug, tracks: [] });
      }
      map.get(t.albumId)!.tracks.push(t);
    }
    return Array.from(map.entries()).map(([id, val]) => ({ albumId: id, ...val }));
  })();

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

  // Spalten-Header mit Klick-Sortierung
  const Th = ({
    col, label, className = "", align = "left",
  }: {
    col: SortKey; label: string; className?: string; align?: "left" | "right";
  }) => (
    <th
      className={`px-4 py-3 cursor-pointer select-none hover:text-white transition-colors ${align === "right" ? "text-right" : "text-left"} ${className}`}
      onClick={() => handleSort(col)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
      </span>
    </th>
  );

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        {!sortierModus ? (
          <button
            onClick={startSortieren}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors border border-gray-600"
          >
            <ArrowUpDown className="w-4 h-4" />
            Reihenfolge nach Album bearbeiten
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={saveSortOrder}
              disabled={savingSort}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Check className="w-4 h-4" />
              {savingSort ? "Wird gespeichert…" : sortSaved ? "Gespeichert ✓" : "Reihenfolge speichern"}
            </button>
            <button
              onClick={() => { setSortierModus(false); setSortSaved(false); }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors border border-gray-600"
            >
              Abbrechen
            </button>
            <span className="text-xs text-gray-500">
              Tracks ohne Album werden hier nicht angezeigt.
            </span>
          </div>
        )}
      </div>

      {/* ── Sortier-Modus ──────────────────────────────────────── */}
      {sortierModus && (
        <div className="space-y-6 mb-6">
          {albumGruppen.length === 0 && (
            <div className="text-center py-10 text-gray-500 text-sm">
              Keine Tracks mit Album-Zuordnung vorhanden.
            </div>
          )}
          {albumGruppen.map(gruppe => (
            <div key={gruppe.albumId} className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
              <div className="bg-gray-800 px-4 py-3 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-amber-400" />
                <span className="text-white font-medium text-sm">{gruppe.albumName}</span>
                {gruppe.albumSlug && (
                  <Link
                    href={`/alben/${gruppe.albumSlug}`}
                    className="text-xs text-gray-500 hover:text-blue-400 transition-colors ml-1"
                    target="_blank"
                  >
                    ↗
                  </Link>
                )}
                <span className="text-xs text-gray-500 ml-auto">{gruppe.tracks.length} Track{gruppe.tracks.length !== 1 ? "s" : ""}</span>
              </div>

              <div className="divide-y divide-gray-800">
                {gruppe.tracks.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-gray-600 text-xs w-5 text-center font-mono">{i + 1}</span>
                    <span className="text-base">{TYP_EMOJI[t.typ] ?? "🗺️"}</span>
                    <span className="text-white text-sm font-medium flex-1 truncate">{t.titel}</span>
                    <span className="text-gray-500 text-xs hidden sm:block">{formatDatum(t.datumTour)}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveTrack(t.id, "up")}
                        disabled={i === 0}
                        className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                        title="Nach oben"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveTrack(t.id, "down")}
                        disabled={i === gruppe.tracks.length - 1}
                        className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                        title="Nach unten"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Normale Tabellen-Ansicht ───────────────────────────── */}
      {!sortierModus && (
        <div className="overflow-x-auto rounded-xl border border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-800/50 text-gray-400 text-xs uppercase tracking-wide">
                <Th col="typ"            label="Typ"         />
                <Th col="titel"          label="Titel"       />
                <Th col="land"           label="Land"        className="hidden md:table-cell" />
                <Th col="laengeKm"       label="km"          className="hidden sm:table-cell" align="right" />
                <Th col="hoehmAuf"       label="↑ m"         className="hidden sm:table-cell" align="right" />
                <Th col="datumTour"      label="Datum"       className="hidden lg:table-cell" />
                <Th col="fotogruppenName" label="Fotogruppe" className="hidden lg:table-cell" />
                <Th col="albumName"      label="Album"       className="hidden xl:table-cell" />
                <Th col="eingetragen"    label="Eingetragen" className="hidden xl:table-cell" />
                <th className="px-4 py-3 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {sortedTracks.map((t, i) => (
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
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {t.fotogruppenName ? (
                      <span className="inline-block bg-amber-900/30 text-amber-400 text-xs px-2 py-0.5 rounded border border-amber-800/50 truncate max-w-[140px]" title={t.fotogruppenName}>
                        {t.fotogruppenName}
                      </span>
                    ) : (
                      <span className="text-gray-600 text-xs">–</span>
                    )}
                  </td>
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
                        <MapIcon className="w-3.5 h-3.5" />
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
      )}

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
