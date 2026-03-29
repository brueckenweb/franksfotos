"use client";

import { useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Upload, X, CheckCircle2, AlertCircle, Loader2, Image as ImageIcon, Film } from "lucide-react";
import AlbumTreeSelect from "../alben/AlbumTreeSelect";
import exifr from "exifr";

interface UploadFile {
  file: File;
  id: string;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  fileUrl?: string;
}

interface Album {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
}

/** Upload mit echtem XHR-Fortschritt (0–90% = Dateiübertragung, 90–100% = DB) */
function uploadWithProgress(
  file: File,
  target: string,
  albumSlug: string,
  onProgress: (pct: number) => void
): Promise<{ fileName: string; fileUrl: string; thumbnailUrl?: string }> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("target", target);
    fd.append("generateUniqueName", "true");
    if (albumSlug) fd.append("albumSlug", albumSlug);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 90));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Ungültige Server-Antwort"));
        }
      } else {
        try {
          reject(new Error(JSON.parse(xhr.responseText).error ?? "Upload fehlgeschlagen"));
        } catch {
          reject(new Error(`Fehler HTTP ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Netzwerkfehler beim Upload")));
    xhr.addEventListener("abort", () => reject(new Error("Upload abgebrochen")));

    xhr.open("POST", "/api/upload");
    xhr.send(fd);
  });
}

export default function AdminUploadPage() {
  const searchParams = useSearchParams();
  const initialAlbumId = searchParams.get("albumId") ?? "";

  const [files, setFiles] = useState<UploadFile[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>(initialAlbumId);
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [albumsLoaded, setAlbumsLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadAlbums = useCallback(async () => {
    if (albumsLoaded) return;
    try {
      const res = await fetch("/api/albums");
      const data = await res.json();
      setAlbums(data.albums || []);
      setAlbumsLoaded(true);
    } catch {
      console.error("Alben konnten nicht geladen werden");
    }
  }, [albumsLoaded]);

  useState(() => {
    loadAlbums();
  });

  function addFiles(newFiles: FileList | File[]) {
    const arr = Array.from(newFiles);
    const toAdd: UploadFile[] = arr
      .filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"))
      .map((f) => ({
        file: f,
        id: Math.random().toString(36).slice(2),
        status: "pending" as const,
        progress: 0,
      }));
    setFiles((prev) => [...prev, ...toAdd]);
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  }

  async function uploadAll() {
    const pending = files.filter((f) => f.status === "pending");
    if (pending.length === 0) return;

    setUploading(true);

    for (const uploadFile of pending) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, status: "uploading", progress: 0 } : f
        )
      );

      try {
        const isVideo = uploadFile.file.type.startsWith("video/");
        const target = isVideo ? "videos" : "photos";

        // Album-Slug aus gewähltem Album ermitteln
        const selectedAlbum = albums.find((a) => String(a.id) === selectedAlbumId);
        const albumSlug = selectedAlbum?.slug ?? "";

        // 1. Datei hochladen mit echtem Fortschritt (0–90%)
        const uploadData = await uploadWithProgress(
          uploadFile.file,
          target,
          albumSlug,
          (pct) => {
            setFiles((prev) =>
              prev.map((f) => (f.id === uploadFile.id ? { ...f, progress: pct } : f))
            );
          }
        );

        // 2. EXIF-Daten aus Bild extrahieren (nur für Fotos)
        let exifData: Record<string, unknown> | null = null;
        if (!isVideo) {
          try {
            exifData = await exifr.parse(uploadFile.file, {
              tiff: true,
              exif: true,
              gps: true,
              ifd1: false,
              translateValues: true,
              translateKeys: true,
              reviveValues: true,
            }) ?? null;
          } catch {
            // EXIF-Fehler sind nicht kritisch
            console.warn("EXIF konnte nicht gelesen werden:", uploadFile.file.name);
          }
        }

        // 3. DB-Eintrag erstellen (90–100%)
        setFiles((prev) =>
          prev.map((f) => (f.id === uploadFile.id ? { ...f, progress: 95 } : f))
        );

        // bnummer aus originalem Dateinamen extrahieren (z.B. B123456.jpg → 123456)
        const bnummerMatch = uploadFile.file.name.match(/^B(\d+)\.[^.]+$/i);
        const bnummer = bnummerMatch ? parseInt(bnummerMatch[1], 10) : null;

        const dbPayload = {
          filename: uploadData.fileName,
          fileUrl: uploadData.fileUrl,
          thumbnailUrl: uploadData.thumbnailUrl || null,
          albumId: selectedAlbumId ? parseInt(selectedAlbumId) : null,
          isPrivate,
          title: uploadFile.file.name.replace(/\.[^/.]+$/, ""),
          description: description.trim() || null,
          exifData: exifData ?? null,
          bnummer,
        };

        const dbRes = await fetch(`/api/${isVideo ? "videos" : "photos"}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dbPayload),
        });

        if (!dbRes.ok) {
          const err = await dbRes.json();
          throw new Error(err.error || "DB-Eintrag fehlgeschlagen");
        }

        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id
              ? { ...f, status: "done", progress: 100, fileUrl: uploadData.fileUrl }
              : f
          )
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unbekannter Fehler";
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id ? { ...f, status: "error", error: message } : f
          )
        );
      }
    }

    setUploading(false);
  }

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const doneCount = files.filter((f) => f.status === "done").length;
  const errorCount = files.filter((f) => f.status === "error").length;
  const uploadingCount = files.filter((f) => f.status === "uploading").length;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Upload</h1>
        <p className="text-gray-400 text-sm mt-0.5">Fotos und Videos hochladen</p>
      </div>

      {/* Einstellungen */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Upload-Einstellungen</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Album</label>
            {/* Einklappbares Baummenü statt flachem select */}
            <AlbumTreeSelect
              albums={albums}
              value={selectedAlbumId}
              onChange={setSelectedAlbumId}
              noSelectionLabel="Kein Album (ohne Zuordnung)"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2.5 cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-amber-500"
              />
              <span className="text-sm text-gray-300">Privat (nur für mich sichtbar)</span>
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm text-gray-400 mb-1.5">
              Beschreibung{" "}
              <span className="text-gray-600 text-xs">(optional – gilt für alle Dateien dieser Upload-Session)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kurzbeschreibung des Fotos / der Fotos…"
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600 resize-none"
            />
          </div>
        </div>
      </div>

      {/* Dropzone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-700 hover:border-amber-500/50 rounded-xl p-12 text-center cursor-pointer transition-colors mb-4 bg-gray-900/50"
      >
        <Upload className="w-10 h-10 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400 font-medium">Dateien hierher ziehen</p>
        <p className="text-gray-600 text-sm mt-1">oder klicken zum Auswählen</p>
        <p className="text-gray-700 text-xs mt-2">
          JPG, PNG, WebP, HEIC, MP4, MOV, AVI (max. 50 MB / 500 MB)
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {/* Dateiliste */}
      {files.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <span className="text-sm text-gray-400">
              {files.length} Datei{files.length !== 1 ? "en" : ""}
              {uploadingCount > 0 && (
                <span className="ml-2 text-amber-400">• {uploadingCount} lädt hoch</span>
              )}
              {doneCount > 0 && (
                <span className="ml-2 text-green-400">• {doneCount} fertig</span>
              )}
              {errorCount > 0 && (
                <span className="ml-2 text-red-400">• {errorCount} Fehler</span>
              )}
            </span>
            <button
              onClick={() => setFiles([])}
              className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
            >
              Alle entfernen
            </button>
          </div>
          <div className="divide-y divide-gray-800/50 max-h-96 overflow-y-auto">
            {files.map((f) => {
              const isVideo = f.file.type.startsWith("video/");
              return (
                <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center flex-shrink-0">
                    {isVideo ? (
                      <Film className="w-4 h-4 text-blue-400" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-amber-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-300 truncate">{f.file.name}</p>
                      {/^B(\d+)\.[^.]+$/i.test(f.file.name) && (
                        <span className="flex-shrink-0 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded px-1.5 py-0.5 font-mono">
                          B{f.file.name.match(/^B(\d+)/i)![1]}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600">
                      {(f.file.size / (1024 * 1024)).toFixed(1)} MB
                    </p>
                    {f.status === "uploading" && (
                      <div className="mt-1.5">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-amber-400">
                            {f.progress < 90 ? "Wird übertragen…" : "Wird gespeichert…"}
                          </span>
                          <span className="text-xs text-gray-500">{f.progress}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${f.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {f.status === "done" && (
                      <p className="text-xs text-green-500 mt-0.5">Erfolgreich hochgeladen</p>
                    )}
                    {f.status === "error" && (
                      <p className="text-xs text-red-400 mt-0.5">{f.error}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {f.status === "pending" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(f.id);
                        }}
                        className="text-gray-600 hover:text-gray-300 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    {f.status === "uploading" && (
                      <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                    )}
                    {f.status === "done" && (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    )}
                    {f.status === "error" && (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload-Button */}
      {pendingCount > 0 && (
        <button
          onClick={uploadAll}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded-xl px-4 py-3 font-medium transition-colors"
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Upload className="w-5 h-5" />
          )}
          {uploading
            ? "Hochladen…"
            : `${pendingCount} Datei${pendingCount !== 1 ? "en" : ""} hochladen`}
        </button>
      )}

      {doneCount > 0 && !uploading && pendingCount === 0 && (
        <div className="flex items-center gap-2 text-green-400 justify-center py-3">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">
            {doneCount} Datei{doneCount !== 1 ? "en" : ""} erfolgreich hochgeladen!
          </span>
        </div>
      )}
    </div>
  );
}
