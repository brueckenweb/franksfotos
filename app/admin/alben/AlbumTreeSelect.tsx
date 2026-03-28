"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronRight, FolderOpen } from "lucide-react";

export interface AlbumOption {
  id: number;
  name: string;
  parentId: number | null;
}

interface Props {
  albums: AlbumOption[];
  value: string;
  onChange: (value: string) => void;
  /** ID des aktuell bearbeiteten Albums (wird mitsamt Nachfahren ausgeblendet) */
  excludeId?: number;
  /** Beschriftung für die „Keine Auswahl"-Option */
  noSelectionLabel?: string;
}

export default function AlbumTreeSelect({
  albums,
  value,
  onChange,
  excludeId,
  noSelectionLabel = "— Kein übergeordnetes Album (Toplevel) —",
}: Props) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [initialCollapseApplied, setInitialCollapseApplied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Beim ersten Laden: alle Alben mit Unteralben standardmäßig einklappen
  useEffect(() => {
    if (initialCollapseApplied || albums.length === 0) return;
    const parentIds = new Set<number>();
    for (const a of albums) {
      if (a.parentId !== null) {
        parentIds.add(a.parentId);
      }
    }
    setCollapsed(parentIds);
    setInitialCollapseApplied(true);
  }, [albums, initialCollapseApplied]);

  // Dropdown bei Klick außerhalb schließen
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Alle Nachfahren-IDs eines Albums ermitteln (für Edit-Seite)
  function getDescendantIds(id: number): Set<number> {
    const result = new Set<number>([id]);
    albums
      .filter((a) => a.parentId === id)
      .forEach((child) => {
        getDescendantIds(child.id).forEach((d) => result.add(d));
      });
    return result;
  }

  const excludedIds = excludeId ? getDescendantIds(excludeId) : new Set<number>();
  const filtered = albums.filter((a) => !excludedIds.has(a.id));

  // Baum aufbauen
  const rootAlbums = filtered.filter((a) => !a.parentId);
  const childMap = new Map<number, AlbumOption[]>();
  for (const album of filtered) {
    if (album.parentId !== null) {
      if (!childMap.has(album.parentId)) childMap.set(album.parentId, []);
      childMap.get(album.parentId)!.push(album);
    }
  }

  // Angezeigte Beschriftung
  const selectedAlbum = filtered.find((a) => String(a.id) === value);
  function buildLabel(album: AlbumOption): string {
    const ancestors: string[] = [];
    let cur: AlbumOption | undefined = album;
    while (cur?.parentId) {
      const parent = filtered.find((a) => a.id === cur!.parentId);
      if (!parent) break;
      ancestors.unshift(parent.name);
      cur = parent;
    }
    return ancestors.length > 0 ? `${ancestors.join(" › ")} › ${album.name}` : album.name;
  }

  const displayLabel = selectedAlbum ? buildLabel(selectedAlbum) : noSelectionLabel;

  function toggleCollapse(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelect(id: string) {
    onChange(id);
    setOpen(false);
  }

  function renderTree(albumList: AlbumOption[], depth: number): React.ReactNode[] {
    const items: React.ReactNode[] = [];
    // Alphabetisch sortieren
    const sorted = [...albumList].sort((a, b) => a.name.localeCompare(b.name, "de"));

    for (const album of sorted) {
      const children = childMap.get(album.id) ?? [];
      const hasChildren = children.length > 0;
      const isCollapsed = collapsed.has(album.id);
      const isSelected = String(album.id) === value;

      items.push(
        <div key={album.id} className="flex items-center" style={{ paddingLeft: depth * 16 }}>
          {/* Einklapp-Pfeil */}
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => toggleCollapse(album.id, e)}
              className="flex-shrink-0 p-1 text-gray-500 hover:text-amber-400 transition-colors"
              title={isCollapsed ? "Unteralben einblenden" : "Unteralben ausblenden"}
            >
              {isCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <span className="w-6 flex-shrink-0" />
          )}

          {/* Album-Eintrag */}
          <button
            type="button"
            onClick={() => handleSelect(String(album.id))}
            className={`flex-1 flex items-center gap-1.5 text-left px-2 py-1.5 text-sm rounded transition-colors ${
              isSelected
                ? "bg-amber-500/20 text-amber-400 font-medium"
                : "text-gray-300 hover:bg-gray-700"
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-400/70 flex-shrink-0" />
            <span>{album.name}</span>
            {hasChildren && (
              <span className="text-gray-600 text-xs ml-0.5">({children.length})</span>
            )}
          </button>
        </div>
      );

      if (!isCollapsed) {
        items.push(...renderTree(children, depth + 1));
      }
    }
    return items;
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger-Button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full bg-gray-800 border text-left rounded-lg px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors focus:outline-none ${
          open ? "border-amber-500" : "border-gray-700 hover:border-gray-600"
        }`}
      >
        <span className={value ? "text-white truncate" : "text-gray-500"}>
          {displayLabel}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown-Panel */}
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
          {/* "Kein Album"-Option */}
          <button
            type="button"
            onClick={() => handleSelect("")}
            className={`w-full text-left px-3 py-2 text-sm border-b border-gray-700 transition-colors ${
              !value
                ? "bg-amber-500/20 text-amber-400 font-medium"
                : "text-gray-400 hover:bg-gray-700"
            }`}
          >
            {noSelectionLabel}
          </button>

          {/* Baum */}
          <div className="overflow-y-auto max-h-60 py-1">
            {filtered.length === 0 ? (
              <p className="text-gray-500 text-sm px-3 py-2">Keine Alben vorhanden</p>
            ) : (
              renderTree(rootAlbums, 0)
            )}
          </div>
        </div>
      )}
    </div>
  );
}
