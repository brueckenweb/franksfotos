"use client";

import { useState } from "react";
import { Film, Play, Clock, Lock } from "lucide-react";
import DeleteVideoButton from "./DeleteVideoButton";
import GenerateThumbnailButton from "./GenerateThumbnailButton";

export interface VideoRow {
  id: number;
  filename: string;
  title: string | null;
  fileUrl: string;
  thumbnailUrl: string | null;
  duration: number | null;
  isPrivate: boolean;
  fileSize: number | null;
  mimeType: string | null;
  bnummer: number | string | null;
  albumName: string | null;
  albumSlug: string | null;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function VideoThumb({
  thumbnailUrl,
  alt,
}: {
  thumbnailUrl: string | null;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!thumbnailUrl || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-800">
        <Film className="w-8 h-8 text-gray-600" />
      </div>
    );
  }

  return (
    <img
      src={thumbnailUrl}
      alt={alt}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export default function VideoTableClient({ initialVideos }: { initialVideos: VideoRow[] }) {
  const [thumbUrls, setThumbUrls] = useState<Record<number, string>>(() => {
    const map: Record<number, string> = {};
    for (const v of initialVideos) {
      if (v.thumbnailUrl) map[v.id] = v.thumbnailUrl;
    }
    return map;
  });

  if (initialVideos.length === 0) {
    return (
      <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-xl">
        <Film className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400">Noch keine Videos vorhanden.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {initialVideos.map((video) => {
        const thumbUrl = thumbUrls[video.id] ?? null;
        const duration = formatDuration(video.duration);

        return (
          <div
            key={video.id}
            className="group relative bg-gray-900 border border-gray-800 rounded-lg overflow-hidden hover:border-gray-700 transition-colors"
          >
            {/* Vorschaubild */}
            <div className="aspect-video bg-gray-800 relative overflow-hidden">
              <VideoThumb
                thumbnailUrl={thumbUrl}
                alt={video.title || video.filename}
              />

              {/* Play-Overlay mit Link */}
              <a
                href={video.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/50 transition-colors"
                title="Video öffnen"
              >
                <div className="bg-white/20 group-hover:bg-white/30 backdrop-blur-sm rounded-full p-3 opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
                  <Play className="w-6 h-6 text-white fill-white" />
                </div>
              </a>

              {/* Dauer-Badge */}
              {duration && (
                <div className="absolute bottom-1.5 right-1.5 bg-black/70 rounded px-1.5 py-0.5 flex items-center gap-1 pointer-events-none">
                  <Clock className="w-2.5 h-2.5 text-gray-300" />
                  <span className="text-xs text-gray-200 font-mono">{duration}</span>
                </div>
              )}

              {/* Privat-Badge */}
              {video.isPrivate && (
                <div className="absolute top-1.5 left-1.5 bg-black/70 rounded-full p-1 pointer-events-none">
                  <Lock className="w-3 h-3 text-amber-400" />
                </div>
              )}

              {/* Aktionen (Löschen) */}
              <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <DeleteVideoButton videoId={video.id} />
              </div>
            </div>

            {/* Info */}
            <div className="p-2">
              <p className="text-xs text-gray-300 truncate font-medium">
                {video.title || video.filename}
              </p>
              {video.albumName && (
                <p className="text-xs text-gray-600 truncate">{video.albumName}</p>
              )}
              <div className="flex items-center justify-between mt-1">
                {video.fileSize ? (
                  <p className="text-xs text-gray-700">
                    {(video.fileSize / (1024 * 1024)).toFixed(1)} MB
                  </p>
                ) : <span />}

                {/* Thumbnail generieren wenn keines vorhanden */}
                {!thumbUrl && (
                  <GenerateThumbnailButton
                    videoId={video.id}
                    fileUrl={video.fileUrl}
                    filename={video.filename}
                    albumSlug={video.albumSlug}
                    onDone={(url) => {
                      setThumbUrls((prev) => ({ ...prev, [video.id]: url }));
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
