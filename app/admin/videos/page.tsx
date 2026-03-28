import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { videos, albums } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { Film, Upload, Lock, Play } from "lucide-react";
import DeleteVideoButton from "./DeleteVideoButton";

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
        createdAt: videos.createdAt,
        albumName: albums.name,
        albumId: videos.albumId,
      })
      .from(videos)
      .leftJoin(albums, eq(videos.albumId, albums.id))
      .orderBy(desc(videos.createdAt))
      .limit(100);
  } catch {
    return [];
  }
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "–";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
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
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Video</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium hidden md:table-cell">Album</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium hidden lg:table-cell">Dauer</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium hidden lg:table-cell">Größe</th>
                <th className="text-center px-4 py-3 text-gray-400 font-medium">Status</th>
                <th className="text-right px-4 py-3 text-gray-400 font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {allVideos.map((video) => (
                <tr
                  key={video.id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* Thumbnail */}
                      <div className="w-14 h-10 bg-gray-800 rounded overflow-hidden flex-shrink-0 relative">
                        {video.thumbnailUrl ? (
                          <img
                            src={video.thumbnailUrl}
                            alt={video.title || video.filename}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film className="w-5 h-5 text-gray-600" />
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Play className="w-4 h-4 text-white/70" />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-medium truncate">
                          {video.title || video.filename}
                        </p>
                        {video.mimeType && (
                          <p className="text-gray-600 text-xs font-mono">{video.mimeType}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-400">
                    {video.albumName || "–"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-400">
                    {formatDuration(video.duration)}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-400">
                    {video.fileSize
                      ? `${(video.fileSize / (1024 * 1024)).toFixed(1)} MB`
                      : "–"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {video.isPrivate ? (
                      <span className="inline-flex items-center gap-1 text-amber-400 text-xs">
                        <Lock className="w-3 h-3" />
                        Privat
                      </span>
                    ) : (
                      <span className="text-gray-500 text-xs">Öffentlich</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end">
                      <DeleteVideoButton videoId={video.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
