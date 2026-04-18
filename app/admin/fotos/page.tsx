import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { photos, albums, users } from "@/lib/db/schema";
import { desc, count, eq, like, or, and, type SQL } from "drizzle-orm";
import FotosGridClient from "./FotosGridClient";

const PAGE_SIZE = 60;

function buildWhereClause(albumId?: number, query?: string, userId?: number): SQL | undefined {
  const conditions: SQL[] = [];

  if (albumId !== undefined) conditions.push(eq(photos.albumId, albumId));
  if (userId !== undefined) conditions.push(eq(photos.createdBy, userId));
  if (query) {
    const searchCond = or(like(photos.title, `%${query}%`), like(photos.filename, `%${query}%`));
    if (searchCond) conditions.push(searchCond);
  }

  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return and(...conditions);
}

async function getPhotoCount(albumId?: number, query?: string, userId?: number): Promise<number> {
  try {
    const result = await db
      .select({ total: count() })
      .from(photos)
      .where(buildWhereClause(albumId, query, userId));
    return result[0]?.total ?? 0;
  } catch {
    return 0;
  }
}

async function getPhotos(page: number, albumId?: number, query?: string, userId?: number) {
  try {
    return await db
      .select({
        id: photos.id,
        filename: photos.filename,
        title: photos.title,
        fileUrl: photos.fileUrl,
        thumbnailUrl: photos.thumbnailUrl,
        isPrivate: photos.isPrivate,
        fileSize: photos.fileSize,
        albumName: albums.name,
        albumId: photos.albumId,
      })
      .from(photos)
      .leftJoin(albums, eq(photos.albumId, albums.id))
      .where(buildWhereClause(albumId, query, userId))
      .orderBy(desc(photos.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE);
  } catch {
    return [];
  }
}

async function getAllAlbums() {
  try {
    return await db
      .select({ id: albums.id, name: albums.name, parentId: albums.parentId })
      .from(albums)
      .orderBy(albums.name);
  } catch {
    return [];
  }
}

async function getUserName(userId: number): Promise<string | null> {
  try {
    const [user] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return user?.name ?? null;
  } catch {
    return null;
  }
}

export default async function AdminFotosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; album?: string; q?: string; user?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const filterAlbumId = params.album ?? "";
  const searchQuery = (params.q ?? "").trim();
  const filterUserId = params.user ?? "";

  const albumId = filterAlbumId ? parseInt(filterAlbumId, 10) : undefined;
  const query = searchQuery || undefined;
  const userId = filterUserId ? parseInt(filterUserId, 10) : undefined;

  const [totalCount, pagePhotos, allAlbums, filterUserName] = await Promise.all([
    getPhotoCount(albumId, query, userId),
    getPhotos(currentPage, albumId, query, userId),
    getAllAlbums(),
    userId ? getUserName(userId) : Promise.resolve(null),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  if (currentPage > totalPages && totalCount > 0) {
    const rp = new URLSearchParams();
    rp.set("page", String(totalPages));
    if (filterAlbumId) rp.set("album", filterAlbumId);
    if (searchQuery) rp.set("q", searchQuery);
    if (filterUserId) rp.set("user", filterUserId);
    redirect(`/admin/fotos?${rp.toString()}`);
  }

  const from = totalCount === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, totalCount);

  return (
    <div>
      <FotosGridClient
        photos={pagePhotos}
        albums={allAlbums}
        totalCount={totalCount}
        totalPages={totalPages}
        safePage={safePage}
        from={from}
        to={to}
        filterAlbumId={filterAlbumId}
        searchQuery={searchQuery}
        filterUserId={filterUserId}
        filterUserName={filterUserName}
      />
    </div>
  );
}
