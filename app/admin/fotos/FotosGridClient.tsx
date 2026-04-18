"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Camera,
  Download,
  Pencil,
  Trash2,
  Lock,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  FolderInput,
  X,
  Loader2,
  CheckCheck,
  Eye,
  Search,
  Filter,
} from "lucide-react";
import DeletePhotoButton from "./DeletePhotoButton";
import AlbumTreeSelect, { AlbumOption } from "@/app/admin/alben/AlbumTreeSelect";

/** Lokale Thumbnail-Komponente mit Fallback */
function PhotoThumb({
  thumbnailUrl,
  fileUrl,
  alt,
}: {
  thumbnailUrl: string | null;
  fileUrl: string;
  alt: string;
}) {
  const [src, setSrc] = useState<string>(thumbnailUrl || fileUrl);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Camera className="w-8 h-8 text-gray-600" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      loading="lazy"
      onError={() => {
        if (thumbnailUrl && src === thumbnailUrl && fileUrl && fileUrl !== thumbnailUrl) {
          setSrc(fileUrl);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}

export interface PhotoRow {
  id: number;
  filename: string;
  title: string | null;
  fileUrl: string;
  thumbnailUrl: string | null;
  isPrivate: boolean;
  fileSize: number | null;
  albumName: string | null;
  albumId: number | null;
}

interface Props {
  photos: PhotoRow[];
  albums: AlbumOption[];
  totalCount: number;
  totalPages: number;
  safePage: number;
  from: number;
  to: number;
  filterAlbumId: string;
  searchQuery: string;
  filterUserId: string;
  filterUserName: string | null;
}

/** URL für Fotoliste mit optionalen Filterparametern aufbauen */
function buildUrl(page: number, album: string, q: string, user = ""): string {
  const p = new URLSearchParams();
  if (page > 1) p.set("page", String(page));
  if (album) p.set("album", album);
  const trimmed = q.trim();
  if (trimmed) p.set("q", trimmed);
  if (user) p.set("user", user);
  const qs = p.toString();
  return `/admin/fotos${qs ? `?${qs}` : ""}`;
}

export default function FotosGridClient({
  photos,
  albums,
  totalCount,
  totalPages,
  safePage,
  from,
  to,
  filterAlbumId,
  searchQuery,
  filterUserId,
  filterUserName,
}: Props) {
  const router = useRouter();

  // Multi-Select-State
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Aktions-State
  const [targetAlbumId, setTargetAlbumId] = useState("");
  const [loading, setLoading] = useState(false);

  // Suchfeld (lokaler Zustand für debounced Navigation)
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const isFirstRender = useRef(true);
  // aktuelle Filter-Werte als Refs für den Debounce-Callback
  const filterAlbumIdRef = useRef(filterAlbumId);
  const searchQueryRef = useRef(searchQuery);
  const filterUserIdRef = useRef(filterUserId);

  useEffect(() => {
    filterAlbumIdRef.current = filterAlbumId;
    searchQueryRef.current = searchQuery;
    filterUserIdRef.current = filterUserId;
  }, [filterAlbumId, searchQuery, filterUserId]);

  // Wenn sich searchQuery durch Server-Navigation ändert, lokalSearch synchronisieren
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  // Debounce: 450 ms nach letzter Eingabe navigieren
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const trimmed = localSearch.trim();
    const timer = setTimeout(() => {
      if (trimmed !== searchQueryRef.current.trim()) {
        router.push(buildUrl(1, filterAlbumIdRef.current, trimmed, filterUserIdRef.current));
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [localSearch, router]);

  /* ------------------------------------------------------------------ */
  /*  Auswahl-Logik                                                        */
  /* ------------------------------------------------------------------ */

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(photos.map((p) => p.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
    setTargetAlbumId("");
  }

  /* ------------------------------------------------------------------ */
  /*  Filter-Aktionen                                                      */
  /* ------------------------------------------------------------------ */

  function handleFilterAlbumChange(newAlbumId: string) {
    router.push(buildUrl(1, newAlbumId, localSearch, filterUserId));
  }

  function clearAllFilters() {
    setLocalSearch("");
    router.push("/admin/fotos");
  }

  const hasActiveFilter = !!filterAlbumId || !!searchQuery || !!filterUserId;

  /* ------------------------------------------------------------------ */
  /*  Batch-Aktionen                                                       */
  /* ------------------------------------------------------------------ */

  const handleMove = useCallback(async () => {
    if (selected.size === 0) return;
    if (!targetAlbumId && targetAlbumId !== "") {
      alert("Bitte zuerst ein Ziel-Album auswählen.");
      return;
    }

    const albumIdValue = targetAlbumId === "" ? null : parseInt(targetAlbumId);
    const label = albums.find((a) => String(a.id) === targetAlbumId)?.name ?? "kein Album";

    if (
      !confirm(
        `${selected.size} Foto(s) in „${label}" verschieben?`
      )
    )
      return;

    setLoading(true);
    try {
      const res = await fetch("/api/photos/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), albumId: albumIdValue }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Fehler");
      exitSelectMode();
      router.refresh();
    } catch (e) {
      alert(`Fehler beim Verschieben: ${e instanceof Error ? e.message : e}`);
    } finally {
      setLoading(false);
    }
  }, [selected, targetAlbumId, albums, router]);

  const handleDelete = useCallback(async () => {
    if (selected.size === 0) return;
    if (!confirm(`${selected.size} Foto(s) wirklich unwiderruflich löschen?`)) return;

    setLoading(true);
    try {
      const res = await fetch("/api/photos/batch", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Fehler");
      exitSelectMode();
      router.refresh();
    } catch (e) {
      alert(`Fehler beim Löschen: ${e instanceof Error ? e.message : e}`);
    } finally {
      setLoading(false);
    }
  }, [selected, router]);

  /* ------------------------------------------------------------------ */
  /*  Render                                                               */
  /* ------------------------------------------------------------------ */

  const allSelected = photos.length > 0 && selected.size === photos.length;

  /** URL zur Foto-Bearbeitungsseite mit Rücksprung-Parametern */
  function buildEditUrl(photoId: number): string {
    const p = new URLSearchParams();
    p.set("page", String(safePage));
    if (filterAlbumId) p.set("album", filterAlbumId);
    const trimmed = localSearch.trim();
    if (trimmed) p.set("q", trimmed);
    if (filterUserId) p.set("user", filterUserId);
    return `/admin/fotos/${photoId}/edit?${p.toString()}`;
  }

  return (
    <>
      {/* ---- Header-Aktionen ---- */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Fotos</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {totalCount > 0
              ? `${totalCount} Foto${totalCount !== 1 ? "s" : ""} gefunden · Seite ${safePage} von ${totalPages}`
              : hasActiveFilter
              ? "Keine Fotos für diesen Filter gefunden"
              : "Noch keine Fotos"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mehrfachauswahl-Toggle */}
          {photos.length > 0 && (
            <button
              onClick={() => {
                if (selectMode) {
                  exitSelectMode();
                } else {
                  setSelectMode(true);
                }
              }}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors border ${
                selectMode
                  ? "bg-amber-500/20 border-amber-500 text-amber-400 hover:bg-amber-500/30"
                  : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white"
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              {selectMode ? "Auswahl beenden" : "Mehrfachauswahl"}
            </button>
          )}
          <Link
            href="/admin/upload"
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <Camera className="w-4 h-4" />
            Fotos hochladen
          </Link>
        </div>
      </div>

      {/* ---- Filter-Leiste ---- */}
      <div className="mb-4 flex flex-col sm:flex-row gap-2 bg-gray-900 border border-gray-800 rounded-xl p-3">
        {/* Volltextsuche */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Fotos suchen (Titel, Dateiname) …"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 hover:border-gray-600 focus:border-amber-500 focus:outline-none rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 transition-colors"
          />
          {localSearch && (
            <button
              onClick={() => setLocalSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              title="Suche löschen"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Album-Filter */}
        <div className="flex items-center gap-2 sm:w-72">
          <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <AlbumTreeSelect
              albums={albums}
              value={filterAlbumId}
              onChange={handleFilterAlbumChange}
              noSelectionLabel="— Alle Alben —"
            />
          </div>
        </div>

        {/* Filter zurücksetzen */}
        {hasActiveFilter && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 rounded-lg transition-colors whitespace-nowrap"
            title="Alle Filter zurücksetzen"
          >
            <X className="w-3.5 h-3.5" />
            Filter zurücksetzen
          </button>
        )}
      </div>

      {/* Aktiver-Filter-Badge */}
      {hasActiveFilter && (
        <div className="mb-3 flex flex-wrap gap-2">
          {filterUserId && (
            <span className="inline-flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs rounded-full px-3 py-1">
              <Eye className="w-3 h-3" />
              Hochgeladen von: {filterUserName ?? `User #${filterUserId}`}
              <button
                onClick={() => router.push(buildUrl(1, filterAlbumId, localSearch, ""))}
                className="hover:text-white transition-colors ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {searchQuery && (
            <span className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs rounded-full px-3 py-1">
              <Search className="w-3 h-3" />
              Suche: „{searchQuery}"
              <button
                onClick={() => {
                  setLocalSearch("");
                  router.push(buildUrl(1, filterAlbumId, "", filterUserId));
                }}
                className="hover:text-white transition-colors ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filterAlbumId && (
            <span className="inline-flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs rounded-full px-3 py-1">
              <Filter className="w-3 h-3" />
              Album: {albums.find((a) => String(a.id) === filterAlbumId)?.name ?? filterAlbumId}
              <button
                onClick={() => router.push(buildUrl(1, "", localSearch, filterUserId))}
                className="hover:text-white transition-colors ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* ---- Auswahl-Toolbar ---- */}
      {selectMode && (
        <div className="mb-4 flex items-center gap-3 bg-gray-900 border border-amber-500/30 rounded-xl p-3 flex-wrap">
          {/* Alle / Keine */}
          <button
            onClick={allSelected ? clearSelection : selectAll}
            className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-amber-400 transition-colors"
          >
            {allSelected ? (
              <CheckCheck className="w-4 h-4 text-amber-400" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            {allSelected ? "Alle abwählen" : "Alle auswählen"}
          </button>

          <span className="text-gray-600">|</span>

          <span className="text-sm text-gray-400">
            {selected.size === 0
              ? "Keine Fotos ausgewählt"
              : `${selected.size} Foto${selected.size !== 1 ? "s" : ""} ausgewählt`}
          </span>

          {selected.size > 0 && (
            <>
              <span className="text-gray-600 hidden sm:inline">|</span>

              {/* Album-Auswahl */}
              <div className="w-56 sm:w-64">
                <AlbumTreeSelect
                  albums={albums}
                  value={targetAlbumId}
                  onChange={setTargetAlbumId}
                  noSelectionLabel="— Kein Album (freistehend) —"
                />
              </div>

              {/* Verschieben */}
              <button
                onClick={handleMove}
                disabled={loading}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FolderInput className="w-4 h-4" />
                )}
                Verschieben
              </button>

              {/* Löschen */}
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Löschen
              </button>

              {/* Auswahl aufheben */}
              <button
                onClick={clearSelection}
                className="text-gray-500 hover:text-gray-300 transition-colors ml-auto"
                title="Auswahl aufheben"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      )}

      {/* ---- Foto-Grid ---- */}
      {photos.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-xl">
          <Camera className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          {hasActiveFilter ? (
            <>
              <p className="text-gray-400">Keine Fotos für den aktuellen Filter gefunden.</p>
              <button
                onClick={clearAllFilters}
                className="mt-4 inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 text-sm"
              >
                <X className="w-4 h-4" />
                Filter zurücksetzen
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-400">Noch keine Fotos vorhanden.</p>
              <Link
                href="/admin/upload"
                className="mt-4 inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 text-sm"
              >
                <Camera className="w-4 h-4" />
                Erste Fotos hochladen
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {photos.map((photo) => {
              const isSelected = selected.has(photo.id);
              return (
                <div
                  key={photo.id}
                  onClick={selectMode ? () => toggleSelect(photo.id) : undefined}
                  className={`group relative bg-gray-900 border rounded-lg overflow-hidden transition-colors ${
                    selectMode ? "cursor-pointer" : ""
                  } ${
                    isSelected
                      ? "border-amber-500 ring-2 ring-amber-500/40"
                      : "border-gray-800 hover:border-gray-700"
                  }`}
                >
                  {/* Vorschaubild */}
                  <div className="aspect-square bg-gray-800 relative overflow-hidden">
                    <PhotoThumb
                      thumbnailUrl={photo.thumbnailUrl ?? null}
                      fileUrl={photo.fileUrl}
                      alt={photo.title || photo.filename}
                    />

                    {/* Multi-Select Checkbox */}
                    {selectMode && (
                      <div className="absolute top-1.5 right-1.5 z-10">
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
                            isSelected
                              ? "bg-amber-500 border-amber-500"
                              : "bg-black/50 border-white/70"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              className="w-3 h-3 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Hover-Overlay (nur im Normal-Modus) */}
                    {!selectMode && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                        <Link
                          href={`/foto/${photo.id}`}
                          className="bg-white/90 hover:bg-white text-gray-900 rounded-full p-1.5 transition-colors"
                          title="Foto ansehen"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        <Link
                          href={buildEditUrl(photo.id)}
                          className="bg-white/90 hover:bg-white text-gray-900 rounded-full p-1.5 transition-colors"
                          title="Bearbeiten"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Link>
                        <a
                          href={`/api/download/${photo.id}`}
                          className="bg-white/90 hover:bg-white text-gray-900 rounded-full p-1.5 transition-colors"
                          title="Herunterladen"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <DeletePhotoButton photoId={photo.id} />
                      </div>
                    )}

                    {/* Privat-Badge */}
                    {photo.isPrivate && (
                      <div className="absolute top-1.5 left-1.5 bg-black/70 rounded-full p-1">
                        <Lock className="w-3 h-3 text-amber-400" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-2">
                    <p className="text-xs text-gray-300 truncate font-medium">
                      {photo.title || photo.filename}
                    </p>
                    {photo.albumName && (
                      <p className="text-xs text-gray-600 truncate">{photo.albumName}</p>
                    )}
                    {photo.fileSize && (
                      <p className="text-xs text-gray-700">
                        {(photo.fileSize / (1024 * 1024)).toFixed(1)} MB
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ---- Pagination ---- */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {from}–{to} von {totalCount} Fotos
              </p>

              <div className="flex items-center gap-1">
                {safePage > 2 && (
                  <Link
                    href={buildUrl(1, filterAlbumId, localSearch, filterUserId)}
                    className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    1
                  </Link>
                )}
                {safePage > 3 && <span className="px-2 text-gray-600">…</span>}

                {safePage > 1 && (
                  <Link
                    href={buildUrl(safePage - 1, filterAlbumId, localSearch, filterUserId)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {safePage - 1}
                  </Link>
                )}

                <span className="px-3 py-1.5 text-sm font-semibold text-white bg-amber-500 rounded-lg">
                  {safePage}
                </span>

                {safePage < totalPages && (
                  <Link
                    href={buildUrl(safePage + 1, filterAlbumId, localSearch, filterUserId)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    {safePage + 1}
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                )}

                {safePage < totalPages - 2 && (
                  <span className="px-2 text-gray-600">…</span>
                )}

                {safePage < totalPages - 1 && (
                  <Link
                    href={buildUrl(totalPages, filterAlbumId, localSearch, filterUserId)}
                    className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    {totalPages}
                  </Link>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={safePage > 1 ? buildUrl(safePage - 1, filterAlbumId, localSearch, filterUserId) : "#"}
                  className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    safePage <= 1
                      ? "text-gray-700 cursor-not-allowed"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  }`}
                  aria-disabled={safePage <= 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Zurück
                </Link>
                <Link
                  href={safePage < totalPages ? buildUrl(safePage + 1, filterAlbumId, localSearch, filterUserId) : "#"}
                  className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    safePage >= totalPages
                      ? "text-gray-700 cursor-not-allowed"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  }`}
                  aria-disabled={safePage >= totalPages}
                >
                  Weiter
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
