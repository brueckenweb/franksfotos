import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { videos, albums } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { Film, Upload } from "lucide-react";
import VideoTableClient from "./VideoTableClient";

async function getVideos() {
  try {
    return await db
      .select({
        id: videos.id,
        filename: videos.filename,
        title: videos.title,
        fileUrl: videos.fileUrl,
        thumbnailUrl: videos.thumbnailUrl,
        duration: videos.duration,
        isPrivate: videos.isPrivate,
        fileSize: videos.fileSize,
        mimeType: videos.mimeType,
        bnummer: videos.bnummer,
        albumName: albums.name,
        albumSlug: albums.slug,
      })
      .from(videos)
      .leftJoin(albums, eq(videos.albumId, albums.id))
      .orderBy(desc(videos.createdAt))
      .limit(100);
  } catch {
    return [];
  }
}

export default async function AdminVideosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const allVideos = await getVideos();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Videos</h1>
          <p className="text-gray-400 text-sm mt-0.5">{allVideos.length} Videos</p>
        </div>
        <Link
          href="/admin/upload"
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <Upload className="w-4 h-4" />
          Videos hochladen
        </Link>
      </div>

      {allVideos.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-xl">
          <Film className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Noch keine Videos vorhanden.</p>
        </div>
      ) : (
        <VideoTableClient initialVideos={allVideos} />
      )}
    </div>
  );
}
