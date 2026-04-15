import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { albums, albumVisibility, groups, photos } from "@/lib/db/schema";
import { eq, count, and, inArray } from "drizzle-orm";
import { Camera, FolderOpen, LogIn, ArrowLeft, ChevronRight } from "lucide-react";
import { isAdmin as checkIsAdmin } from "@/lib/auth/permissions";

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

async function getAccessibleAlbums(userGroupSlugs: string[], isAdmin = false) {
  try {
    let albumIds: number[];

    if (isAdmin) {
      // Admin sieht alle aktiven Alben ohne Sichtbarkeits-Filter
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
        createdAt: albums.createdAt,
      })
      .from(albums)
      .where(and(eq(albums.isActive, true), inArray(albums.id, albumIds)))
      .orderBy(albums.sortOrder, albums.name);

    if (allAlbums.length === 0) return [];

    const photoStats = await db
      .select({ albumId: photos.albumId, cnt: count() })
      .from(photos)
      .where(and(eq(photos.isPrivate, false), inArray(photos.albumId, albumIds)))
      .groupBy(photos.albumId);

    const photoMap = new Map(photoStats.map((p) => [p.albumId, p.cnt]));

    const coverPhotoIds = allAlbums
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

    // ── Fallback-Cover: Priorität 2 & 3 ────────────────────────────
    const albumsWithoutCover = allAlbums
      .filter((a) => !a.coverPhotoId)
      .map((a) => a.id);

    const fallbackCoverMap = new Map<number, { thumbnailUrl: string | null; fileUrl: string }>();

    if (albumsWithoutCover.length > 0) {
      // Album-Child-Map für Unteralben-Lookup aufbauen
      const accessibleSet = new Set(albumIds);
      const albumChildMap = new Map<number, number[]>();
      for (const a of allAlbums) {
        if (a.parentId !== null && accessibleSet.has(a.parentId)) {
          if (!albumChildMap.has(a.parentId)) albumChildMap.set(a.parentId, []);
          albumChildMap.get(a.parentId)!.push(a.id);
        }
      }

      // Priorität 2: Zufälliges Foto direkt aus dem Album
      const directPhotos = await db
        .select({
          albumId: photos.albumId,
          thumbnailUrl: photos.thumbnailUrl,
          fileUrl: photos.fileUrl,
        })
        .from(photos)
        .where(and(eq(photos.isPrivate, false), inArray(photos.albumId, albumsWithoutCover)));

      const photosByAlbum = new Map<number, { thumbnailUrl: string | null; fileUrl: string }[]>();
      for (const p of directPhotos) {
        if (p.albumId !== null) {
          if (!photosByAlbum.has(p.albumId)) photosByAlbum.set(p.albumId, []);
          photosByAlbum.get(p.albumId)!.push({ thumbnailUrl: p.thumbnailUrl, fileUrl: p.fileUrl });
        }
      }

      for (const albumId of albumsWithoutCover) {
        const arr = photosByAlbum.get(albumId) ?? [];
        if (arr.length > 0) {
          const picked = arr[Math.floor(Math.random() * arr.length)];
          fallbackCoverMap.set(albumId, { thumbnailUrl: picked.thumbnailUrl, fileUrl: picked.fileUrl });
        }
      }

      // Priorität 3: Zufälliges Foto aus Unteralben
      const needsSubFallback = albumsWithoutCover.filter((id) => !fallbackCoverMap.has(id));

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

          const subPhotosByAlbum = new Map<number, { thumbnailUrl: string | null; fileUrl: string }[]>();
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

    // Child-Map für rekursive Foto-Summe aufbauen
    const albumChildMapForSum = new Map<number, number[]>();
    for (const a of allAlbums) {
      if (a.parentId !== null) {
        if (!albumChildMapForSum.has(a.parentId)) albumChildMapForSum.set(a.parentId, []);
        albumChildMapForSum.get(a.parentId)!.push(a.id);
      }
    }

    function sumPhotosRecursive(albumId: number): number {
      const direct = photoMap.get(albumId) ?? 0;
      const subs = albumChildMapForSum.get(albumId) ?? [];
      return direct + subs.reduce((acc, subId) => acc + sumPhotosRecursive(subId), 0);
    }

    return allAlbums.map((album) => ({
      ...album,
      photoCount: photoMap.get(album.id) ?? 0,
      totalPhotoCount: sumPhotosRecursive(album.id),
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

type Album = Awaited<ReturnType<typeof getAccessibleAlbums>>[number];

function sortChildren(children: Album[], mode: string): Album[] {
  return [...children].sort((a, b) =>
    mode === "alpha"
      ? a.name.localeCompare(b.name, "de")
      : a.sortOrder !== b.sortOrder
      ? a.sortOrder - b.sortOrder
      : a.name.localeCompare(b.name, "de")
  );
}

export default async function AlbenPage() {
  const session = await auth();

  const isMainAdmin = !!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin;
  const userPermissions = (session?.user as { permissions?: string[] })?.permissions ?? [];
  const showAdminLink = checkIsAdmin(userPermissions, isMainAdmin);

  const userGroupSlugs: string[] = [
    "public",
    ...((session?.user as { groups?: string[] })?.groups ?? []),
  ];

  const accessibleAlbums = await getAccessibleAlbums(userGroupSlugs, isMainAdmin);
  const accessibleIds = new Set(accessibleAlbums.map((a) => a.id));

  // Nur Alben ohne Parent (oder mit nicht-zugänglichem Parent) sind Root-Alben
  const rootAlbums = accessibleAlbums.filter(
    (a) => !a.parentId || !accessibleIds.has(a.parentId)
  );

  // childMap aufbauen
  const childMap = new Map<number, Album[]>();
  for (const album of accessibleAlbums) {
    if (album.parentId && accessibleIds.has(album.parentId)) {
      if (!childMap.has(album.parentId)) childMap.set(album.parentId, []);
      childMap.get(album.parentId)!.push(album);
    }
  }

  // Kinder nach childSortMode des Eltern-Albums sortieren
  const albumById = new Map(accessibleAlbums.map((a) => [a.id, a]));
  for (const [parentId, children] of childMap) {
    const parent = albumById.get(parentId);
    childMap.set(parentId, sortChildren(children, parent?.childSortMode ?? "order"));
  }

  // Hat ein Root-Album keine Unteralben → wird es im flachen Raster gezeigt
  const standaloneRoots = rootAlbums.filter((a) => (childMap.get(a.id) ?? []).length === 0);
  const sectionRoots = rootAlbums.filter((a) => (childMap.get(a.id) ?? []).length > 0);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-400 hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-amber-400" />
                <span className="font-semibold text-white">Alle Alben</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {session?.user ? (
                <>
                  {showAdminLink && (
                    <Link href="/admin" className="text-sm text-gray-400 hover:text-white transition-colors">
                      Admin
                    </Link>
                  )}
                  <Link href="/profil" className="text-sm text-gray-400 hover:text-white transition-colors">
                    {session.user.name}
                  </Link>
                </>
              ) : (
                <Link
                  href="/login"
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-amber-400 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  Anmelden
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {accessibleAlbums.length === 0 ? (
          <div className="text-center py-20">
            <FolderOpen className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-500 mb-2">Keine Alben verfügbar</h2>
            <p className="text-gray-600 mb-6">
              {session?.user
                ? "Du hast aktuell keinen Zugriff auf Alben."
                : "Keine öffentlichen Alben vorhanden."}
            </p>
            {!session?.user && (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white rounded-lg px-5 py-2.5 text-sm font-medium transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Anmelden für mehr Alben
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-10">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-white">
                Alben{" "}
                <span className="text-gray-500 font-normal text-xl">
                  ({accessibleAlbums.length})
                </span>
              </h1>
            </div>

            {/* ── Alben-Sektionen (Root-Alben MIT Unteralben) ─────────────── */}
            {sectionRoots.map((album) => {
              const children = childMap.get(album.id) ?? [];
              return (
                <section key={album.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  {/* Sektions-Header: Eltern-Album */}
                  <Link
                    href={`/alben/${album.slug}`}
                    className="group flex items-center gap-4 px-5 py-4 border-b border-gray-800 hover:bg-gray-800/40 transition-colors"
                  >
                    {/* Kleines Cover */}
                    <div className="w-14 h-14 rounded-lg bg-gray-800 overflow-hidden flex-shrink-0">
                    {album.cover?.fileUrl || album.cover?.thumbnailUrl ? (
                        <img
                          src={album.cover.fileUrl ?? album.cover.thumbnailUrl}
                          alt={album.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FolderOpen className="w-6 h-6 text-gray-600 group-hover:text-amber-400 transition-colors" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-semibold text-white group-hover:text-amber-400 transition-colors truncate">
                        {album.name}
                      </h2>
                      {album.description && (
                        <p className="text-sm text-gray-500 truncate mt-0.5">{album.description}</p>
                      )}
                      <p className="text-xs text-gray-600 mt-0.5">
                        {children.length} Unteralbum{children.length !== 1 ? "en" : ""}
                        {album.totalPhotoCount > 0 && ` · ${album.totalPhotoCount} Foto${album.totalPhotoCount !== 1 ? "s" : ""} gesamt`}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-amber-400 transition-colors flex-shrink-0" />
                  </Link>

                  {/* Unteralben */}
                  <div className="p-5">
                    <AlbumGrid albums={children} childMap={childMap} depth={0} />
                  </div>
                </section>
              );
            })}

            {/* ── Standalone-Alben (ohne Unteralben) in einem gemeinsamen Raster ── */}
            {standaloneRoots.length > 0 && (
              <div>
                {sectionRoots.length > 0 && (
                  <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
                    Weitere Alben
                  </h2>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {standaloneRoots.map((album) => (
                    <AlbumCard key={album.id} album={album} size="lg" childCount={0} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Hilfsfunktionen ──────────────────────────────────────────────────── */

function AlbumCard({
  album,
  size,
  childCount,
}: {
  album: Album;
  size: "lg" | "sm";
  childCount: number;
}) {
  const isLg = size === "lg";
  const displayPhotoCount = childCount > 0 ? album.totalPhotoCount : album.photoCount;
  return (
    <Link
      href={`/alben/${album.slug}`}
      className={`group bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-amber-500/50 transition-all ${
        isLg ? "hover:shadow-lg hover:shadow-amber-500/5" : ""
      }`}
    >
      <div className={`${isLg ? "aspect-square" : "aspect-square"} bg-gray-800 overflow-hidden relative`}>
        {album.cover?.fileUrl || album.cover?.thumbnailUrl ? (
          <img
            src={album.cover.fileUrl ?? album.cover.thumbnailUrl}
            alt={album.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FolderOpen
              className={`${isLg ? "w-12 h-12" : "w-8 h-8"} text-gray-600 group-hover:text-amber-400 transition-colors`}
            />
          </div>
        )}
        {/* Foto-Badge: bei Unteralben Gesamtzahl, sonst direkte Anzahl */}
        {displayPhotoCount > 0 && (
          <div className="absolute bottom-1.5 right-1.5 bg-black/70 rounded-full px-2 py-0.5 flex items-center gap-1">
            <Camera className={`${isLg ? "w-3 h-3" : "w-2.5 h-2.5"} text-amber-400`} />
            <span className="text-xs text-white">{displayPhotoCount}</span>
          </div>
        )}
        {childCount > 0 && (
          <div className="absolute top-1.5 left-1.5 bg-black/70 rounded-full px-2 py-0.5 flex items-center gap-1">
            <FolderOpen className={`${isLg ? "w-3 h-3" : "w-2.5 h-2.5"} text-amber-400`} />
            <span className="text-xs text-white">{childCount}</span>
          </div>
        )}
      </div>
      <div className={isLg ? "p-3" : "p-2"}>
        <h3
          className={`font-medium text-white truncate group-hover:text-amber-400 transition-colors ${
            isLg ? "text-sm" : "text-xs"
          }`}
        >
          {album.name}
        </h3>
        {isLg && album.description && (
          <p className="text-xs text-gray-500 truncate mt-0.5">{album.description}</p>
        )}
        <p className={`text-gray-600 mt-0.5 ${isLg ? "text-xs" : "text-xs"}`}>
          {childCount > 0
            ? `${childCount} Unteralbum${childCount !== 1 ? "en" : ""}${album.totalPhotoCount > 0 ? ` · ${album.totalPhotoCount} Foto${album.totalPhotoCount !== 1 ? "s" : ""} gesamt` : ""}`
            : album.photoCount > 0
            ? `${album.photoCount} Foto${album.photoCount !== 1 ? "s" : ""}`
            : "Leer"}
        </p>
      </div>
    </Link>
  );
}

function AlbumGrid({
  albums: list,
  childMap,
  depth,
}: {
  albums: Album[];
  childMap: Map<number, Album[]>;
  depth: number;
}) {
  const cols =
    depth === 0
      ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
      : "grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3";

  return (
    <div className="space-y-5">
      <div className={cols}>
        {list.map((album) => {
          const children = childMap.get(album.id) ?? [];
          return (
            <AlbumCard
              key={album.id}
              album={album}
              size={depth === 0 ? "lg" : "sm"}
              childCount={children.length}
            />
          );
        })}
      </div>

      {/* Tiefere Unteralben */}
      {list.map((album) => {
        const children = childMap.get(album.id) ?? [];
        if (children.length === 0) return null;
        return (
          <div key={`sub-${album.id}`} className="pl-4 border-l-2 border-gray-800">
            <div className="flex items-center gap-2 mb-3">
              <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Unteralben von „{album.name}"
              </span>
            </div>
            <AlbumGrid albums={children} childMap={childMap} depth={depth + 1} />
          </div>
        );
      })}
    </div>
  );
}
