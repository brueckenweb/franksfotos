/**
 * FranksFotos – Unteralbum-Diashow Daten
 * GET /api/albums/[id]/subalbum-slideshow
 *
 * Liefert alle Daten für die Gesamtdiashow:
 * - Album-Info + Cover
 * - Alle Unteralben (sortiert) mit Cover, Fotos, Videos
 * - Musik-Playlist
 *
 * Berücksichtigt die Sichtbarkeit des eingeloggten Users.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  albums,
  albumVisibility,
  albumSlideshowMusic,
  groups,
  photos,
  videos,
  photoGroupVisibility,
  photoUserAccess,
} from "@/lib/db/schema";
import { eq, and, inArray, asc, or } from "drizzle-orm";

type Props = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const albumId = parseInt(id);
    if (isNaN(albumId)) {
      return NextResponse.json({ error: "Ungültige Album-ID" }, { status: 400 });
    }

    const session = await auth();
    const isAdmin = !!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin;
    const userId = session?.user
      ? parseInt((session.user as { id: string }).id)
      : null;
    const userGroupSlugs: string[] = [
      "public",
      ...((session?.user as { groups?: string[] })?.groups ?? []),
    ];

    // ── Haupt-Album laden ────────────────────────────────────────────
    const albumResult = await db
      .select({
        id: albums.id,
        name: albums.name,
        slug: albums.slug,
        coverPhotoId: albums.coverPhotoId,
        sortOrder: albums.sortOrder,
        childSortMode: albums.childSortMode,
        photoSortMode: albums.photoSortMode,
        subalbumSlideshowEnabled: albums.subalbumSlideshowEnabled,
        isActive: albums.isActive,
      })
      .from(albums)
      .where(eq(albums.id, albumId))
      .limit(1);

    const album = albumResult[0];
    if (!album || !album.isActive) {
      return NextResponse.json({ error: "Album nicht gefunden" }, { status: 404 });
    }

    // Admins dürfen immer auf die Daten zugreifen (z.B. für Vorschau in der Verwaltung)
    if (!isAdmin && !album.subalbumSlideshowEnabled) {
      return NextResponse.json({ error: "Diashow nicht aktiviert" }, { status: 403 });
    }

    // ── Cover-Foto des Haupt-Albums ─────────────────────────────────
    let albumCoverPhoto: { fileUrl: string; thumbnailUrl: string | null } | null = null;
    if (album.coverPhotoId) {
      const coverResult = await db
        .select({ fileUrl: photos.fileUrl, thumbnailUrl: photos.thumbnailUrl })
        .from(photos)
        .where(eq(photos.id, album.coverPhotoId))
        .limit(1);
      albumCoverPhoto = coverResult[0] ?? null;
    }

    // ── Zugängliche Unteralben ermitteln ────────────────────────────
    let visibleChildIds: number[];

    if (isAdmin) {
      const allActive = await db
        .select({ id: albums.id })
        .from(albums)
        .where(and(eq(albums.isActive, true), eq(albums.parentId, albumId)));
      visibleChildIds = allActive.map((a) => a.id);
    } else {
      const userGroups = await db
        .select({ id: groups.id })
        .from(groups)
        .where(inArray(groups.slug, userGroupSlugs));
      const groupIds = userGroups.map((g) => g.id);

      if (groupIds.length === 0) {
        visibleChildIds = [];
      } else {
        const visibleEntries = await db
          .selectDistinct({ albumId: albumVisibility.albumId })
          .from(albumVisibility)
          .where(inArray(albumVisibility.groupId, groupIds));
        visibleChildIds = visibleEntries
          .map((v) => v.albumId)
          .filter((id): id is number => id !== null);
      }
    }

    // ── Kinder dieses Albums ────────────────────────────────────────
    let childAlbums: Array<{
      id: number;
      name: string;
      slug: string;
      coverPhotoId: number | null;
      sortOrder: number;
      childSortMode: string;
      photoSortMode: string;
    }> = [];

    if (visibleChildIds.length > 0) {
      const rawChildren = await db
        .select({
          id: albums.id,
          name: albums.name,
          slug: albums.slug,
          coverPhotoId: albums.coverPhotoId,
          sortOrder: albums.sortOrder,
          childSortMode: albums.childSortMode,
          photoSortMode: albums.photoSortMode,
        })
        .from(albums)
        .where(
          and(
            eq(albums.parentId, albumId),
            eq(albums.isActive, true),
            inArray(albums.id, visibleChildIds)
          )
        )
        .orderBy(asc(albums.sortOrder), asc(albums.name));

      // Sortierung nach childSortMode des Eltern-Albums
      const sortMode = album.childSortMode ?? "order";
      childAlbums = rawChildren.sort((a, b) =>
        sortMode === "alpha"
          ? a.name.localeCompare(b.name, "de")
          : sortMode === "alpha_desc"
          ? b.name.localeCompare(a.name, "de")
          : a.sortOrder !== b.sortOrder
          ? a.sortOrder - b.sortOrder
          : a.name.localeCompare(b.name, "de")
      );
    }

    // ── Sichtbare private Foto-IDs des Users ermitteln ──────────────
    let accessiblePrivatePhotoIds: number[] = [];
    if (!isAdmin && userId) {
      // Gruppen-Sichtbarkeit
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

      // Individueller User-Zugriff
      const userAccessRows = await db
        .select({ photoId: photoUserAccess.photoId })
        .from(photoUserAccess)
        .where(eq(photoUserAccess.userId, userId));
      accessiblePrivatePhotoIds = [
        ...new Set([...accessiblePrivatePhotoIds, ...userAccessRows.map((r) => r.photoId)]),
      ];
    }

    // ── Cover-Fotos der Unteralben laden ────────────────────────────
    if (childAlbums.length === 0) {
      return NextResponse.json({
        album: {
          id: album.id,
          name: album.name,
          coverPhoto: albumCoverPhoto,
        },
        subAlbums: [],
        music: [],
      });
    }

    const childIds = childAlbums.map((c) => c.id);

    // Explizit gesetzte Cover-Fotos
    const coverPhotoIds = childAlbums
      .map((c) => c.coverPhotoId)
      .filter((id): id is number => id !== null);

    const coverPhotosResult =
      coverPhotoIds.length > 0
        ? await db
            .select({ id: photos.id, fileUrl: photos.fileUrl, thumbnailUrl: photos.thumbnailUrl })
            .from(photos)
            .where(inArray(photos.id, coverPhotoIds))
        : [];
    const coverMap = new Map(coverPhotosResult.map((p) => [p.id, p]));

    // Fallback-Cover: erstes Foto direkt aus dem Unteralbum
    const childrenWithoutCover = childAlbums
      .filter((c) => !c.coverPhotoId)
      .map((c) => c.id);

    const fallbackCoverMap = new Map<number, { fileUrl: string; thumbnailUrl: string | null }>();

    if (childrenWithoutCover.length > 0) {
      const directPhotos = await db
        .select({ albumId: photos.albumId, fileUrl: photos.fileUrl, thumbnailUrl: photos.thumbnailUrl })
        .from(photos)
        .where(and(eq(photos.isPrivate, false), inArray(photos.albumId, childrenWithoutCover)))
        .orderBy(asc(photos.sortOrder), asc(photos.createdAt));

      const photosByAlbum = new Map<number, { fileUrl: string; thumbnailUrl: string | null }>();
      for (const p of directPhotos) {
        if (p.albumId !== null && !photosByAlbum.has(p.albumId)) {
          photosByAlbum.set(p.albumId, { fileUrl: p.fileUrl, thumbnailUrl: p.thumbnailUrl });
        }
      }
      for (const [albumId, photo] of photosByAlbum) {
        fallbackCoverMap.set(albumId, photo);
      }
    }

    // ── Fotos aller Unteralben laden ────────────────────────────────
    const allPhotos = isAdmin
      ? await db
          .select({
            id: photos.id,
            albumId: photos.albumId,
            filename: photos.filename,
            title: photos.title,
            fileUrl: photos.fileUrl,
            thumbnailUrl: photos.thumbnailUrl,
            sortOrder: photos.sortOrder,
            createdAt: photos.createdAt,
          })
          .from(photos)
          .where(inArray(photos.albumId, childIds))
          .orderBy(asc(photos.sortOrder), asc(photos.createdAt))
      : accessiblePrivatePhotoIds.length > 0
      ? await db
          .select({
            id: photos.id,
            albumId: photos.albumId,
            filename: photos.filename,
            title: photos.title,
            fileUrl: photos.fileUrl,
            thumbnailUrl: photos.thumbnailUrl,
            sortOrder: photos.sortOrder,
            createdAt: photos.createdAt,
          })
          .from(photos)
          .where(
            and(
              inArray(photos.albumId, childIds),
              or(
                eq(photos.isPrivate, false),
                inArray(photos.id, accessiblePrivatePhotoIds)
              )
            )
          )
          .orderBy(asc(photos.sortOrder), asc(photos.createdAt))
      : await db
          .select({
            id: photos.id,
            albumId: photos.albumId,
            filename: photos.filename,
            title: photos.title,
            fileUrl: photos.fileUrl,
            thumbnailUrl: photos.thumbnailUrl,
            sortOrder: photos.sortOrder,
            createdAt: photos.createdAt,
          })
          .from(photos)
          .where(and(inArray(photos.albumId, childIds), eq(photos.isPrivate, false)))
          .orderBy(asc(photos.sortOrder), asc(photos.createdAt));

    // ── Videos aller Unteralben laden ───────────────────────────────
    const allVideos = await db
      .select({
        id: videos.id,
        albumId: videos.albumId,
        filename: videos.filename,
        title: videos.title,
        fileUrl: videos.fileUrl,
        thumbnailUrl: videos.thumbnailUrl,
        duration: videos.duration,
      })
      .from(videos)
      .where(and(inArray(videos.albumId, childIds), eq(videos.isPrivate, false)))
      .orderBy(asc(videos.sortOrder), asc(videos.createdAt));

    // Nach Album gruppieren
    const photosByAlbumMap = new Map<number, typeof allPhotos>();
    for (const p of allPhotos) {
      if (p.albumId !== null) {
        if (!photosByAlbumMap.has(p.albumId)) photosByAlbumMap.set(p.albumId, []);
        photosByAlbumMap.get(p.albumId)!.push(p);
      }
    }

    const videosByAlbumMap = new Map<number, typeof allVideos>();
    for (const v of allVideos) {
      if (v.albumId !== null) {
        if (!videosByAlbumMap.has(v.albumId)) videosByAlbumMap.set(v.albumId, []);
        videosByAlbumMap.get(v.albumId)!.push(v);
      }
    }

    // ── Musik-Playlist laden ────────────────────────────────────────
    const musicList = await db
      .select()
      .from(albumSlideshowMusic)
      .where(eq(albumSlideshowMusic.albumId, albumId))
      .orderBy(asc(albumSlideshowMusic.sortOrder), asc(albumSlideshowMusic.createdAt));

    // ── Ergebnis zusammenstellen ─────────────────────────────────────
    const subAlbums = childAlbums.map((child) => {
      const coverPhoto = child.coverPhotoId
        ? (coverMap.get(child.coverPhotoId) ?? null)
        : fallbackCoverMap.has(child.id)
        ? { id: 0, ...fallbackCoverMap.get(child.id)! }
        : null;

      return {
        id: child.id,
        name: child.name,
        coverPhoto: coverPhoto
          ? { fileUrl: coverPhoto.fileUrl, thumbnailUrl: coverPhoto.thumbnailUrl }
          : null,
        photos: (photosByAlbumMap.get(child.id) ?? []).map((p) => ({
          id: p.id,
          fileUrl: p.fileUrl,
          thumbnailUrl: p.thumbnailUrl,
          title: p.title,
          filename: p.filename,
        })),
        videos: (videosByAlbumMap.get(child.id) ?? []).map((v) => ({
          id: v.id,
          fileUrl: v.fileUrl,
          thumbnailUrl: v.thumbnailUrl,
          title: v.title,
          filename: v.filename,
          duration: v.duration,
        })),
      };
    });

    return NextResponse.json({
      album: {
        id: album.id,
        name: album.name,
        coverPhoto: albumCoverPhoto,
      },
      subAlbums,
      music: musicList.map((m) => ({
        id: m.id,
        fileUrl: m.fileUrl,
        title: m.title,
        durationSec: m.durationSec,
        sortOrder: m.sortOrder,
      })),
    });
  } catch (error) {
    console.error("GET subalbum-slideshow Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}
