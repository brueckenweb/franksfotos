"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  FolderOpen,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Upload,
  GripVertical,
  ExternalLink,
  Search,
  X,
} from "lucide-react";
import { deleteAlbum, updateAlbumSortOrders } from "./actions";

export type AlbumWithStats = {
  id: number;
  parentId: number | null;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  photoCount: number;
  videoCount: number;
  totalPhotoCount: number;
  totalVideoCount: number;
  visibleFor: string[];
};

interface Props {
  rootAlbums: AlbumWithStats[];
  childrenMap: Record<number, AlbumWithStats[]>;
  isDragEnabled?: boolean;
}

export default function AlbumTableClient({
  rootAlbums,
  childrenMap,
  isDragEnabled = false,
}: Props) {
  // Alle Alben auf allen Ebenen, die Unteralben haben, initial einklappen
  const [collapsed, setCollapsed] = useState<Set<number>>(() => {
    const ids = new Set<number>();
    for (const [id, children] of Object.entries(childrenMap)) {
      if (children.length > 0) ids.add(Number(id));
    }
    return ids;
  });
  const [localRootAlbums, setLocalRootAlbums] = useState(rootAlbums);
  const [localChildrenMap, setLocalChildrenMap] = useState(childrenMap);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Props-Änderungen übernehmen (z.B. nach Sortierumschalter)
  useEffect(() => {
    setLocalRootAlbums(rootAlbums);
    setLocalChildrenMap(childrenMap);
  }, [rootAlbums, childrenMap]);

  // Alle Alben flach – für Suche
  const allAlbumsFlat = useMemo<AlbumWithStats[]>(() => {
    const result: AlbumWithStats[] = [...localRootAlbums];
    for (const children of Object.values(localChildrenMap)) {
      result.push(...children);
    }
    return result;
  }, [localRootAlbums, localChildrenMap]);

  // parentId-Map für schnelles Nachschlagen
  const parentIdMap = useMemo<Map<number, number | null>>(() => {
    const map = new Map<number, number | null>();
    for (const a of localRootAlbums) map.set(a.id, null);
    for (const [pid, children] of Object.entries(localChildrenMap)) {
      for (const c of children) map.set(c.id, Number(pid));
    }
    return map;
  }, [localRootAlbums, localChildrenMap]);

  // IDs, die bei aktiver Suche sichtbar sein sollen (Treffer + alle Vorfahren)
  const visibleIds = useMemo<Set<number> | null>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null; // kein Filter aktiv

    // Direkte Treffer
    const matches = allAlbumsFlat.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.slug.toLowerCase().includes(q) ||
        (a.description ?? "").toLowerCase().includes(q)
    );

    const ids = new Set<number>();
    for (const match of matches) {
      ids.add(match.id);
      // Vorfahren hinzufügen, damit der Baum-Kontext erhalten bleibt
      let pid = parentIdMap.get(match.id) ?? null;
      while (pid !== null) {
        ids.add(pid);
        pid = parentIdMap.get(pid) ?? null;
      }
    }
    return ids;
  }, [searchQuery, allAlbumsFlat, parentIdMap]);

  function toggle(id: number) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Gibt die parentId des Albums zurück (null = Root) */
  function getParentId(albumId: number): number | null {
    if (localRootAlbums.find((a) => a.id === albumId)) return null;
    for (const [parentId, children] of Object.entries(localChildrenMap)) {
      if (children.find((c) => c.id === albumId)) return Number(parentId);
    }
    return null;
  }

  function handleDragStart(albumId: number) {
    setDragId(albumId);
  }

  function handleDragOver(e: React.DragEvent, albumId: number) {
    e.preventDefault();
    if (albumId !== dragId) {
      setDragOverId(albumId);
    }
  }

  function handleDragEnd() {
    setDragId(null);
    setDragOverId(null);
  }

  async function handleDrop(targetId: number) {
    if (dragId === null || dragId === targetId) {
      setDragId(null);
      setDragOverId(null);
      return;
    }

    const dragParent = getParentId(dragId);
    const targetParent = getParentId(targetId);

    // Nur Verschieben innerhalb derselben Ebene erlauben
    if (dragParent !== targetParent) {
      setDragId(null);
      setDragOverId(null);
      return;
    }

    function reorder(list: AlbumWithStats[]): AlbumWithStats[] {
      const fromIdx = list.findIndex((a) => a.id === dragId);
      const toIdx = list.findIndex((a) => a.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return list;
      const newList = [...list];
      const [removed] = newList.splice(fromIdx, 1);
      newList.splice(toIdx, 0, removed);
      return newList;
    }

    let newList: AlbumWithStats[];
    if (dragParent === null) {
      newList = reorder(localRootAlbums);
      setLocalRootAlbums(newList);
    } else {
      newList = reorder(localChildrenMap[dragParent] ?? []);
      setLocalChildrenMap((prev) => ({ ...prev, [dragParent]: newList }));
    }

    setDragId(null);
    setDragOverId(null);

    // Neue Reihenfolge auf dem Server speichern
    setSaving(true);
    try {
      const updates = newList.map((album, index) => ({
        id: album.id,
        sortOrder: index + 1,
      }));
      await updateAlbumSortOrders(updates);
    } finally {
      setSaving(false);
    }
  }

  function renderRows(
    albumList: AlbumWithStats[],
    depth: number
  ): React.ReactNode[] {
    const rows: React.ReactNode[] = [];

    for (const album of albumList) {
      // Bei aktiver Suche: Album überspringen, wenn es nicht in visibleIds ist
      if (visibleIds !== null && !visibleIds.has(album.id)) continue;

      const children = localChildrenMap[album.id] ?? [];
      const hasChildren = children.length > 0;
      // Bei aktiver Suche immer aufklappen
      const isCollapsed = visibleIds !== null ? false : collapsed.has(album.id);
      const isDragging = dragId === album.id;
      const isDragOver = dragOverId === album.id;

      rows.push(
        <tr
          key={album.id}
          draggable={isDragEnabled}
          onDragStart={isDragEnabled ? () => handleDragStart(album.id) : undefined}
          onDragOver={
            isDragEnabled ? (e) => handleDragOver(e, album.id) : undefined
          }
          onDragEnd={isDragEnabled ? handleDragEnd : undefined}
          onDrop={isDragEnabled ? () => handleDrop(album.id) : undefined}
          className={`border-b border-gray-800/50 transition-colors ${
            isDragging ? "opacity-40" : ""
          } ${
            isDragOver
              ? "bg-amber-500/10 outline outline-1 outline-amber-500/50"
              : "hover:bg-gray-800/30"
          }`}
        >
          {/* Drag-Handle */}
          {isDragEnabled && (
            <td className="pl-3 pr-0 py-3 w-6">
              <GripVertical className="w-4 h-4 text-gray-600 cursor-grab active:cursor-grabbing" />
            </td>
          )}

          {/* Name */}
          <td className="px-4 py-3">
            <div
              className="flex items-center gap-1"
              style={{ paddingLeft: depth * 20 }}
            >
              {/* Einklapp-Button */}
              {hasChildren ? (
                <button
                  onClick={() => toggle(album.id)}
                  className="text-gray-400 hover:text-amber-400 transition-colors flex-shrink-0 p-0.5 rounded"
                  title={
                    isCollapsed
                      ? `${children.length} Unteralben einblenden`
                      : "Unteralben ausblenden"
                  }
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              ) : (
                <span className="w-4 flex-shrink-0" />
              )}
              <FolderOpen className="w-4 h-4 text-amber-400 flex-shrink-0 ml-0.5" />
              <span className="text-white font-medium ml-1">{album.name}</span>
              {hasChildren && (
                <span className="text-gray-500 text-xs ml-1.5">
                  ({children.length})
                </span>
              )}
            </div>
            {album.description && (
              <p
                className="text-gray-500 text-xs break-words mt-0.5"
                style={{ paddingLeft: depth * 20 + 36 }}
                dangerouslySetInnerHTML={{ __html: album.description }}
              />
            )}
          </td>

          {/* Slug */}
          <td className="px-4 py-3 hidden md:table-cell">
            <span className="text-gray-400 font-mono text-xs">{album.slug}</span>
          </td>

          {/* Fotos */}
          <td className="px-4 py-3 text-center">
            <span className="text-gray-300">{album.totalPhotoCount}</span>
            {hasChildren && album.totalPhotoCount !== album.photoCount && (
              <span className="block text-gray-600 text-xs">({album.photoCount} direkt)</span>
            )}
          </td>

          {/* Videos */}
          <td className="px-4 py-3 text-center">
            <span className="text-gray-300">{album.totalVideoCount}</span>
            {hasChildren && album.totalVideoCount !== album.videoCount && (
              <span className="block text-gray-600 text-xs">({album.videoCount} direkt)</span>
            )}
          </td>

          {/* Sichtbar für */}
          <td className="px-4 py-3 hidden lg:table-cell">
            <div className="flex flex-wrap gap-1">
              {album.visibleFor.length === 0 ? (
                <span className="text-gray-600 text-xs">Keine</span>
              ) : (
                album.visibleFor.map((g) => (
                  <span
                    key={g}
                    className="bg-gray-800 text-gray-300 text-xs px-1.5 py-0.5 rounded"
                  >
                    {g}
                  </span>
                ))
              )}
            </div>
          </td>

          {/* Status */}
          <td className="px-4 py-3 text-center">
            {album.isActive ? (
              <span className="inline-flex items-center gap-1 text-green-400 text-xs">
                <Eye className="w-3 h-3" />
                Aktiv
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-gray-500 text-xs">
                <EyeOff className="w-3 h-3" />
                Inaktiv
              </span>
            )}
          </td>

          {/* Aktionen */}
          <td className="px-4 py-3">
            <div className="flex items-center justify-end gap-2">
              <Link
                href={`/alben/${album.slug}`}
                className="text-gray-400 hover:text-green-400 transition-colors p-1"
                title={`Album „${album.name}" aufrufen`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
              <Link
                href={`/admin/upload?albumId=${album.id}`}
                className="text-gray-400 hover:text-blue-400 transition-colors p-1"
                title={`Fotos zu „${album.name}" hochladen`}
              >
                <Upload className="w-4 h-4" />
              </Link>
              <Link
                href={`/admin/alben/${album.id}/edit`}
                className="text-gray-400 hover:text-amber-400 transition-colors p-1"
                title="Bearbeiten"
              >
                <Pencil className="w-4 h-4" />
              </Link>
              <DeleteButton albumId={album.id} albumName={album.name} />
            </div>
          </td>
        </tr>
      );

      if (!isCollapsed) {
        rows.push(...renderRows(children, depth + 1));
      }
    }

    return rows;
  }

  const filteredRootAlbums =
    visibleIds !== null
      ? localRootAlbums.filter((a) => visibleIds.has(a.id))
      : localRootAlbums;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Suchleiste */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Alben suchen (Name, Slug, Beschreibung)…"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-8 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              title="Suche löschen"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {visibleIds !== null && (
          <span className="text-gray-500 text-xs whitespace-nowrap">
            {visibleIds.size === 0
              ? "Keine Treffer"
              : `${visibleIds.size} von ${allAlbumsFlat.length} Alben`}
          </span>
        )}
      </div>

      {saving && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-xs flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          Reihenfolge wird gespeichert…
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            {isDragEnabled && <th className="w-6 pl-3" />}
            <th className="text-left px-4 py-3 text-gray-400 font-medium">
              Name
            </th>
            <th className="text-left px-4 py-3 text-gray-400 font-medium hidden md:table-cell">
              Slug
            </th>
            <th className="text-center px-4 py-3 text-gray-400 font-medium">
              Fotos
            </th>
            <th className="text-center px-4 py-3 text-gray-400 font-medium">
              Videos
            </th>
            <th className="text-left px-4 py-3 text-gray-400 font-medium hidden lg:table-cell">
              Sichtbar für
            </th>
            <th className="text-center px-4 py-3 text-gray-400 font-medium">
              Status
            </th>
            <th className="text-right px-4 py-3 text-gray-400 font-medium">
              Aktionen
            </th>
          </tr>
        </thead>
        <tbody>
          {visibleIds !== null && visibleIds.size === 0 ? (
            <tr>
              <td
                colSpan={isDragEnabled ? 9 : 8}
                className="px-4 py-10 text-center text-gray-500 text-sm"
              >
                <Search className="w-6 h-6 mx-auto mb-2 opacity-40" />
                Keine Alben gefunden für „{searchQuery}"
              </td>
            </tr>
          ) : (
            renderRows(filteredRootAlbums, 0)
          )}
        </tbody>
      </table>
      {isDragEnabled && (
        <p className="px-4 py-2 text-gray-600 text-xs border-t border-gray-800/50">
          Zeilen per Drag &amp; Drop verschieben, um die Reihenfolge zu ändern.
          Nur Alben derselben Ebene können verschoben werden.
        </p>
      )}
    </div>
  );
}

function DeleteButton({
  albumId,
  albumName,
}: {
  albumId: number;
  albumName: string;
}) {
  async function handleDelete() {
    if (!confirm(`Album „${albumName}" wirklich löschen?`)) return;
    await deleteAlbum(albumId);
  }

  return (
    <button
      onClick={handleDelete}
      className="text-gray-400 hover:text-red-400 transition-colors p-1"
      title={`Album „${albumName}" löschen`}
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
