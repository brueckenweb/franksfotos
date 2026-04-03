import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { photos, albums } from "@/lib/db/schema";
import { desc, count } from "drizzle-orm";
import { eq } from "drizzle-orm";
import FotosGridClient from "./FotosGridClient";

const PAGE_SIZE = 60;

async function getPhotoCount(): Promise<number> {
  try {
    const result = await db.select({ total: count() }).from(photos);
    return result[0]?.total ?? 0;
  } catch {
    return 0;
  }
}

async function getPhotos(page: number) {
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

export default async function AdminFotosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const [totalCount, pagePhotos, allAlbums] = await Promise.all([
    getPhotoCount(),
    getPhotos(currentPage),
    getAllAlbums(),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  if (currentPage > totalPages && totalCount > 0) {
    redirect(`/admin/fotos?page=${totalPages}`);
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
      />
    </div>
  );
}
