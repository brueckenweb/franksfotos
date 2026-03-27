"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FolderOpen,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { deleteAlbum } from "./actions";

export type AlbumWithStats = {
  id: number;
  parentId: number | null;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  photoCount: number;
  videoCount: number;
  visibleFor: string[];
};

interface Props {
  rootAlbums: AlbumWithStats[];
  childrenMap: Record<number, AlbumWithStats[]>;
}

export default function AlbumTableClient({ rootAlbums, childrenMap }: Props) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  function toggle(id: number) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderRows(albumList: AlbumWithStats[], depth: number): React.ReactNode[] {
    const rows: React.ReactNode[] = [];

    for (const album of albumList) {
      const children = childrenMap[album.id] ?? [];
      const hasChildren = children.length > 0;
      const isCollapsed = collapsed.has(album.id);

      rows.push(
        <tr
          key={album.id}
          className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
        >
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
                className="text-gray-500 text-xs truncate mt-0.5"
                style={{ paddingLeft: depth * 20 + 36 }}
              >
                {album.description}
              </p>
            )}
          </td>

          {/* Slug */}
          <td className="px-4 py-3 hidden md:table-cell">
            <span className="text-gray-400 font-mono text-xs">{album.slug}</span>
          </td>

          {/* Fotos */}
          <td className="px-4 py-3 text-center text-gray-300">{album.photoCount}</td>

          {/* Videos */}
          <td className="px-4 py-3 text-center text-gray-300">{album.videoCount}</td>

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

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left px-4 py-3 text-gray-400 font-medium">Name</th>
            <th className="text-left px-4 py-3 text-gray-400 font-medium hidden md:table-cell">
              Slug
            </th>
            <th className="text-center px-4 py-3 text-gray-400 font-medium">Fotos</th>
            <th className="text-center px-4 py-3 text-gray-400 font-medium">Videos</th>
            <th className="text-left px-4 py-3 text-gray-400 font-medium hidden lg:table-cell">
              Sichtbar für
            </th>
            <th className="text-center px-4 py-3 text-gray-400 font-medium">Status</th>
            <th className="text-right px-4 py-3 text-gray-400 font-medium">Aktionen</th>
          </tr>
        </thead>
        <tbody>{renderRows(rootAlbums, 0)}</tbody>
      </table>
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
