"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  X,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  Music,
  FolderOpen,
  Loader2,
  Video,
} from "lucide-react";

// ── Typen ──────────────────────────────────────────────────────────────────

interface CoverPhoto {
  fileUrl: string;
  thumbnailUrl: string | null;
}

interface SubAlbumData {
  id: number;
  name: string;
  coverPhoto: CoverPhoto | null;
  photos: {
    id: number;
    fileUrl: string;
    thumbnailUrl: string | null;
    title: string | null;
    filename: string;
  }[];
  videos: {
    id: number;
    fileUrl: string;
    thumbnailUrl: string | null;
    title: string | null;
    filename: string;
    duration: number | null;
  }[];
}

interface MusicEntry {
  id: number;
  fileUrl: string;
  title: string | null;
  durationSec: number | null;
  sortOrder: number;
}

interface SlideshowData {
  album: {
    id: number;
    name: string;
    coverPhoto: CoverPhoto | null;
  };
  subAlbums: SubAlbumData[];
  music: MusicEntry[];
}

// ── Slide-Typen ────────────────────────────────────────────────────────────

type Slide =
  | { type: "album-title"; albumName: string; coverUrl: string | null }
  | { type: "subalbum-title"; subalbumName: string; coverUrl: string | null; index: number; total: number }
  | { type: "photo"; fileUrl: string; thumbnailUrl: string | null; title: string | null; filename: string }
  | { type: "video"; thumbnailUrl: string | null; title: string | null; filename: string; duration: number | null };

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  albumId: number;
  albumName: string;
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────

function buildSlides(data: SlideshowData): Slide[] {
  const slides: Slide[] = [];

  // 1. Album-Titelfolie
  slides.push({
    type: "album-title",
    albumName: data.album.name,
    coverUrl: data.album.coverPhoto?.fileUrl ?? null,
  });

  const total = data.subAlbums.length;

  for (let i = 0; i < total; i++) {
    const sub = data.subAlbums[i];

    // 2. Unteralbum-Titelfolie
    slides.push({
      type: "subalbum-title",
      subalbumName: sub.name,
      coverUrl: sub.coverPhoto?.fileUrl ?? null,
      index: i + 1,
      total,
    });

    // 3. Fotos des Unteralbums
    for (const photo of sub.photos) {
      slides.push({
        type: "photo",
        fileUrl: photo.fileUrl,
        thumbnailUrl: photo.thumbnailUrl,
        title: photo.title,
        filename: photo.filename,
      });
    }

    // 4. Video-Thumbnails des Unteralbums
    for (const video of sub.videos) {
      slides.push({
        type: "video",
        thumbnailUrl: video.thumbnailUrl,
        title: video.title,
        filename: video.filename,
        duration: video.duration,
      });
    }
  }

  return slides;
}

// ── Komponente ─────────────────────────────────────────────────────────────

export default function AlbumSubalbumSlideshow({ albumId, albumName }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SlideshowData | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);

  // Slideshow-Zustand
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [intervalSec, setIntervalSec] = useState(5);
  const [fadeSec, setFadeSec] = useState(0.7);
  const [showSettings, setShowSettings] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Audio-Zustand
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [musicIndex, setMusicIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [musicTitle, setMusicTitle] = useState<string | null>(null);

  // ── Daten laden ───────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/albums/${albumId}/subalbum-slideshow`);
      if (!res.ok) throw new Error(`Fehler: ${res.status}`);
      const json: SlideshowData = await res.json();
      setData(json);
      setSlides(buildSlides(json));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [albumId]);

  // ── Diashow öffnen / schließen ────────────────────────────────────────────

  const openSlideshow = async () => {
    setCurrent(0);
    setPaused(false);
    setMusicIndex(0);
    setOpen(true);
    if (!data) await loadData();
  };

  const closeSlideshow = useCallback(() => {
    setOpen(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
  }, []);

  // ── Navigation ────────────────────────────────────────────────────────────

  const goTo = useCallback(
    (index: number) => {
      if (slides.length === 0) return;
      setCurrent((index + slides.length) % slides.length);
    },
    [slides.length]
  );

  const goNext = useCallback(() => goTo(current + 1), [current, goTo]);
  const goPrev = useCallback(() => goTo(current - 1), [current, goTo]);

  // ── Auto-Advance ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open || slides.length === 0) return;
    if (paused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % slides.length);
    }, intervalSec * 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open, paused, intervalSec, slides.length]);

  // ── Musik ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open || !data || data.music.length === 0) return;

    const track = data.music[musicIndex % data.music.length];
    if (!track) return;

    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    audio.src = track.fileUrl;
    audio.volume = volume;
    audio.muted = muted;
    setMusicTitle(track.title ?? track.fileUrl.split("/").pop() ?? null);

    audio.play().catch(() => {/* Autoplay-Policy */});

    const handleEnded = () => {
      setMusicIndex((i) => i + 1);
    };
    audio.addEventListener("ended", handleEnded);
    return () => {
      audio.removeEventListener("ended", handleEnded);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, musicIndex, data]);

  // Volume/Mute dynamisch setzen
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = muted;
    }
  }, [volume, muted]);

  // Musik pausieren/fortsetzen mit Diashow
  useEffect(() => {
    if (!audioRef.current) return;
    if (paused) {
      audioRef.current.pause();
    } else if (open && data && data.music.length > 0) {
      audioRef.current.play().catch(() => {});
    }
  }, [paused, open, data]);

  // Audio stoppen wenn Modal schließt
  useEffect(() => {
    if (!open && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
  }, [open]);

  // ── Tastatur ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSlideshow();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === "m" || e.key === "M") {
        setMuted((m) => !m);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, closeSlideshow, goNext, goPrev]);

  // Scroll sperren
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // ── Aktuelles Unteralbum für Toolbar ermitteln ────────────────────────────

  function getCurrentSubalbumName(): string | null {
    if (!slides.length) return null;
    const slide = slides[current];
    if (slide.type === "album-title") return albumName;
    if (slide.type === "subalbum-title") return slide.subalbumName;
    // Rückwärts suchen
    for (let i = current - 1; i >= 0; i--) {
      const s = slides[i];
      if (s.type === "subalbum-title") return s.subalbumName;
      if (s.type === "album-title") return albumName;
    }
    return albumName;
  }

  // ── Slide rendern ─────────────────────────────────────────────────────────

  function renderSlide(slide: Slide, active: boolean) {
    const fadeDuration = `${fadeSec}s`;

    if (slide.type === "album-title") {
      return (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transition: `opacity ${fadeDuration}`, opacity: active ? 1 : 0 }}
        >
          {slide.coverUrl && (
            <img
              src={slide.coverUrl}
              alt={slide.albumName}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative text-center px-8">
            <p className="text-amber-400 text-sm font-semibold uppercase tracking-widest mb-3">
              Gesamtdiashow
            </p>
            <h1 className="text-4xl sm:text-6xl font-bold text-white drop-shadow-lg">
              {slide.albumName}
            </h1>
          </div>
        </div>
      );
    }

    if (slide.type === "subalbum-title") {
      return (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transition: `opacity ${fadeDuration}`, opacity: active ? 1 : 0 }}
        >
          {slide.coverUrl && (
            <img
              src={slide.coverUrl}
              alt={slide.subalbumName}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-black/65" />
          <div className="relative text-center px-8">
            <div className="flex items-center justify-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-widest mb-3">
              <FolderOpen className="w-4 h-4" />
              <span>
                Album {slide.index} / {slide.total}
              </span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold text-white drop-shadow-lg">
              {slide.subalbumName}
            </h2>
          </div>
        </div>
      );
    }

    if (slide.type === "photo") {
      return (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black"
          style={{ transition: `opacity ${fadeDuration}`, opacity: active ? 1 : 0 }}
        >
          {active && (
            <img
              src={slide.fileUrl}
              alt={slide.title || slide.filename}
              className="max-w-full max-h-full object-contain"
              style={{ maxHeight: "calc(100vh - 112px)" }}
            />
          )}
          {slide.title && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-6 py-4 pointer-events-none">
              <p className="text-white text-sm font-medium">{slide.title}</p>
            </div>
          )}
        </div>
      );
    }

    if (slide.type === "video") {
      return (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black"
          style={{ transition: `opacity ${fadeDuration}`, opacity: active ? 1 : 0 }}
        >
          {slide.thumbnailUrl ? (
            <img
              src={slide.thumbnailUrl}
              alt={slide.title || slide.filename}
              className="max-w-full max-h-full object-contain"
              style={{ maxHeight: "calc(100vh - 112px)" }}
            />
          ) : (
            <div className="flex flex-col items-center gap-4 text-gray-500">
              <Video className="w-20 h-20" />
              <p className="text-sm">{slide.title || slide.filename}</p>
            </div>
          )}
          {/* Video-Badge */}
          <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-blue-600/80 rounded-full px-3 py-1.5 text-white text-xs font-semibold pointer-events-none">
            <Video className="w-3.5 h-3.5" />
            Video
            {slide.duration && (
              <span className="ml-1 opacity-75">
                {Math.floor(slide.duration / 60)}:{String(slide.duration % 60).padStart(2, "0")}
              </span>
            )}
          </div>
          {slide.title && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-6 py-4 pointer-events-none">
              <p className="text-white text-sm font-medium">{slide.title}</p>
            </div>
          )}
        </div>
      );
    }

    return null;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const subalbumName = getCurrentSubalbumName();

  return (
    <>
      {/* ── Trigger-Button ────────────────────────────────────────────────── */}
      <button
        onClick={openSlideshow}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 border border-amber-500/50 text-sm font-medium text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <SlidersHorizontal className="w-4 h-4" />
        )}
        Gesamtdiashow starten
      </button>

      {/* ── Modal (Portal) ───────────────────────────────────────────────── */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Gesamtdiashow"
          >
            {/* ── Toolbar ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-4 py-2 bg-black/80 backdrop-blur border-b border-white/10 flex-shrink-0 gap-3">
              {/* Links: Zähler + Unteralbum */}
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs text-gray-400 tabular-nums flex-shrink-0">
                  {current + 1} / {slides.length}
                </span>
                {subalbumName && (
                  <span className="text-xs text-amber-400 truncate max-w-[120px] sm:max-w-xs font-medium">
                    {subalbumName}
                  </span>
                )}
              </div>

              {/* Mitte: Musikinfo */}
              {data && data.music.length > 0 && musicTitle && (
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 min-w-0 max-w-xs truncate">
                  <Music className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                  <span className="truncate">{musicTitle}</span>
                </div>
              )}

              {/* Rechts: Controls */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Lautstärke */}
                {data && data.music.length > 0 && (
                  <>
                    <button
                      onClick={() => setMuted((m) => !m)}
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                      title={muted ? "Ton ein (M)" : "Ton aus (M)"}
                    >
                      {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={volume}
                      onChange={(e) => setVolume(parseFloat(e.target.value))}
                      className="w-16 sm:w-24 accent-amber-400"
                      title="Lautstärke"
                    />
                  </>
                )}

                {/* Einstellungen */}
                <button
                  onClick={() => setShowSettings((s) => !s)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white transition-colors ${showSettings ? "bg-amber-500/40" : "bg-white/10 hover:bg-white/20"}`}
                  title="Einstellungen"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>

                {/* Pause/Play */}
                <button
                  onClick={() => setPaused((p) => !p)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  title={paused ? "Fortsetzen (Leertaste)" : "Pausieren (Leertaste)"}
                >
                  {paused ? <Play className="w-4 h-4 ml-0.5" /> : <Pause className="w-4 h-4" />}
                </button>

                {/* Schließen */}
                <button
                  onClick={closeSlideshow}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  title="Schließen (Escape)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── Einstellungs-Panel ───────────────────────────────────────── */}
            {showSettings && (
              <div className="bg-black/90 border-b border-white/10 px-6 py-3 flex-shrink-0 flex flex-wrap items-center gap-6 text-sm text-gray-300">
                <label className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs">Anzeigedauer:</span>
                  <select
                    value={intervalSec}
                    onChange={(e) => setIntervalSec(Number(e.target.value))}
                    className="bg-gray-800 border border-gray-700 text-white rounded px-2 py-0.5 text-xs"
                  >
                    <option value={3}>3 Sek.</option>
                    <option value={5}>5 Sek.</option>
                    <option value={7}>7 Sek.</option>
                    <option value={10}>10 Sek.</option>
                    <option value={15}>15 Sek.</option>
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs">Überblendung:</span>
                  <select
                    value={fadeSec}
                    onChange={(e) => setFadeSec(Number(e.target.value))}
                    className="bg-gray-800 border border-gray-700 text-white rounded px-2 py-0.5 text-xs"
                  >
                    <option value={0.3}>Schnell (0,3 Sek.)</option>
                    <option value={0.7}>Normal (0,7 Sek.)</option>
                    <option value={1.5}>Langsam (1,5 Sek.)</option>
                  </select>
                </label>
              </div>
            )}

            {/* ── Slide-Bereich ─────────────────────────────────────────────── */}
            <div className="relative flex-1 min-h-0 overflow-hidden bg-black">
              {/* Ladeanzeige */}
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4 text-gray-500">
                    <Loader2 className="w-10 h-10 animate-spin" />
                    <p className="text-sm">Diashow wird geladen…</p>
                  </div>
                </div>
              )}

              {/* Fehleranzeige */}
              {error && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center px-8">
                    <p className="text-red-400 text-sm mb-3">{error}</p>
                    <button
                      onClick={() => loadData()}
                      className="text-xs text-gray-400 hover:text-white underline"
                    >
                      Erneut versuchen
                    </button>
                  </div>
                </div>
              )}

              {/* Slides */}
              {!loading && !error && slides.map((slide, i) => (
                <div key={i} className={`absolute inset-0 ${i === current ? "" : "pointer-events-none"}`}>
                  {renderSlide(slide, i === current)}
                </div>
              ))}

              {/* Prev / Next */}
              {!loading && !error && slides.length > 1 && (
                <>
                  <button
                    onClick={goPrev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/50 hover:bg-black/80 border border-white/10 flex items-center justify-center text-white transition-colors"
                    aria-label="Vorherige Folie"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={goNext}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/50 hover:bg-black/80 border border-white/10 flex items-center justify-center text-white transition-colors"
                    aria-label="Nächste Folie"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}
            </div>

            {/* ── Fußzeile: Fortschrittsbalken ────────────────────────────── */}
            {!loading && !error && (
              <div className="flex-shrink-0">
                {!paused && (
                  <div className="w-full h-0.5 bg-white/10">
                    <div
                      key={`${current}-bar`}
                      className="h-full bg-amber-400 origin-left"
                      style={{
                        animation: `gesamtSlideshowProgress ${intervalSec}s linear forwards`,
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* CSS-Animation */}
            <style>{`
              @keyframes gesamtSlideshowProgress {
                from { transform: scaleX(0); }
                to   { transform: scaleX(1); }
              }
            `}</style>
          </div>,
          document.body
        )}
    </>
  );
}
