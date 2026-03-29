import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { albums, albumVisibility, groups, photos, videos } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { FolderOpen, Plus } from "lucide-react";
import AlbumTableClient, { AlbumWithStats } from "./AlbumTableClient";

async function getAlbumsWithStats() {
  try {
    const allAlbums = await db
      .select({
        id: albums.id,
        parentId: albums.parentId,
        name: albums.name,
        slug: albums.slug,
        description: albums.description,
        sortOrder: albums.sortOrder,
        childSortMode: albums.childSortMode,
        isActive: albums.isActive,
        createdAt: albums.createdAt,
      })
      .from(albums)
      .orderBy(albums.sortOrder, albums.name);

    const photoStats = await db
      .select({ albumId: photos.albumId, cnt: count() })
      .from(photos)
      .groupBy(photos.albumId);

    const videoStats = await db
      .select({ albumId: videos.albumId, cnt: count() })
      .from(videos)
      .groupBy(videos.albumId);

    const visibilityData = await db
      .select({
        albumId: albumVisibility.albumId,
        groupName: groups.name,
        groupSlug: groups.slug,
      })
      .from(albumVisibility)
      .innerJoin(groups, eq(albumVisibility.groupId, groups.id));

    const photoMap = new Map(photoStats.map((p) => [p.albumId, Number(p.cnt)]));
    const videoMap = new Map(videoStats.map((v) => [v.albumId, Number(v.cnt)]));
    const visibilityMap = new Map<number, string[]>();
    for (const v of visibilityData) {
      if (v.albumId) {
        if (!visibilityMap.has(v.albumId)) visibilityMap.set(v.albumId, []);
        visibilityMap.get(v.albumId)!.push(v.groupName);
      }
    }

    return allAlbums.map((album) => ({
      ...album,
      photoCount: photoMap.get(album.id) ?? 0,
      videoCount: videoMap.get(album.id) ?? 0,
      visibleFor: visibilityMap.get(album.id) ?? [],
    }));
  } catch {
    return [];
  }
}

export default async function AdminAlbenPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { sort } = await searchParams;
  const isAlpha = sort === "alpha";

  const allAlbums = await getAlbumsWithStats();

  function sortAlbumList<T extends { name: string; sortOrder: number }>(
    arr: T[],
    alpha: boolean
  ): T[] {
    return [...arr].sort((a, b) =>
      alpha
        ? a.name.localeCompare(b.name, "de")
        : a.sortOrder !== b.sortOrder
        ? a.sortOrder - b.sortOrder
        : a.name.localeCompare(b.name, "de")
    );
  }

  // Top-Level-Alben
  const rootAlbums: AlbumWithStats[] = sortAlbumList(
    allAlbums.filter((a) => !a.parentId),
    isAlpha
  );

  // childMap aufbauen und sortieren
  const albumById = new Map(allAlbums.map((a) => [a.id, a]));
  const childMapRaw = new Map<number, typeof allAlbums>();
  for (const album of allAlbums) {
    if (album.parentId) {
      if (!childMapRaw.has(album.parentId)) childMapRaw.set(album.parentId, []);
      childMapRaw.get(album.parentId)!.push(album);
    }
  }
  for (const [parentId, children] of childMapRaw) {
    const parent = albumById.get(parentId);
    const useAlpha = parent?.childSortMode === "alpha";
    childMapRaw.set(parentId, sortAlbumList(children, useAlpha));
  }

  // Map → plain object (serialisierbar für Client-Komponente)
  const childrenMap: Record<number, AlbumWithStats[]> = {};
  for (const [key, value] of childMapRaw) {
    childrenMap[key] = value;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Alben</h1>
          <p className="text-gray-400 text-sm mt-0.5">{allAlbums.length} Alben gesamt</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Sortier-Umschalter */}
          <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg overflow-hidden text-xs">
            <Link
              href="/admin/alben"
              className={`px-3 py-2 transition-colors ${
                !isAlpha
                  ? "bg-amber-500 text-white font-medium"
                  : "text-gray-400 hover:text-white"
              }`}
              title="Nach Sortierreihenfolge"
            >
              # Reihenfolge
            </Link>
            <Link
              href="/admin/alben?sort=alpha"
              className={`px-3 py-2 transition-colors ${
                isAlpha
                  ? "bg-amber-500 text-white font-medium"
                  : "text-gray-400 hover:text-white"
              }`}
              title="Alphabetisch sortieren"
            >
              A–Z
            </Link>
          </div>
          <Link
            href="/admin/alben/neu"
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Neues Album
          </Link>
        </div>
      </div>

      {allAlbums.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-xl">
          <FolderOpen className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Noch keine Alben vorhanden.</p>
          <Link
            href="/admin/alben/neu"
            className="mt-4 inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 text-sm"
          >
            <Plus className="w-4 h-4" />
            Erstes Album anlegen
          </Link>
        </div>
      ) : (
        <AlbumTableClient
          rootAlbums={rootAlbums}
          childrenMap={childrenMap}
          isDragEnabled={!isAlpha}
        />
      )}
    </div>
  );
}
