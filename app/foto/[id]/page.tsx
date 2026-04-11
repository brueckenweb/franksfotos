import Link from "next/link";
import { notFound } from "next/navigation";
import LocalDate from "@/components/LocalDate";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { photos, albums, comments, users, likes, tags, tagGroups, photoTags, photoGroupVisibility, photoUserAccess, userGroups } from "@/lib/db/schema";
import { eq, and, count, asc, inArray } from "drizzle-orm";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, FolderOpen, Lock, MessageSquare, Pencil, Tag, User } from "lucide-react";
import LikeButton from "./LikeButton";
import CommentForm from "./CommentForm";
import TagInput from "./TagInput";
import ExifBox from "./ExifBox";
import PhotoZoom from "./PhotoZoom";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
};

/** Entfernt HTML-Tags aus einem String (für Plaintext-Kontexte) */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

async function getPhoto(id: number) {
  try {
    const result = await db
      .select({
        id: photos.id,
        filename: photos.filename,
        title: photos.title,
        description: photos.description,
        fileUrl: photos.fileUrl,
        thumbnailUrl: photos.thumbnailUrl,
        width: photos.width,
        height: photos.height,
        fileSize: photos.fileSize,
        isPrivate: photos.isPrivate,
        bnummer: photos.bnummer,
        exifData: photos.exifData,
        createdAt: photos.createdAt,
        albumId: photos.albumId,
        createdBy: photos.createdBy,
        albumName: albums.name,
        albumSlug: albums.slug,
        uploaderName: users.name,
      })
      .from(photos)
      .leftJoin(albums, eq(photos.albumId, albums.id))
      .leftJoin(users, eq(photos.createdBy, users.id))
      .where(eq(photos.id, id))
      .limit(1);
    return result[0] ?? null;
  } catch {
    return null;
  }
}

async function getPhotoComments(photoId: number) {
  try {
    return await db
      .select({
        id: comments.id,
        content: comments.content,
        createdAt: comments.createdAt,
        userName: users.name,
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .where(and(eq(comments.photoId, photoId), eq(comments.isApproved, true)))
      .orderBy(comments.createdAt);
  } catch {
    return [];
  }
}

async function getLikeCount(photoId: number) {
  try {
    const result = await db
      .select({ cnt: count() })
      .from(likes)
      .where(eq(likes.photoId, photoId));
    return result[0]?.cnt ?? 0;
  } catch {
    return 0;
  }
}

async function getUserHasLiked(photoId: number, userId: number) {
  try {
    const result = await db
      .select({ id: likes.id })
      .from(likes)
      .where(and(eq(likes.photoId, photoId), eq(likes.userId, userId)))
      .limit(1);
    return result.length > 0;
  } catch {
    return false;
  }
}

/** Gibt die IDs des vorherigen und nächsten Fotos im selben Album zurück */
async function getAlbumNeighbors(
  photoId: number,
  albumId: number | null
): Promise<{ prevId: number | null; nextId: number | null }> {
  if (!albumId) return { prevId: null, nextId: null };
  try {
    const albumPhotos = await db
      .select({ id: photos.id })
      .from(photos)
      .where(and(eq(photos.albumId, albumId), eq(photos.isPrivate, false)))
      .orderBy(asc(photos.sortOrder), asc(photos.createdAt));

    const ids = albumPhotos.map((p) => p.id);
    const idx = ids.indexOf(photoId);
    if (idx === -1) return { prevId: null, nextId: null };

    return {
      prevId: idx > 0 ? ids[idx - 1] : null,
      nextId: idx < ids.length - 1 ? ids[idx + 1] : null,
    };
  } catch {
    return { prevId: null, nextId: null };
  }
}

/**
 * Lädt die Nachbarn eines Fotos im Kontext eines Tag-Albums.
 * Gibt außerdem den Album-Namen und -Slug zurück.
 */
async function getTagAlbumContext(
  tagAlbumSlug: string,
  photoId: number
): Promise<{
  albumName: string;
  albumSlug: string;
  prevId: number | null;
  nextId: number | null;
} | null> {
  try {
    // Tag-Album laden
    const albumRows = await db
      .select({
        id: albums.id,
        name: albums.name,
        slug: albums.slug,
        tagId: albums.tagId,
        sourceType: albums.sourceType,
        photoSortMode: albums.photoSortMode,
      })
      .from(albums)
      .where(eq(albums.slug, tagAlbumSlug))
      .limit(1);

    const album = albumRows[0];
    if (!album || album.sourceType !== "tag" || !album.tagId) return null;

    // Alle Foto-IDs dieses Tags laden (gleiche Reihenfolge wie im Album)
    const taggedRows = await db
      .select({ photoId: photoTags.photoId })
      .from(photoTags)
      .where(eq(photoTags.tagId, album.tagId));

    const taggedIds = taggedRows.map((r) => r.photoId);
    if (taggedIds.length === 0) return null;

    // Fotos in richtiger Reihenfolge laden
    const tagPhotos = await db
      .select({ id: photos.id, createdAt: photos.createdAt, sortOrder: photos.sortOrder })
      .from(photos)
      .where(and(inArray(photos.id, taggedIds), eq(photos.isPrivate, false)))
      .orderBy(asc(photos.createdAt));

    const ids = tagPhotos.map((p) => p.id);
    const idx = ids.indexOf(photoId);
    if (idx === -1) return null;

    return {
      albumName: album.name,
      albumSlug: album.slug,
      prevId: idx > 0 ? ids[idx - 1] : null,
      nextId: idx < ids.length - 1 ? ids[idx + 1] : null,
    };
  } catch {
    return null;
  }
}

async function getPhotoTags(photoId: number): Promise<any[]> {
  try {
    return await db
      .select({
        id: tags.id,
        name: tags.name,
        slug: tags.slug,
        groupName: tagGroups.name,
        groupSlug: tagGroups.slug,
        groupColor: tagGroups.color,
      })
      .from(photoTags)
      .innerJoin(tags, eq(photoTags.tagId, tags.id))
      .leftJoin(tagGroups, eq(tags.groupId, tagGroups.id))
      .where(eq(photoTags.photoId, photoId))
      .orderBy(tagGroups.name, tags.name);
  } catch {
    return [];
  }
}

export default async function FotoPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { from } = await searchParams;
  const photoId = parseInt(id);

  if (isNaN(photoId)) notFound();

  const session = await auth();
  const photo = await getPhoto(photoId);

  if (!photo) notFound();

  const userId = session?.user
    ? parseInt((session.user as { id: string }).id)
    : null;

  const isAdmin = !!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin;

  // Zugriffscheck für private Fotos
  if (photo.isPrivate) {
    if (!session?.user || !userId) notFound(); // nicht eingeloggt

    if (!isAdmin) {
      // Eigentümer darf immer sehen
      const isCreator = userId === photo.createdBy;

      if (!isCreator) {
        // Individueller Zugriff per photoUserAccess?
        const userAccessRows = await db
          .select({ photoId: photoUserAccess.photoId })
          .from(photoUserAccess)
          .where(and(eq(photoUserAccess.photoId, photoId), eq(photoUserAccess.userId, userId)))
          .limit(1);

        const hasUserAccess = userAccessRows.length > 0;

        if (!hasUserAccess) {
          // Gruppen-Zugriff prüfen: Ist der User in einer Gruppe die das Foto sehen darf?
          const userGroupRows = await db
            .select({ groupId: userGroups.groupId })
            .from(userGroups)
            .where(eq(userGroups.userId, userId));

          const groupIds = userGroupRows.map((g) => g.groupId);
          let hasGroupAccess = false;

          if (groupIds.length > 0) {
            const groupAccessRows = await db
              .select({ photoId: photoGroupVisibility.photoId })
              .from(photoGroupVisibility)
              .where(
                and(
                  eq(photoGroupVisibility.photoId, photoId),
                  inArray(photoGroupVisibility.groupId, groupIds)
                )
              )
              .limit(1);
            hasGroupAccess = groupAccessRows.length > 0;
          }

          if (!hasGroupAccess) notFound();
        }
      }
    }
  }

  // Tag-Album-Kontext laden (wenn `from` gesetzt ist)
  const tagContext = from ? await getTagAlbumContext(from, photoId) : null;

  const [photoComments, likeCount, userHasLiked, fetchedPhotoTags, neighbors] = await Promise.all([
    getPhotoComments(photoId),
    getLikeCount(photoId),
    userId ? getUserHasLiked(photoId, userId) : Promise.resolve(false),
    getPhotoTags(photoId),
    // Nachbarn: Tag-Kontext hat Vorrang vor normalem Album
    tagContext
      ? Promise.resolve({ prevId: tagContext.prevId, nextId: tagContext.nextId })
      : getAlbumNeighbors(photoId, photo.albumId ?? null),
  ]) as [any[], number, boolean, any[], { prevId: number | null; nextId: number | null }];

  // Hilfsfunktion: Foto-URL mit optionalem ?from= Parameter
  const fotoUrl = (fotoId: number) =>
    tagContext ? `/foto/${fotoId}?from=${tagContext.albumSlug}` : `/foto/${fotoId}`;

  // Zurück-Link: Tag-Album hat Vorrang
  const backHref = tagContext
    ? `/alben/${tagContext.albumSlug}`
    : photo.albumSlug
    ? `/alben/${photo.albumSlug}`
    : "/alben";

  const backLabel = tagContext
    ? tagContext.albumName
    : photo.albumName ?? null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-14 gap-3 min-w-0">
            <Link
              href={backHref}
              className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            {tagContext ? (
              <>
                <Tag className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <Link
                  href={`/alben/${tagContext.albumSlug}`}
                  className="text-gray-400 hover:text-white text-sm transition-colors truncate hidden sm:block"
                >
                  {tagContext.albumName}
                </Link>
                <span className="text-gray-700 hidden sm:block">/</span>
              </>
            ) : (
              photo.albumName && photo.albumSlug && (
                <>
                  <FolderOpen className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <Link
                    href={`/alben/${photo.albumSlug}`}
                    className="text-gray-400 hover:text-white text-sm transition-colors truncate hidden sm:block"
                  >
                    {photo.albumName}
                  </Link>
                  <span className="text-gray-700 hidden sm:block">/</span>
                </>
              )
            )}
            <span className="text-white text-sm truncate font-medium">
              {photo.title || photo.filename}
            </span>
            {photo.isPrivate && (
              <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Hauptbild */}
          <div className="lg:col-span-2 space-y-3">
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <PhotoZoom
                src={photo.fileUrl}
                alt={photo.title || photo.filename}
              />
            </div>

            {/* Vor/Zurück-Navigation */}
            {(neighbors.prevId || neighbors.nextId) && (
              <div className="flex items-center justify-between gap-3">
                {neighbors.prevId ? (
                  <Link
                    href={fotoUrl(neighbors.prevId)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                    title="Vorheriges Foto"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Vorheriges
                  </Link>
                ) : (
                  <div />
                )}

                {/* Album-/Tag-Album-Link in der Mitte */}
                <Link
                  href={backHref}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors truncate max-w-[140px] text-center"
                  title={`Zurück: ${backLabel}`}
                >
                  {backLabel}
                </Link>

                {neighbors.nextId ? (
                  <Link
                    href={fotoUrl(neighbors.nextId)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                    title="Nächstes Foto"
                  >
                    Nächstes
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <div />
                )}
              </div>
            )}
          </div>

          {/* Seitenleiste */}
          <div className="space-y-4">
            {/* Foto-Info */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              {/* Titel (groß) */}
              <h1 className="text-xl font-bold text-white mb-1 leading-snug">
                {photo.title || photo.filename}
              </h1>

              {/* Beschreibung */}
              {photo.description && (
                <p className="text-sm text-gray-300 mb-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: photo.description }} />
              )}

              {/* Dateiname (klein) */}
              <p className="text-xs text-gray-500 mb-3 font-mono">
                {photo.filename}
              </p>

              {/* Tag-Album-Kontext (wenn vorhanden) */}
              {tagContext && (
                <p className="text-xs text-gray-500 mb-1">
                  Tag-Album:{" "}
                  <Link
                    href={`/alben/${tagContext.albumSlug}`}
                    className="text-amber-400 hover:text-amber-300 inline-flex items-center gap-1"
                  >
                    <Tag className="w-3 h-3" />
                    {tagContext.albumName}
                  </Link>
                </p>
              )}

              {/* Original-Album (immer anzeigen) */}
              {photo.albumName && photo.albumSlug && (
                <p className="text-xs text-gray-500 mb-1">
                  Album:{" "}
                  <Link
                    href={`/alben/${photo.albumSlug}`}
                    className="text-amber-400 hover:text-amber-300"
                  >
                    {photo.albumName}
                  </Link>
                </p>
              )}

              {/* Uploader */}
              {photo.uploaderName && (
                <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Hochgeladen von{" "}
                  <span className="text-gray-300">{photo.uploaderName}</span>
                </p>
              )}

              <div className="space-y-1 text-xs text-gray-600 border-t border-gray-800 pt-3 mt-3">
                {photo.width && photo.height && (
                  <p>
                    <span className="text-gray-500">Auflösung:</span>{" "}
                    {photo.width} × {photo.height} px
                  </p>
                )}
                {photo.fileSize && (
                  <p>
                    <span className="text-gray-500">Größe:</span>{" "}
                    {(photo.fileSize / (1024 * 1024)).toFixed(1)} MB
                  </p>
                )}
                <p>
                  <span className="text-gray-500">Hochgeladen am:</span>{" "}
                  <LocalDate
                    dateStr={photo.createdAt.toISOString()}
                    options={{ year: "numeric", month: "long", day: "numeric" }}
                  />
                </p>
              </div>
            </div>

            {/* EXIF-Daten */}
            <ExifBox exifData={photo.exifData as Record<string, unknown> | null} />

            {/* Aktionen: Like + Download */}
            <div className="flex gap-3">
              <LikeButton
                photoId={photo.id}
                initialLikeCount={likeCount}
                initialHasLiked={userHasLiked}
                isLoggedIn={!!session?.user}
              />
              {session?.user && (
                <a
                  href={`/api/download/${photo.id}`}
                  className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors border border-gray-700"
                  title="Mit Wasserzeichen herunterladen"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              )}
            </div>

            {/* Admin: Foto bearbeiten */}
            {isAdmin && (
              <Link
                href={`/admin/fotos/${photo.id}/edit`}
                className="flex items-center gap-2 w-full justify-center px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors border border-amber-500"
                title="Foto bearbeiten (Admin)"
              >
                <Pencil className="w-4 h-4" />
                Foto bearbeiten
              </Link>
            )}

            {/* Kommentare */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-amber-400" />
                Kommentare ({photoComments.length})
              </h2>

              {photoComments.length === 0 ? (
                <p className="text-gray-600 text-sm">Noch keine Kommentare.</p>
              ) : (
                <div className="space-y-3 mb-4">
                  {photoComments.map((comment) => (
                    <div
                      key={comment.id}
                      className="border-b border-gray-800 pb-3 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-300 flex-shrink-0">
                          {comment.userName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-medium text-gray-300">
                          {comment.userName}
                        </span>
                        <span className="text-xs text-gray-600">
                          {new Date(comment.createdAt).toLocaleDateString("de-DE")}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 leading-relaxed pl-7">
                        {comment.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {session?.user ? (
                <CommentForm photoId={photo.id} />
              ) : (
                <p className="text-xs text-gray-600 mt-2">
                  <Link href="/login" className="text-amber-400 hover:text-amber-300">
                    Anmelden
                  </Link>{" "}
                  um zu kommentieren.
                </p>
              )}
            </div>

            {/* Tags */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <TagInput
                photoId={photo.id}
                initialTags={fetchedPhotoTags}
                isLoggedIn={!!session?.user}
                isAdmin={isAdmin}
              />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
