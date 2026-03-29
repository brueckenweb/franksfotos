"use client";

import { useState, useEffect } from "react";
import { Play, X } from "lucide-react";

interface VideoCardProps {
  filename: string;
  title: string | null;
  fileUrl: string;
  thumbnailUrl: string | null;
  duration?: number | null;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** MIME-Typ aus Dateiendung ableiten */
function getVideoMimeType(url: string): string {
  const ext = url.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    mp4: "video/mp4",
    m4v: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    avi: "video/x-msvideo",
    mkv: "video/x-matroska",
  };
  return map[ext] || "video/mp4";
}

export default function VideoCard({
  filename,
  title,
  fileUrl,
  thumbnailUrl,
  duration,
}: VideoCardProps) {
  const [open, setOpen] = useState(false);

  // Escape-Taste schließt Modal
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    // Body-Scroll deaktivieren
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* ── Video-Karte ────────────────────────────────── */}
      <div
        className="group relative bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-blue-500/40 transition-colors cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <div className="aspect-video bg-gray-800 relative overflow-hidden">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={title || filename}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Play className="w-10 h-10 text-gray-600 group-hover:text-blue-400 transition-colors" />
            </div>
          )}

          {/* Play-Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/50 transition-colors">
            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-blue-500/60 transition-colors">
              <Play className="w-6 h-6 text-white ml-0.5" />
            </div>
          </div>

          {/* Dauer-Badge */}
          {duration != null && duration > 0 && (
            <div className="absolute bottom-2 right-2 bg-black/70 rounded px-1.5 py-0.5 text-xs text-white font-mono">
              {formatDuration(duration)}
            </div>
          )}
        </div>

        <div className="p-3">
          <p className="text-sm font-medium text-white truncate group-hover:text-blue-400 transition-colors">
            {title || filename}
          </p>
        </div>
      </div>

      {/* ── Video-Modal ────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          {/* Schließen-Button */}
          <button
            className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors z-10"
            onClick={() => setOpen(false)}
            aria-label="Schließen"
          >
            <X className="w-8 h-8" />
          </button>

          {/* Video-Container */}
          <div
            className="w-full max-w-5xl flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              controls
              autoPlay
              className="w-full rounded-xl shadow-2xl bg-black"
              style={{ maxHeight: "80vh" }}
            >
              <source src={fileUrl} type={getVideoMimeType(fileUrl)} />
              Ihr Browser unterstützt dieses Videoformat nicht.
            </video>

            {(title || filename) && (
              <p className="text-white/50 text-sm text-center">
                {title || filename}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
