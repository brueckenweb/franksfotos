"use client";

import { useState, useRef } from "react";
import { Image as ImageIcon, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
  videoId: number;
  fileUrl: string;
  filename: string;
  albumSlug: string | null;
  /** Wird nach erfolgreichem Upload mit der neuen Thumbnail-URL aufgerufen */
  onDone: (newThumbnailUrl: string) => void;
}

type Status = "idle" | "loading" | "done" | "error";

/**
 * Generiert client-seitig einen Thumbnail-Frame aus dem Video (über den Proxy)
 * und lädt ihn auf den Medienserver hoch.
 */
export default function GenerateThumbnailButton({
  videoId,
  fileUrl,
  filename,
  albumSlug,
  onDone,
}: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement | null>(null);

  async function generate() {
    setStatus("loading");
    setErrorMsg("");

    try {
      // 1. Video über Proxy laden (unsichtbares Element)
      const proxyUrl = `/api/video-download?url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(filename)}&inline=1`;

      const thumbnailBlob = await new Promise<Blob>((resolve, reject) => {
        const video = document.createElement("video");
        video.crossOrigin = "anonymous";
        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;
        videoRef.current = video;

        const timeout = setTimeout(() => {
          reject(new Error("Timeout: Video konnte nicht geladen werden"));
        }, 30000);

        video.addEventListener("error", () => {
          clearTimeout(timeout);
          reject(new Error("Video konnte nicht geladen werden"));
        });

        video.addEventListener("loadedmetadata", () => {
          // Zu 10 % der Dauer oder max. 2 s springen
          video.currentTime = Math.min(2, (video.duration || 0) * 0.1);
        });

        video.addEventListener("seeked", () => {
          clearTimeout(timeout);
          try {
            const w = 480;
            const h = video.videoHeight
              ? Math.round(w * (video.videoHeight / video.videoWidth))
              : 270;

            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (!ctx) { reject(new Error("Canvas nicht verfügbar")); return; }

            ctx.drawImage(video, 0, 0, w, h);
            canvas.toBlob(
              (blob) => blob ? resolve(blob) : reject(new Error("Canvas leer")),
              "image/jpeg",
              0.82
            );
          } catch (e) {
            reject(e);
          }
        });

        video.src = proxyUrl;
      });

      // 2. Thumbnail hochladen
      const thumbFilename = filename.replace(/\.[^/.]+$/, "_thumb.jpg");
      const fd = new FormData();
      fd.append("file", thumbnailBlob, thumbFilename);
      fd.append("target", "videoThumbnails");
      if (albumSlug) fd.append("albumSlug", albumSlug);

      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({ error: "Upload fehlgeschlagen" }));
        throw new Error(err.error ?? "Upload fehlgeschlagen");
      }
      const uploadData = await uploadRes.json();
      const newThumbnailUrl: string = uploadData.fileUrl;

      // 3. DB-Eintrag aktualisieren
      const dbRes = await fetch(`/api/videos/${videoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnailUrl: newThumbnailUrl }),
      });
      if (!dbRes.ok) {
        throw new Error("DB-Update fehlgeschlagen");
      }

      setStatus("done");
      onDone(newThumbnailUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      setErrorMsg(msg);
      setStatus("error");
    } finally {
      // Video-Element aufräumen
      if (videoRef.current) {
        videoRef.current.src = "";
        videoRef.current = null;
      }
    }
  }

  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1 text-green-400 text-xs">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Erstellt
      </span>
    );
  }

  if (status === "error") {
    return (
      <span
        className="inline-flex items-center gap-1 text-red-400 text-xs cursor-pointer hover:text-red-300"
        title={errorMsg}
        onClick={() => setStatus("idle")}
      >
        <AlertCircle className="w-3.5 h-3.5" />
        Fehler
      </span>
    );
  }

  return (
    <button
      onClick={generate}
      disabled={status === "loading"}
      className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-400 disabled:opacity-50 transition-colors"
      title="Thumbnail aus Video generieren"
    >
      {status === "loading" ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <ImageIcon className="w-3.5 h-3.5" />
      )}
      {status === "loading" ? "Generiert…" : "Thumbnail"}
    </button>
  );
}
