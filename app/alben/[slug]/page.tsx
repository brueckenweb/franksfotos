import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  albums,
  albumVisibility,
  groups,
  photos,
  videos,
  photoGroupVisibility,
  photoUserAccess,
  photoTags,
  tags,
} from "@/lib/db/schema";
import { eq, and, inArray, count, or, asc, desc, type SQL } from "drizzle-orm";
import {
  Camera,
  ArrowLeft,
  FolderOpen,
  Play,
  ChevronRight,
  Upload,
  Pencil,
  Tag,
} from "lucide-react";
import DownloadButton from "./DownloadButton";
import { Suspense } from "react";
import AlbumGpxPanel from "@/components/gpx/AlbumGpxPanel";
import PhotoThumbnail from "./PhotoThumbnail";
import AlbumCoverHero from "./AlbumCoverHero";
import AlbumSlideshow from "./AlbumSlideshow";
import VideoCard from "./VideoCard";

type Props = { params: Promise<{ slug: string }> };

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

// ── Hilfsfunktionen ──────────────────────────────────────────────────

async function getAlbum(slug: string) {
  try {
    const result = await db
      .select()
      .from(albums)
      .where(eq(albums.slug, slug))
      .limit(1);
    return result[0] ?? null;
  } catch {
    return null;
  }
}

async function getAlbumById(id: number) {
  try {
    const result = await db
      .select({ id: albums.id, name: albums.name, slug: albums.slug })
      .from(albums)
      .where(eq(albums.id, id))
      .limit(1);
    return result[0] ?? null;
  } catch {
    return null;
  }
}

async function checkVisibility(albumId: number, userGroups: string[]) {
  try {
    const vis = await db
      .select({ groupSlug: groups.slug })
      .from(albumVisibility)
      .innerJoin(groups, eq(albumVisibility.groupId, groups.id))
      .where(eq(albumVisibility.albumId, albumId));

    const allowedSlugs = vis.map((v) => v.groupSlug);
    if (allowedSlugs.includes("public")) return true;
    return userGroups.some((g) => allowedSlugs.includes(g));
  } catch {
    return false;
  }
}

async function getAccessibleChildAlbums(
  parentId: number,
  userGroupSlugs: string[],
  childSortMode: string,
  isAdmin = false
) {
  try {
    let visibleIds: number[];

    if (isAdmin) {
      // Admin sieht alle aktiven Unteralben
      const allActive = await db
        .select({ id: albums.id })
        .from(albums)
        .where(and(eq(albums.isActive, true), eq(albums.parentId, parentId)));
      visibleIds = allActive.map((a) => a.id);
    } else {
      // Alle zugänglichen Gruppen-IDs ermitteln
      const userGroups = await db
        .select({ id: groups.id })
        .from(groups)
        .where(inArray(groups.slug, userGroupSlugs));

      const groupIds = userGroups.map((g) => g.id);
      if (groupIds.length === 0) return [];

      // Sichtbare Album-IDs
      const visibleEntries = await db
        .selectDistinct({ albumId: albumVisibility.albumId })
        .from(albumVisibility)
        .where(inArray(albumVisibility.groupId, groupIds));

      visibleIds = visibleEntries
        .map((v) => v.albumId)
        .filter((id): id is number => id !== null);
    }

    if (visibleIds.length === 0) return [];

    // Kinder dieses Albums
    const children = await db
      .select({
        id: albums.id,
        name: albums.name,
        slug: albums.slug,
        description: albums.description,
        coverPhotoId: albums.coverPhotoId,
        sortOrder: albums.sortOrder,
        childSortMode: albums.childSortMode,
      })
      .from(albums)
      .where(
        and(
          eq(albums.parentId, parentId),
          eq(albums.isActive, true),
          inArray(albums.id, visibleIds)
        )
      )
      .orderBy(albums.sortOrder, albums.name);

    if (children.length === 0) return [];

    // Foto-Counts
    const childIds = children.map((c) => c.id);
    const photoStats = await db
      .select({ albumId: photos.albumId, cnt: count() })
      .from(photos)
      .where(and(eq(photos.isPrivate, false), inArray(photos.albumId, childIds)))
      .groupBy(photos.albumId);

    const photoMap = new Map(photoStats.map((p) => [p.albumId, p.cnt]));

    // Cover-Fotos (Priorität 1: explizit gesetztes Cover)
    const coverPhotoIds = children
      .map((c) => c.coverPhotoId)
      .filter((id): id is number => id !== null);

    const coverPhotos =
      coverPhotoIds.length > 0
        ? await db
            .select({
              id: photos.id,
              thumbnailUrl: photos.thumbnailUrl,
              fileUrl: photos.fileUrl,
            })
            .from(photos)
            .where(inArray(photos.id, coverPhotoIds))
        : [];

    const coverMap = new Map(coverPhotos.map((p) => [p.id, p]));

    // Alle sichtbaren Alben laden (für Unteralbum-Zählung und Child-Map)
    // Admin: alle aktiven Alben, damit die Child-Map auch tiefe Unteralben abdeckt
    const allVisible = isAdmin
      ? await db
          .select({ id: albums.id, parentId: albums.parentId })
          .from(albums)
          .where(eq(albums.isActive, true))
      : await db
          .select({ id: albums.id, parentId: albums.parentId })
          .from(albums)
          .where(and(eq(albums.isActive, true), inArray(albums.id, visibleIds)));

    // Unteralbum-Anzahl pro Kind + vollständige Child-Map aufbauen
    const childCountMap = new Map<number, number>();
    const albumChildMap = new Map<number, number[]>();
    for (const a of allVisible) {
      if (a.parentId !== null) {
        if (childIds.includes(a.parentId)) {
          childCountMap.set(a.parentId, (childCountMap.get(a.parentId) ?? 0) + 1);
        }
        if (!albumChildMap.has(a.parentId)) albumChildMap.set(a.parentId, []);
        albumChildMap.get(a.parentId)!.push(a.id);
      }
    }

    // Gesamt-Foto-Anzahl (inkl. aller Unteralben) für jedes Kind berechnen
    const allVisibleIds = allVisible.map((a) => a.id);
    const allPhotoStats =
      allVisibleIds.length > 0
        ? await db
            .select({ albumId: photos.albumId, cnt: count() })
            .from(photos)
            .where(and(eq(photos.isPrivate, false), inArray(photos.albumId, allVisibleIds)))
            .groupBy(photos.albumId)
        : [];
    const allPhotoMap = new Map(allPhotoStats.map((p) => [p.albumId, p.cnt]));

    function sumPhotosRecursive(albumId: number): number {
      const direct = allPhotoMap.get(albumId) ?? 0;
      const subs = albumChildMap.get(albumId) ?? [];
      return direct + subs.reduce((acc, subId) => acc + sumPhotosRecursive(subId), 0);
    }

    const totalPhotoCountMap = new Map<number, number>();
    for (const childId of childIds) {
      totalPhotoCountMap.set(childId, sumPhotosRecursive(childId));
    }

    // ── Fallback-Cover: Priorität 2 & 3 ────────────────────────────
    const childrenWithoutCover = children
      .filter((c) => !c.coverPhotoId)
      .map((c) => c.id);

    const fallbackCoverMap = new Map<number, { thumbnailUrl: string | null; fileUrl: string }>();

    if (childrenWithoutCover.length > 0) {
      // Priorität 2: Zufälliges Foto direkt aus dem Unteralbum
      const directPhotos = await db
        .select({
          albumId: photos.albumId,
          thumbnailUrl: photos.thumbnailUrl,
          fileUrl: photos.fileUrl,
        })
        .from(photos)
        .where(
          and(eq(photos.isPrivate, false), inArray(photos.albumId, childrenWithoutCover))
        );

      const photosByAlbum = new Map<number, { thumbnailUrl: string | null; fileUrl: string }[]>();
      for (const p of directPhotos) {
        if (p.albumId !== null) {
          if (!photosByAlbum.has(p.albumId)) photosByAlbum.set(p.albumId, []);
          photosByAlbum
            .get(p.albumId)!
            .push({ thumbnailUrl: p.thumbnailUrl, fileUrl: p.fileUrl });
        }
      }

      for (const albumId of childrenWithoutCover) {
        const arr = photosByAlbum.get(albumId) ?? [];
        if (arr.length > 0) {
          const picked = arr[Math.floor(Math.random() * arr.length)];
          fallbackCoverMap.set(albumId, {
            thumbnailUrl: picked.thumbnailUrl,
            fileUrl: picked.fileUrl,
          });
        }
      }

      // Priorität 3: Zufälliges Foto aus Unteralben des Unteralbums
      const needsSubFallback = childrenWithoutCover.filter((id) => !fallbackCoverMap.has(id));

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

    const result = children.map((album) => ({
      ...album,
      photoCount: photoMap.get(album.id) ?? 0,
      totalPhotoCount: totalPhotoCountMap.get(album.id) ?? 0,
      childCount: childCountMap.get(album.id) ?? 0,
      cover: album.coverPhotoId
        ? (coverMap.get(album.coverPhotoId) ?? null)
        : fallbackCoverMap.has(album.id)
        ? { id: 0, ...fallbackCoverMap.get(album.id)! }
        : null,
    }));

    // Sortieren nach childSortMode des Eltern-Albums
    return result.sort((a, b) =>
      childSortMode === "alpha"
        ? a.name.localeCompare(b.name, "de")
        : childSortMode === "alpha_desc"
        ? b.name.localeCompare(a.name, "de")
        : a.sortOrder !== b.sortOrder
        ? a.sortOrder - b.sortOrder
        : a.name.localeCompare(b.name, "de")
    );
  } catch {
    return [];
  }
}

/** Baut die ORDER-BY-Ausdrücke für Fotos je nach photoSortMode */
function buildPhotoOrder(mode: string): SQL[] {
  switch (mode) {
    case "created_desc":
      return [desc(photos.createdAt)];
    case "title_asc":
      return [asc(photos.title), asc(photos.filename)];
    case "title_desc":
      return [desc(photos.title), asc(photos.filename)];
    case "filename_asc":
      return [asc(photos.filename)];
    case "manual":
      return [asc(photos.sortOrder), asc(photos.createdAt)];
    case "created_asc":
    default:
      return [asc(photos.createdAt)];
  }
}

async function getAlbumPhotos(
  albumId: number,
  isAdmin = false,
  userId: number | null = null,
  userGroupSlugs: string[] = [],
  sortMode = "created_asc"
) {
  const orderBy = buildPhotoOrder(sortMode);

  try {
    if (isAdmin) {
      // Admin sieht alle Fotos (öffentlich + privat)
      return await db
        .select({
          id: photos.id,
          filename: photos.filename,
          title: photos.title,
          fileUrl: photos.fileUrl,
          thumbnailUrl: photos.thumbnailUrl,
          isPrivate: photos.isPrivate,
          width: photos.width,
          height: photos.height,
        })
        .from(photos)
        .where(eq(photos.albumId, albumId))
        .orderBy(...orderBy);
    }

    // Gruppen-IDs des Users ermitteln (inkl. "public")
    let accessiblePrivatePhotoIds: number[] = [];

    if (userGroupSlugs.length > 0) {
      const userGroupRows = await db
        .select({ id: groups.id })
        .from(groups)
        .where(inArray(groups.slug, userGroupSlugs));

      const groupIds = userGroupRows.map((g) => g.id);

      if (groupIds.length > 0) {
        const groupVisRows = await db
          .select({ photoId: photoGroupVisibility.photoId })
          .from(photoGroupVisibility)
          .where(inArray(photoGroupVisibility.groupId, groupIds));
        accessiblePrivatePhotoIds = groupVisRows.map((r) => r.photoId);
      }
    }

    // Individuellen User-Zugriff prüfen
    if (userId) {
      const userAccessRows = await db
        .select({ photoId: photoUserAccess.photoId })
        .from(photoUserAccess)
        .where(eq(photoUserAccess.userId, userId));
      const userAccessIds = userAccessRows.map((r) => r.photoId);
      accessiblePrivatePhotoIds = [...new Set([...accessiblePrivatePhotoIds, ...userAccessIds])];
    }

    // Fotos laden: öffentliche + freigeschaltete private
    const whereCondition =
      accessiblePrivatePhotoIds.length > 0
        ? and(
            eq(photos.albumId, albumId),
            or(eq(photos.isPrivate, false), inArray(photos.id, accessiblePrivatePhotoIds))
          )
        : and(eq(photos.albumId, albumId), eq(photos.isPrivate, false));

    return await db
      .select({
        id: photos.id,
        filename: photos.filename,
        title: photos.title,
        fileUrl: photos.fileUrl,
        thumbnailUrl: photos.thumbnailUrl,
        isPrivate: photos.isPrivate,
        width: photos.width,
        height: photos.height,
      })
      .from(photos)
      .where(whereCondition)
      .orderBy(...orderBy);
  } catch {
    return [];
  }
}

/** Alle Fotos eines Tags laden (für Tag-Alben) */
async function getTagPhotos(
  tagId: number,
  isAdmin = false,
  sortMode = "created_asc"
) {
  const orderBy = buildPhotoOrder(sortMode);
  try {
    // Alle photo-IDs mit diesem Tag holen
    const taggedRows = await db
      .select({ photoId: photoTags.photoId })
      .from(photoTags)
      .where(eq(photoTags.tagId, tagId));

    const taggedIds = taggedRows.map((r) => r.photoId);
    if (taggedIds.length === 0) return [];

    const whereCondition = isAdmin
      ? inArray(photos.id, taggedIds)
      : and(inArray(photos.id, taggedIds), eq(photos.isPrivate, false));

    return await db
      .select({
        id: photos.id,
        filename: photos.filename,
        title: photos.title,
        fileUrl: photos.fileUrl,
        thumbnailUrl: photos.thumbnailUrl,
        isPrivate: photos.isPrivate,
        width: photos.width,
        height: photos.height,
      })
      .from(photos)
      .where(whereCondition)
      .orderBy(...orderBy);
  } catch {
    return [];
  }
}

/** Tag-Name für Anzeige laden */
async function getTagName(tagId: number): Promise<string | null> {
  try {
    const result = await db
      .select({ name: tags.name })
      .from(tags)
      .where(eq(tags.id, tagId))
      .limit(1);
    return result[0]?.name ?? null;
  } catch {
    return null;
  }
}

async function getCoverPhoto(coverPhotoId: number) {
  try {
    const result = await db
      .select({ id: photos.id, thumbnailUrl: photos.thumbnailUrl, fileUrl: photos.fileUrl })
      .from(photos)
      .where(eq(photos.id, coverPhotoId))
      .limit(1);
    return result[0] ?? null;
  } catch {
    return null;
  }
}

async function getAlbumVideos(albumId: number) {
  try {
    return await db
      .select({
        id: videos.id,
        filename: videos.filename,
        title: videos.title,
        description: videos.description,
        fileUrl: videos.fileUrl,
        thumbnailUrl: videos.thumbnailUrl,
        duration: videos.duration,
        mimeType: videos.mimeType,
        width: videos.width,
        height: videos.height,
        isPrivate: videos.isPrivate,
      })
      .from(videos)
      .where(and(eq(videos.albumId, albumId), eq(videos.isPrivate, false)))
      .orderBy(videos.sortOrder, videos.createdAt);
  } catch {
    return [];
  }
}

// ── Page ─────────────────────────────────────────────────────────────

export default async function AlbumPage({ params }: Props) {
  const { slug } = await params;
  const session = await auth();

  const album = await getAlbum(slug);
  if (!album || !album.isActive) notFound();

  const isAdmin = !!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin;

  // Sichtbarkeits-Check
  const userGroupSlugs: string[] = [
    "public",
    ...((session?.user as { groups?: string[] })?.groups ?? []),
  ];
  // Admin darf immer alle Alben sehen
  const canView = isAdmin || await checkVisibility(album.id, userGroupSlugs);

  if (!canView) {
    if (!session?.user) redirect("/login");
    notFound();
  }

  const userId = session?.user
    ? parseInt((session.user as { id: string }).id)
    : null;

  // Eltern-Album für Breadcrumb
  const parentAlbum = album.parentId ? await getAlbumById(album.parentId) : null;

  const isTagAlbum = album.sourceType === "tag" && !!album.tagId;

  // Unteralben + Medien + Cover + ggf. Tag-Name parallel laden
  const [childAlbums, albumPhotos, albumVideos, coverPhoto, tagName] = await Promise.all([
    getAccessibleChildAlbums(album.id, userGroupSlugs, album.childSortMode ?? "order", isAdmin),
    isTagAlbum
      ? getTagPhotos(album.tagId!, isAdmin, album.photoSortMode ?? "created_asc")
      : getAlbumPhotos(album.id, isAdmin, userId, userGroupSlugs, album.photoSortMode ?? "created_asc"),
    getAlbumVideos(album.id),
    album.coverPhotoId ? getCoverPhoto(album.coverPhotoId) : Promise.resolve(null),
    isTagAlbum ? getTagName(album.tagId!) : Promise.resolve(null),
  ]);

  // Fallback: wenn kein Cover manuell gesetzt, erstes Foto des Albums als Hero verwenden
  const effectiveCoverPhoto = coverPhoto ?? (albumPhotos.length > 0
    ? { id: albumPhotos[0].id, thumbnailUrl: albumPhotos[0].thumbnailUrl, fileUrl: albumPhotos[0].fileUrl }
    : null);

  const totalMedia = albumPhotos.length + albumVideos.length;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header / Breadcrumb */}
      <header className="border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-14 gap-2 text-sm overflow-x-auto whitespace-nowrap">
            {/* Zurück-Pfeil */}
            <Link
              href={parentAlbum ? `/alben/${parentAlbum.slug}` : "/"}
              className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            {/* Breadcrumb */}
            <Link href="/" className="text-gray-500 hover:text-gray-300 transition-colors">
              Startseite
            </Link>

            {parentAlbum && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-gray-700 flex-shrink-0" />
                <Link
                  href={`/alben/${parentAlbum.slug}`}
                  className="text-gray-500 hover:text-gray-300 transition-colors truncate max-w-[120px]"
                >
                  {parentAlbum.name}
                </Link>
              </>
            )}

            <ChevronRight className="w-3.5 h-3.5 text-gray-700 flex-shrink-0" />
            <span className="font-medium text-white truncate">{album.name}</span>

            {totalMedia > 0 && (
              <span className="text-gray-600 ml-1 flex-shrink-0">
                • {totalMedia} Medien
              </span>
            )}

            {/* Admin-Buttons */}
            {isAdmin && (
              <div className="ml-auto flex items-center gap-2 flex-shrink-0 pl-4">
                <Link
                  href={`/admin/upload?albumId=${album.id}`}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  title="Fotos zu diesem Album hochladen"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Fotos hinzufügen
                </Link>
                <Link
                  href={`/admin/alben/${album.id}/edit`}
                  className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  title="Album bearbeiten"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Album bearbeiten
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── Album-Cover Hero ─────────────────────────────────────── */}
        {effectiveCoverPhoto && (
          <AlbumCoverHero
            fileUrl={effectiveCoverPhoto.fileUrl}
            thumbnailUrl={effectiveCoverPhoto.thumbnailUrl}
            alt={album.name}
          />
        )}

        {/* Tag-Badge (bei Tag-Alben) */}
        {isTagAlbum && tagName && (
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium px-3 py-1.5 rounded-full">
              <Tag className="w-3 h-3" />
              Tag: {tagName}
            </span>
            <span className="text-gray-600 text-xs">
              {albumPhotos.length} Foto{albumPhotos.length !== 1 ? "s" : ""} mit diesem Tag
            </span>
          </div>
        )}

        {/* Album-Beschreibung */}
        {album.description && (
          <p className="text-gray-400 mb-8" dangerouslySetInnerHTML={{ __html: album.description }} />
        )}

        {/* ── Unteralben-Grid ─────────────────────────────────────── */}
        {childAlbums.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-amber-400" />
              {album.name}
              <span className="text-gray-500 font-normal text-sm">({childAlbums.length})</span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {childAlbums.map((child) => (
                <Link
                  key={child.id}
                  href={`/alben/${child.slug}`}
                  className="group bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/5 transition-all"
                >
                  <div className="aspect-square bg-gray-800 overflow-hidden relative">
                    {child.cover?.fileUrl || child.cover?.thumbnailUrl ? (
                      <img
                        src={child.cover.fileUrl ?? child.cover.thumbnailUrl}
                        alt={child.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FolderOpen className="w-10 h-10 text-gray-600 group-hover:text-amber-400 transition-colors" />
                      </div>
                    )}

                    {/* Foto-Badge: bei Unteralben Gesamtzahl, sonst direkte Anzahl */}
                    {(child.childCount > 0 ? child.totalPhotoCount : child.photoCount) > 0 && (
                      <div className="absolute bottom-1.5 right-1.5 bg-black/70 rounded-full px-2 py-0.5 flex items-center gap-1">
                        <Camera className="w-3 h-3 text-amber-400" />
                        <span className="text-xs text-white">
                          {child.childCount > 0 ? child.totalPhotoCount : child.photoCount}
                        </span>
                      </div>
                    )}

                    {/* Unteralbum-Badge */}
                    {child.childCount > 0 && (
                      <div className="absolute top-1.5 left-1.5 bg-black/70 rounded-full px-2 py-0.5 flex items-center gap-1">
                        <FolderOpen className="w-3 h-3 text-amber-400" />
                        <span className="text-xs text-white">{child.childCount}</span>
                      </div>
                    )}
                  </div>

                  <div className="p-3">
                    <h3 className="text-sm font-medium text-white truncate group-hover:text-amber-400 transition-colors">
                      {child.name}
                    </h3>
                    {child.description && (
                      <div className="text-xs text-gray-500 truncate mt-0.5" dangerouslySetInnerHTML={{ __html: child.description }} />
                    )}
                    <p className="text-xs text-gray-600 mt-0.5">
                      {child.childCount > 0
                        ? `${child.childCount} Unteralbum${child.childCount !== 1 ? "en" : ""}${child.totalPhotoCount > 0 ? ` · ${child.totalPhotoCount} Foto${child.totalPhotoCount !== 1 ? "s" : ""} gesamt` : ""}`
                        : child.photoCount > 0
                        ? `${child.photoCount} Foto${child.photoCount !== 1 ? "s" : ""}`
                        : "Leer"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Kein Inhalt ──────────────────────────────────────────── */}
        {childAlbums.length === 0 && totalMedia === 0 && (
          <div className="text-center py-16">
            <Camera className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">Dieses Album ist noch leer.</p>
          </div>
        )}

        {/* ── Videos ───────────────────────────────────────────────── */}
        {albumVideos.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Play className="w-4 h-4 text-blue-400" />
              Videos
              <span className="text-gray-500 font-normal text-sm">({albumVideos.length})</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {albumVideos.map((video) => (
                <VideoCard
                  key={video.id}
                  filename={video.filename}
                  title={video.title ?? null}
                  description={video.description ?? null}
                  fileUrl={video.fileUrl}
                  thumbnailUrl={video.thumbnailUrl ?? null}
                  duration={video.duration ?? null}
                  mimeType={video.mimeType ?? null}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Fotos ────────────────────────────────────────────────── */}
        {albumPhotos.length > 0 && (
          <section>
            {(albumVideos.length > 0 || childAlbums.length > 0) && (
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Camera className="w-4 h-4 text-amber-400" />
                Fotos
                <span className="text-gray-500 font-normal text-sm">({albumPhotos.length})</span>
              </h2>
            )}

            {/* ── Diashow (nur bei > 3 Fotos) ──────────────────────── */}
            <AlbumSlideshow photos={albumPhotos} intervalSeconds={5} />

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
              {albumPhotos.map((photo) => (
                <Link
                  key={photo.id}
                  href={isTagAlbum ? `/foto/${photo.id}?from=${album.slug}` : `/foto/${photo.id}`}
                  className="group relative bg-gray-900 border border-gray-800 rounded-lg overflow-hidden hover:border-amber-500/50 transition-colors"
                >
                  <div className="aspect-square bg-gray-800 overflow-hidden">
                    <PhotoThumbnail
                      thumbnailUrl={photo.thumbnailUrl ?? null}
                      fileUrl={photo.fileUrl}
                      alt={photo.title || photo.filename}
                    />
                  </div>

                  {/* Download-Button (nur für eingeloggte User) */}
                  {session?.user && (
                    <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DownloadButton photoId={photo.id} />
                    </div>
                  )}

                  {photo.title && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-white text-xs truncate">{photo.title}</p>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── GPX-Tracks (nur für eingeloggte User, unter den Fotos) ── */}
        {session?.user && (
          <Suspense fallback={null}>
            <AlbumGpxPanel albumId={album.id} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
