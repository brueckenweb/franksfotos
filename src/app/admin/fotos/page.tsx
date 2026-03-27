import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { photos, albums } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { Camera, Download, Pencil, Trash2, Lock } from "lucide-react";
import DeletePhotoButton from "./DeletePhotoButton";
import PhotoThumbnail from "@/app/alben/[slug]/PhotoThumbnail";

async function getPhotos() {
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
        width: photos.width,
        height: photos.height,
        bnummer: photos.bnummer,
        createdAt: photos.createdAt,
        albumName: albums.name,
        albumId: photos.albumId,
      })
      .from(photos)
      .leftJoin(albums, eq(photos.albumId, albums.id))
      .orderBy(desc(photos.createdAt))
      .limit(200);
  } catch {
    return [];
  }
}

export default async function AdminFotosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const allPhotos = await getPhotos();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Fotos</h1>
          <p className="text-gray-400 text-sm mt-0.5">{allPhotos.length} Fotos</p>
        </div>
        <Link
          href="/admin/upload"
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <Camera className="w-4 h-4" />
          Fotos hochladen
        </Link>
      </div>

      {allPhotos.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-xl">
          <Camera className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Noch keine Fotos vorhanden.</p>
          <Link
            href="/admin/upload"
            className="mt-4 inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 text-sm"
          >
            <Camera className="w-4 h-4" />
            Erste Fotos hochladen
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {allPhotos.map((photo) => (
            <div
              key={photo.id}
              className="group relative bg-gray-900 border border-gray-800 rounded-lg overflow-hidden hover:border-gray-700 transition-colors"
            >
              {/* Vorschaubild */}
              <div className="aspect-square bg-gray-800 relative overflow-hidden">
                <PhotoThumbnail
                  thumbnailUrl={photo.thumbnailUrl ?? null}
                  fileUrl={photo.fileUrl}
                  alt={photo.title || photo.filename}
                />
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <Link
                    href={`/admin/fotos/${photo.id}/edit`}
                    className="bg-white/90 hover:bg-white text-gray-900 rounded-full p-1.5 transition-colors"
                    title="Bearbeiten"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Link>
                  <a
                    href={`/api/download/${photo.id}`}
                    className="bg-white/90 hover:bg-white text-gray-900 rounded-full p-1.5 transition-colors"
                    title="Herunterladen"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <DeletePhotoButton photoId={photo.id} />
                </div>
                {/* Privat-Badge */}
                {photo.isPrivate && (
                  <div className="absolute top-1.5 left-1.5 bg-black/70 rounded-full p-1">
                    <Lock className="w-3 h-3 text-amber-400" />
                  </div>
                )}
              </div>
              {/* Info */}
              <div className="p-2">
                <p className="text-xs text-gray-300 truncate font-medium">
                  {photo.title || photo.filename}
                </p>
                {photo.albumName && (
                  <p className="text-xs text-gray-600 truncate">{photo.albumName}</p>
                )}
                {photo.fileSize && (
                  <p className="text-xs text-gray-700">
                    {(photo.fileSize / (1024 * 1024)).toFixed(1)} MB
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
