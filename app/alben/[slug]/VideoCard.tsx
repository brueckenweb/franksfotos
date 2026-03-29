"use client";

import { useState, useEffect } from "react";
import { Play, X, Download, AlertTriangle, Loader2 } from "lucide-react";

interface VideoCardProps {
  filename: string;
  title: string | null;
  description?: string | null;
  fileUrl: string;
  thumbnailUrl: string | null;
  duration?: number | null;
  /** MIME-Typ aus der Datenbank (bevorzugt gegenüber URL-Ableitung) */
  mimeType?: string | null;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * MIME-Typ aus Dateiendung ableiten (für das Format-Badge auf der Kachel).
 * Ignoriert Query-Parameter (?foo=bar) korrekt.
 */
function getVideoMimeType(url: string): string {
  const path = url.split("?")[0];
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    mp4:  "video/mp4",
    m4v:  "video/mp4",
    mov:  "video/quicktime",
    webm: "video/webm",
    avi:  "video/x-msvideo",
    mkv:  "video/x-matroska",
  };
  return map[ext] || "video/mp4";
}

/** Gibt eine lesbare Format-Bezeichnung zurück */
function formatLabel(mimeType: string): string {
  const ext = mimeType.split("/")[1] ?? mimeType;
  const map: Record<string, string> = {
    quicktime:  "QuickTime/MOV",
    "x-msvideo":  "AVI",
    "x-matroska": "MKV",
    mp4:          "MP4",
    webm:         "WebM",
  };
  return map[ext] ?? ext.toUpperCase();
}

export default function VideoCard({
  filename,
  title,
  description,
  fileUrl,
  thumbnailUrl,
  duration,
  mimeType,
}: VideoCardProps) {
  const [open, setOpen] = useState(false);
  /** true sobald der Browser einen echten Abspiel-Fehler meldet */
  const [playError, setPlayError] = useState(false);
  /** true solange Video initial lädt oder puffert */
  const [isLoading, setIsLoading] = useState(false);

  // Nur fürs Format-Badge auf der Kachel
  const effectiveMimeType = mimeType || getVideoMimeType(fileUrl);

  // Fehler- und Lade-State zurücksetzen wenn Modal neu geöffnet wird
  useEffect(() => {
    if (open) {
      setPlayError(false);
      setIsLoading(true); // Video muss immer erst laden
    }
  }, [open]);

  // Escape-Taste schließt Modal
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKey);
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

          {/* Format-Badge bei nicht-MP4 */}
          {effectiveMimeType !== "video/mp4" && (
            <div className="absolute top-2 left-2 bg-black/70 rounded px-1.5 py-0.5 text-xs text-gray-300 font-mono">
              {formatLabel(effectiveMimeType)}
            </div>
          )}
        </div>

        <div className="p-3">
          <p className="text-sm font-medium text-white truncate group-hover:text-blue-400 transition-colors">
            {title || filename}
          </p>
          {description && (
            <p className="text-xs text-gray-500 truncate mt-0.5">{description}</p>
          )}
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
            {/* Fehlermeldung – nur bei echtem Abspiel-Fehler (onError) */}
            {playError && (
              <div className="flex flex-col gap-3 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-4">
                <div className="flex items-start gap-2 text-sm text-red-300">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    Das Video konnte nicht abgespielt werden. Das Format{" "}
                    <strong>{formatLabel(effectiveMimeType)}</strong> wird von
                    deinem Browser möglicherweise nicht unterstützt, oder die
                    Datei ist nicht erreichbar.
                  </span>
                </div>
                <a
                  href={`/api/video-download?url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(filename)}`}
                  download={filename}
                  className="inline-flex items-center gap-2 self-start bg-white/10 hover:bg-white/20 text-white text-sm px-3 py-2 rounded-lg transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download className="w-4 h-4" />
                  Datei herunterladen
                </a>
              </div>
            )}

            {/*
              Proxy-URL verwenden: Videos werden server-seitig von pics.frank-sellke.de
              durchgeleitet. Das umgeht Hotlink-Sperren des Hosters und erlaubt
              korrekte Range-Request-Unterstützung für Seeking.
            */}
            <div className="relative">
              {/* Lade-Overlay: sichtbar solange Video noch nicht bereit ist */}
              {isLoading && !playError && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/80 rounded-xl">
                  <Loader2 className="w-10 h-10 text-white/70 animate-spin" />
                  <p className="text-white/50 text-sm">Video wird geladen…</p>
                </div>
              )}
              <video
                key={fileUrl}
                src={`/api/video-download?url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(filename)}&inline=1`}
                controls
                autoPlay
                playsInline
                className="w-full rounded-xl shadow-2xl bg-black"
                style={{ maxHeight: "80vh" }}
                onLoadStart={() => setIsLoading(true)}
                onCanPlay={() => setIsLoading(false)}
                onPlaying={() => setIsLoading(false)}
                onWaiting={() => setIsLoading(true)}
                onError={() => { setIsLoading(false); setPlayError(true); }}
              />
            </div>

            {(title || filename) && (
              <p className="text-white/70 text-sm text-center font-medium">
                {title || filename}
              </p>
            )}
            {description && (
              <p className="text-white/40 text-xs text-center">{description}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
