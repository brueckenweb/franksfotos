"use client";

import { useState } from "react";
import { Film, Play } from "lucide-react";
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
  if (!seconds) return "–";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VideoTableClient({ initialVideos }: { initialVideos: VideoRow[] }) {
  // Thumbnail-URLs lokal verwalten, damit nach Generierung kein Seiten-Reload nötig ist
  const [thumbUrls, setThumbUrls] = useState<Record<number, string>>(() => {
    const map: Record<number, string> = {};
    for (const v of initialVideos) {
      if (v.thumbnailUrl) map[v.id] = v.thumbnailUrl;
    }
    return map;
  });

  // Tracks welche Thumbnails einen Ladefehler haben (404, falscher Pfad, etc.)
  const [thumbErrors, setThumbErrors] = useState<Record<number, boolean>>({});

  return (
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
          {initialVideos.map((video) => {
            const thumbUrl = thumbUrls[video.id] ?? null;
            // Thumbnail gilt als vorhanden, wenn URL gesetzt UND kein Ladefehler
            const thumbOk = Boolean(thumbUrl) && !thumbErrors[video.id];

            return (
              <tr
                key={video.id}
                className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {/* Thumbnail-Vorschau */}
                    <div className="w-14 h-10 bg-gray-800 rounded overflow-hidden flex-shrink-0 relative">
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={video.title || video.filename}
                          className={`w-full h-full object-cover ${thumbErrors[video.id] ? "hidden" : ""}`}
                          onError={() =>
                            setThumbErrors((prev) => ({ ...prev, [video.id]: true }))
                          }
                        />
                      ) : null}
                      {!thumbOk && (
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
                      {/* Button zeigen wenn kein Thumbnail oder Ladefehler */}
                      {!thumbOk && (
                        <GenerateThumbnailButton
                          videoId={video.id}
                          fileUrl={video.fileUrl}
                          filename={video.filename}
                          albumSlug={video.albumSlug}
                          onDone={(url) => {
                            setThumbUrls((prev) => ({ ...prev, [video.id]: url }));
                            setThumbErrors((prev) => ({ ...prev, [video.id]: false }));
                          }}
                        />
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
