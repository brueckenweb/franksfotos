"use client";

import { useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Upload, X, CheckCircle2, AlertCircle, Loader2, Image as ImageIcon, Film, Tag as TagIcon, ChevronDown } from "lucide-react";
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

interface TagItem {
  id: number;
  name: string;
  groupName: string | null;
  groupColor: string | null;
  groupId: number | null;
}

interface TagGroup {
  groupName: string | null;
  groupColor: string | null;
  tags: TagItem[];
}

interface VideoMetadata {
  /** Dauer in Sekunden (gerundet) */
  duration: number | null;
  /** Originalbreite in Pixeln */
  width: number | null;
  /** Originalhöhe in Pixeln */
  height: number | null;
  /** Thumbnail-Blob (JPEG) */
  thumbnailBlob: Blob | null;
}

/**
 * Extrahiert Video-Metadaten (Dauer, Dimensionen) und einen Thumbnail-Frame
 * vollständig client-seitig über das HTMLVideoElement.
 * Gibt null-Werte zurück wenn das Video nicht geladen werden kann.
 */
function extractVideoMetadata(videoFile: File): Promise<VideoMetadata> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(videoFile);
    video.src = url;

    let settled = false;
    const finish = (result: VideoMetadata) => {
      if (!settled) {
        settled = true;
        URL.revokeObjectURL(url);
        resolve(result);
      }
    };

    const empty: VideoMetadata = { duration: null, width: null, height: null, thumbnailBlob: null };

    // Auf Fehler → leere Metadaten zurückgeben
    video.addEventListener("error", () => finish(empty));

    video.addEventListener("loadedmetadata", () => {
      // Zu 10 % der Dauer oder max. 1s springen für den Thumbnail
      video.currentTime = Math.min(1, (video.duration || 0) * 0.1);
    });

    video.addEventListener("seeked", () => {
      const dur = isFinite(video.duration) ? Math.round(video.duration) : null;
      const origW = video.videoWidth || null;
      const origH = video.videoHeight || null;

      try {
        const MAX_W = 480;
        const ratio = (origH ?? 0) / (origW || 1);
        const w = MAX_W;
        const h = Math.round(w * ratio) || Math.round(MAX_W * (9 / 16));

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          finish({ duration: dur, width: origW, height: origH, thumbnailBlob: null });
          return;
        }
        ctx.drawImage(video, 0, 0, w, h);
        canvas.toBlob(
          (blob) => finish({ duration: dur, width: origW, height: origH, thumbnailBlob: blob }),
          "image/jpeg",
          0.82
        );
      } catch {
        finish({ duration: dur, width: origW, height: origH, thumbnailBlob: null });
      }
    });

    // Timeout: nach 10s aufgeben
    setTimeout(() => finish(empty), 10000);
  });
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

  // Tag-State
  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [expandedTagGroups, setExpandedTagGroups] = useState<Set<string>>(new Set());

  const loadAlbums = useCallback(async () => {
    if (albumsLoaded) return;
    try {
      const [albumsRes, tagsRes] = await Promise.all([
        fetch("/api/albums"),
        fetch("/api/tags"),
      ]);
      const albumData = await albumsRes.json();
      setAlbums(albumData.albums || []);
      if (tagsRes.ok) setAllTags(await tagsRes.json());
      setAlbumsLoaded(true);
    } catch {
      console.error("Daten konnten nicht geladen werden");
    }
  }, [albumsLoaded]);

  useState(() => {
    loadAlbums();
  });

  function toggleTag(id: number) {
    setSelectedTagIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function toggleTagGroup(key: string) {
    setExpandedTagGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Tags nach Gruppen sortieren (wie in Foto-Edit-Seite)
  const tagsByGroup = allTags.reduce<Record<string, TagItem[]>>((acc, tag) => {
    const key = tag.groupName ?? "Ohne Gruppe";
    if (!acc[key]) acc[key] = [];
    acc[key].push(tag);
    return acc;
  }, {});

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

        // 3. Video-Metadaten (duration, width, height) + Thumbnail extrahieren
        let videoThumbnailUrl: string | null = uploadData.thumbnailUrl || null;
        let videoDuration: number | null = null;
        let videoWidth: number | null = null;
        let videoHeight: number | null = null;

        if (isVideo) {
          try {
            const meta = await extractVideoMetadata(uploadFile.file);
            videoDuration = meta.duration;
            videoWidth    = meta.width;
            videoHeight   = meta.height;

            // Thumbnail hochladen, falls noch nicht vorhanden
            if (!videoThumbnailUrl && meta.thumbnailBlob) {
              const thumbFileName = uploadData.fileName.replace(/\.[^/.]+$/, "_thumb.jpg");
              const thumbFd = new FormData();
              thumbFd.append("file", meta.thumbnailBlob, thumbFileName);
              thumbFd.append("target", "videoThumbnails");
              if (albumSlug) thumbFd.append("albumSlug", albumSlug);

              const thumbRes = await fetch("/api/upload", {
                method: "POST",
                body: thumbFd,
              });
              if (thumbRes.ok) {
                const thumbData = await thumbRes.json();
                videoThumbnailUrl = thumbData.fileUrl ?? null;
              }
            }
          } catch {
            // Metadaten-Fehler sind nicht kritisch – Video wird trotzdem gespeichert
            console.warn("Video-Metadaten konnten nicht extrahiert werden:", uploadFile.file.name);
          }
        }

        // 4. DB-Eintrag erstellen (90–100%)
        setFiles((prev) =>
          prev.map((f) => (f.id === uploadFile.id ? { ...f, progress: 95 } : f))
        );

        // bnummer aus originalem Dateinamen extrahieren (z.B. B123456.jpg → 123456)
        const bnummerMatch = uploadFile.file.name.match(/^B(\d+)\.[^.]+$/i);
        const bnummer = bnummerMatch ? parseInt(bnummerMatch[1], 10) : null;

        const dbPayload = {
          filename: uploadData.fileName,
          fileUrl: uploadData.fileUrl,
          thumbnailUrl: isVideo ? videoThumbnailUrl : (uploadData.thumbnailUrl || null),
          albumId: selectedAlbumId ? parseInt(selectedAlbumId) : null,
          isPrivate,
          title: uploadFile.file.name.replace(/\.[^/.]+$/, ""),
          description: description.trim() || null,
          exifData: exifData ?? null,
          bnummer,
          // Tags (nur bei Fotos, nicht Videos)
          ...(!isVideo && selectedTagIds.length > 0 ? { tagIds: selectedTagIds } : {}),
          // Video-spezifische Metadaten
          ...(isVideo ? {
            mimeType:  uploadFile.file.type || null,
            fileSize:  uploadFile.file.size,
            duration:  videoDuration,
            width:     videoWidth,
            height:    videoHeight,
          } : {}),
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

  function resetAll() {
    setFiles([]);
    setSelectedAlbumId(initialAlbumId);
    setDescription("");
    setIsPrivate(false);
    setSelectedTagIds([]);
    setExpandedTagGroups(new Set());
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
          <div className="sm:col-span-2">
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
          {/* Tag-Auswahl – Akkordeon-Stil wie in Foto-Edit */}
          {allTags.length > 0 && (
            <div className="sm:col-span-2">
              <label className="block text-sm text-gray-400 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <TagIcon className="w-3.5 h-3.5" />
                  Tags
                  {selectedTagIds.length > 0 && (
                    <span className="ml-1 text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full px-1.5 py-0.5 font-normal">
                      {selectedTagIds.length} ausgewählt
                    </span>
                  )}
                </span>
              </label>
              <div className="border border-gray-700 rounded-lg overflow-hidden">
                {Object.entries(tagsByGroup).map(([groupName, groupTags], idx, arr) => {
                  const isOpen = expandedTagGroups.has(groupName);
                  const selectedCount = groupTags.filter(t => selectedTagIds.includes(t.id)).length;
                  return (
                    <div key={groupName} className={idx < arr.length - 1 ? "border-b border-gray-700" : ""}>
                      {/* Gruppen-Header */}
                      <button
                        type="button"
                        onClick={() => toggleTagGroup(groupName)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-800/60 transition-colors text-left"
                      >
                        <span className="text-sm font-medium text-gray-300">{groupName}</span>
                        <div className="flex items-center gap-2">
                          {selectedCount > 0 && (
                            <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full px-1.5 py-0.5">
                              {selectedCount}
                            </span>
                          )}
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
                          />
                        </div>
                      </button>
                      {/* Tags der Gruppe */}
                      {isOpen && (
                        <div className="px-3 py-2.5 flex flex-wrap gap-2 bg-gray-800/40 border-t border-gray-700">
                          {groupTags.map(tag => {
                            const active = selectedTagIds.includes(tag.id);
                            return (
                              <button
                                key={tag.id}
                                type="button"
                                onClick={() => toggleTag(tag.id)}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                                  active
                                    ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                                    : "bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300"
                                }`}
                              >
                                {tag.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
        <div className="flex flex-col items-center gap-3 py-3">
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">
              {doneCount} Datei{doneCount !== 1 ? "en" : ""} erfolgreich hochgeladen!
            </span>
          </div>
          <button
            onClick={resetAll}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors border border-gray-600"
          >
            <Upload className="w-4 h-4" />
            Neuen Upload starten
          </button>
        </div>
      )}
    </div>
  );
}
