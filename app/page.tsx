// Erzwingt dynamisches Server-Rendering – verhindert Build-Fehler durch auth() / headers()
export const dynamic = 'force-dynamic';

import Link from "next/link";
import { db } from "@/lib/db";
import { albums, albumVisibility, groups, photos, videos } from "@/lib/db/schema";
import { eq, count, and, inArray } from "drizzle-orm";
import { Camera, Film, FolderOpen } from "lucide-react";
import { auth } from "@/auth";
import GuestbookPanel from "@/components/GuestbookPanel";
import WorldMapPanel from "@/components/reisen/WorldMapPanel";

/** Gibt alle Nachkommen-IDs eines Albums zurück (BFS) */
function getDescendantIds(albumId: number, childMap: Map<number, number[]>): number[] {
  const result: number[] = [];
  const queue = [...(childMap.get(albumId) ?? [])];
  while (queue.length > 0) {
    const id = queue.shift()!;
    result.push(id);
    queue.push(...(childMap.get(id) ?? []));
  }
  return result;
}

async function getPublicStats() {
  try {
    const [photoCount] = await db.select({ count: count() }).from(photos).where(eq(photos.isPrivate, false));
    const [videoCount] = await db.select({ count: count() }).from(videos).where(eq(videos.isPrivate, false));
    const [albumCount] = await db.select({ count: count() }).from(albums).where(eq(albums.isActive, true));
    return {
      photos: photoCount.count,
      videos: videoCount.count,
      albums: albumCount.count,
    };
  } catch {
    return { photos: 0, videos: 0, albums: 0 };
  }
}

async function getRootPublicAlbums(userGroupSlugs: string[] = ["public"], isAdmin = false) {
  try {
    let albumIds: number[];

    if (isAdmin) {
      const allActive = await db
        .select({ id: albums.id })
        .from(albums)
        .where(eq(albums.isActive, true));
      albumIds = allActive.map((a) => a.id);
    } else {
      const userGroups = await db
        .select({ id: groups.id })
        .from(groups)
        .where(inArray(groups.slug, userGroupSlugs));

      const groupIds = userGroups.map((g) => g.id);
      if (groupIds.length === 0) return [];

      const visibleEntries = await db
        .selectDistinct({ albumId: albumVisibility.albumId })
        .from(albumVisibility)
        .where(inArray(albumVisibility.groupId, groupIds));

      albumIds = visibleEntries
        .map((v) => v.albumId)
        .filter((id): id is number => id !== null);
    }

    if (albumIds.length === 0) return [];

    const allAlbums = await db
      .select({
        id: albums.id,
        parentId: albums.parentId,
        name: albums.name,
        slug: albums.slug,
        description: albums.description,
        coverPhotoId: albums.coverPhotoId,
        sortOrder: albums.sortOrder,
        childSortMode: albums.childSortMode,
      })
      .from(albums)
      .where(and(eq(albums.isActive, true), inArray(albums.id, albumIds)))
      .orderBy(albums.sortOrder, albums.name);

    if (allAlbums.length === 0) return [];

    const accessibleIds = new Set(allAlbums.map((a) => a.id));

    const rootAlbums = allAlbums.filter(
      (a) => !a.parentId || !accessibleIds.has(a.parentId)
    );

    const photoStats = await db
      .select({ albumId: photos.albumId, cnt: count() })
      .from(photos)
      .where(and(eq(photos.isPrivate, false), inArray(photos.albumId, albumIds)))
      .groupBy(photos.albumId);

    const photoMap = new Map(photoStats.map((p) => [p.albumId, p.cnt]));

    const childCountMap = new Map<number, number>();
    const albumChildMap = new Map<number, number[]>();
    for (const a of allAlbums) {
      if (a.parentId && accessibleIds.has(a.parentId)) {
        childCountMap.set(a.parentId, (childCountMap.get(a.parentId) ?? 0) + 1);
        if (!albumChildMap.has(a.parentId)) albumChildMap.set(a.parentId, []);
        albumChildMap.get(a.parentId)!.push(a.id);
      }
    }

    const coverPhotoIds = rootAlbums
      .map((a) => a.coverPhotoId)
      .filter((id): id is number => id !== null);

    const coverPhotos =
      coverPhotoIds.length > 0
        ? await db
            .select({ id: photos.id, thumbnailUrl: photos.thumbnailUrl, fileUrl: photos.fileUrl })
            .from(photos)
            .where(inArray(photos.id, coverPhotoIds))
        : [];

    const coverMap = new Map(coverPhotos.map((p) => [p.id, p]));

    const rootsWithoutCover = rootAlbums
      .filter((a) => !a.coverPhotoId)
      .map((a) => a.id);

    const fallbackCoverMap = new Map<number, { thumbnailUrl: string | null; fileUrl: string }>();

    if (rootsWithoutCover.length > 0) {
      const directPhotos = await db
        .select({
          albumId: photos.albumId,
          thumbnailUrl: photos.thumbnailUrl,
          fileUrl: photos.fileUrl,
        })
        .from(photos)
        .where(and(eq(photos.isPrivate, false), inArray(photos.albumId, rootsWithoutCover)));

      const photosByAlbum = new Map<number, { thumbnailUrl: string | null; fileUrl: string }[]>();
      for (const p of directPhotos) {
        if (p.albumId !== null) {
          if (!photosByAlbum.has(p.albumId)) photosByAlbum.set(p.albumId, []);
          photosByAlbum.get(p.albumId)!.push({ thumbnailUrl: p.thumbnailUrl, fileUrl: p.fileUrl });
        }
      }

      for (const albumId of rootsWithoutCover) {
        const arr = photosByAlbum.get(albumId) ?? [];
        if (arr.length > 0) {
          const picked = arr[Math.floor(Math.random() * arr.length)];
          fallbackCoverMap.set(albumId, { thumbnailUrl: picked.thumbnailUrl, fileUrl: picked.fileUrl });
        }
      }

      const needsSubFallback = rootsWithoutCover.filter((id) => !fallbackCoverMap.has(id));

      if (needsSubFallback.length > 0) {
        const descendantAlbumIds = new Set<number>();
        const albumToDescendants = new Map<number, number[]>();

        for (const albumId of needsSubFallback) {
          const descendants = getDescendantIds(albumId, albumChildMap);
          albumToDescendants.set(albumId, descendants);
          descendants.forEach((id) => descendantAlbumIds.add(id));
        }

        if (descendantAlbumIds.size > 0) {
          const subPhotos = await db
            .select({
              albumId: photos.albumId,
              thumbnailUrl: photos.thumbnailUrl,
              fileUrl: photos.fileUrl,
            })
            .from(photos)
            .where(
              and(
                eq(photos.isPrivate, false),
                inArray(photos.albumId, Array.from(descendantAlbumIds))
              )
            );

          const subPhotosByAlbum = new Map<
            number,
            { thumbnailUrl: string | null; fileUrl: string }[]
          >();
          for (const p of subPhotos) {
            if (p.albumId !== null) {
              if (!subPhotosByAlbum.has(p.albumId)) subPhotosByAlbum.set(p.albumId, []);
              subPhotosByAlbum
                .get(p.albumId)!
                .push({ thumbnailUrl: p.thumbnailUrl, fileUrl: p.fileUrl });
            }
          }

          for (const albumId of needsSubFallback) {
            const descendants = albumToDescendants.get(albumId) ?? [];
            const allDescPhotos: { thumbnailUrl: string | null; fileUrl: string }[] = [];
            for (const descId of descendants) {
              allDescPhotos.push(...(subPhotosByAlbum.get(descId) ?? []));
            }
            if (allDescPhotos.length > 0) {
              const picked = allDescPhotos[Math.floor(Math.random() * allDescPhotos.length)];
              fallbackCoverMap.set(albumId, {
                thumbnailUrl: picked.thumbnailUrl,
                fileUrl: picked.fileUrl,
              });
            }
          }
        }
      }
    }

    return rootAlbums.map((album) => ({
      ...album,
      photoCount: photoMap.get(album.id) ?? 0,
      childCount: childCountMap.get(album.id) ?? 0,
      cover: album.coverPhotoId
        ? (coverMap.get(album.coverPhotoId) ?? null)
        : fallbackCoverMap.has(album.id)
        ? { id: 0, ...fallbackCoverMap.get(album.id)! }
        : null,
    }));
  } catch {
    return [];
  }
}

export default async function HomePage() {
  let session = null;
  try {
    session = await auth();
  } catch (e) {
    console.error("Auth-Fehler auf Startseite:", e);
  }

  const isMainAdmin = !!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin;
  const userGroupSlugs: string[] = [
    "public",
    ...((session?.user as { groups?: string[] })?.groups ?? []),
  ];

  const [rootAlbums, stats] = await Promise.all([
    getRootPublicAlbums(userGroupSlugs, isMainAdmin),
    getPublicStats(),
  ]);

  const currentUserName = session?.user?.name ?? null;

  const statCards = [
    { label: "Fotos",  value: stats.photos, icon: Camera,     color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "Videos", value: stats.videos, icon: Film,        color: "text-blue-400",  bg: "bg-blue-500/10"  },
    { label: "Alben",  value: stats.albums, icon: FolderOpen,  color: "text-green-400", bg: "bg-green-500/10" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Hero */}
      <section className="py-16 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
            <Camera className="w-10 h-10 text-amber-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">FranksFotos</h1>
          <p className="text-xl text-gray-400">Unsere Reisen mit der Kamera – durch meine Linse – Erinnerungen an Orte und Erlebnisse</p>
        </div>
      </section>

      {/* Alben */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {rootAlbums.length === 0 ? (
          <div className="text-center py-16">
            <FolderOpen className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-500 mb-2">Noch keine öffentlichen Alben</h2>
            <p className="text-gray-600">
              {session?.user
                ? "Lege Alben im Admin-Bereich an und setze die Sichtbarkeit auf 'Öffentlich'."
                : "Noch keine Fotos veröffentlicht."}
            </p>
            {session?.user && (
              <Link
                href="/admin/alben/neu"
                className="mt-4 inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
                Album erstellen
              </Link>
            )}
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-white mb-6">
              Alben{" "}
              <span className="text-gray-500 font-normal text-xl">({rootAlbums.length})</span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {rootAlbums.map((album) => (
                <Link
                  key={album.id}
                  href={`/alben/${album.slug}`}
                  className="group bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/5 transition-all"
                >
                  {/* Cover */}
                  <div className="aspect-square bg-gray-800 overflow-hidden relative">
                    {album.cover?.fileUrl || album.cover?.thumbnailUrl ? (
                      <img
                        src={album.cover.fileUrl ?? album.cover.thumbnailUrl}
                        alt={album.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FolderOpen className="w-12 h-12 text-gray-600 group-hover:text-amber-400 transition-colors" />
                      </div>
                    )}

                    {album.photoCount > 0 && (
                      <div className="absolute bottom-1.5 right-1.5 bg-black/70 rounded-full px-2 py-0.5 flex items-center gap-1">
                        <Camera className="w-3 h-3 text-amber-400" />
                        <span className="text-xs text-white">{album.photoCount}</span>
                      </div>
                    )}

                    {album.childCount > 0 && (
                      <div className="absolute top-1.5 left-1.5 bg-black/70 rounded-full px-2 py-0.5 flex items-center gap-1">
                        <FolderOpen className="w-3 h-3 text-amber-400" />
                        <span className="text-xs text-white">{album.childCount}</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-white truncate group-hover:text-amber-400 transition-colors">
                      {album.name}
                    </h3>
                    {album.description && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{album.description}</p>
                    )}
                    <p className="text-xs text-gray-600 mt-0.5">
                      {album.childCount > 0
                        ? `${album.childCount} Unteralbum${album.childCount !== 1 ? "en" : ""}${album.photoCount > 0 ? ` · ${album.photoCount} Foto${album.photoCount !== 1 ? "s" : ""}` : ""}`
                        : album.photoCount > 0
                        ? `${album.photoCount} Foto${album.photoCount !== 1 ? "s" : ""}`
                        : "Leer"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ── Statistik-Panel ─────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`${card.bg} rounded-lg p-2`}>
                    <Icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                  <span className="text-gray-400 text-sm">{card.label}</span>
                </div>
                <div className={`text-3xl font-bold ${card.color}`}>
                  {card.value.toLocaleString("de-DE")}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Gästebuch (nur für eingeloggte User sichtbar) ───────────── */}
      {currentUserName && (
        <GuestbookPanel currentUserName={currentUserName} />
      )}

      {/* ── Bereiste Länder / Weltreise (für alle Besucher sichtbar) ─── */}
      <WorldMapPanel isOwner={session?.user?.id === "1"} />
    </div>
  );
}
