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
  Maximize,
  Minimize,
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

  slides.push({
    type: "album-title",
    albumName: data.album.name,
    coverUrl: data.album.coverPhoto?.fileUrl ?? null,
  });

  const total = data.subAlbums.length;

  for (let i = 0; i < total; i++) {
    const sub = data.subAlbums[i];

    slides.push({
      type: "subalbum-title",
      subalbumName: sub.name,
      coverUrl: sub.coverPhoto?.fileUrl ?? null,
      index: i + 1,
      total,
    });

    for (const photo of sub.photos) {
      slides.push({
        type: "photo",
        fileUrl: photo.fileUrl,
        thumbnailUrl: photo.thumbnailUrl,
        title: photo.title,
        filename: photo.filename,
      });
    }

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

  // Controls ein-/ausblenden
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fullscreen
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Audio-Zustand
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [musicIndex, setMusicIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [musicTitle, setMusicTitle] = useState<string | null>(null);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  // ── Controls-Sichtbarkeit ────────────────────────────────────────────────

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
      setShowVolumeSlider(false);
      setShowSettings(false);
    }, 3500);
  }, []);

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
    setControlsVisible(true);
    setOpen(true);
    if (!data) await loadData();
  };

  const closeSlideshow = useCallback(() => {
    setOpen(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    // Fullscreen beenden
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // ── Fullscreen ────────────────────────────────────────────────────────────

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      try {
        await containerRef.current.requestFullscreen();
      } catch {/* ignore */}
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // ── Navigation ────────────────────────────────────────────────────────────

  const goTo = useCallback(
    (index: number) => {
      if (slides.length === 0) return;
      setCurrent((index + slides.length) % slides.length);
    },
    [slides.length]
  );

  const goNext = useCallback(() => { goTo(current + 1); showControls(); }, [current, goTo, showControls]);
  const goPrev = useCallback(() => { goTo(current - 1); showControls(); }, [current, goTo, showControls]);

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

    audio.play().catch(() => {});

    const handleEnded = () => {
      setMusicIndex((i) => (i + 1 >= data.music.length ? 0 : i + 1));
    };
    audio.addEventListener("ended", handleEnded);
    return () => {
      audio.removeEventListener("ended", handleEnded);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, musicIndex, data]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = muted;
    }
  }, [volume, muted]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (paused) {
      audioRef.current.pause();
    } else if (open && data && data.music.length > 0) {
      audioRef.current.play().catch(() => {});
    }
  }, [paused, open, data]);

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
      if (e.key === "Escape" && !document.fullscreenElement) closeSlideshow();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === " ") { e.preventDefault(); setPaused((p) => !p); showControls(); }
      else if (e.key === "m" || e.key === "M") setMuted((m) => !m);
      else if (e.key === "f" || e.key === "F") toggleFullscreen();
      showControls();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, closeSlideshow, goNext, goPrev, showControls, toggleFullscreen]);

  // Scroll sperren
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      showControls();
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, showControls]);

  // ── Aktuelles Unteralbum ermitteln ────────────────────────────────────────

  function getCurrentSubalbumName(): string | null {
    if (!slides.length) return null;
    const slide = slides[current];
    if (slide.type === "album-title") return albumName;
    if (slide.type === "subalbum-title") return slide.subalbumName;
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
            <img src={slide.coverUrl} alt={slide.albumName} className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative text-center px-8">
            <p className="text-amber-400 text-sm font-semibold uppercase tracking-widest mb-3">Gesamtdiashow</p>
            <h1 className="text-4xl sm:text-6xl font-bold text-white drop-shadow-lg">{slide.albumName}</h1>
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
            <img src={slide.coverUrl} alt={slide.subalbumName} className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-black/65" />
          <div className="relative text-center px-8">
            <div className="flex items-center justify-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-widest mb-3">
              <FolderOpen className="w-4 h-4" />
              <span>Album {slide.index} / {slide.total}</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold text-white drop-shadow-lg">{slide.subalbumName}</h2>
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
            <img src={slide.thumbnailUrl} alt={slide.title || slide.filename} className="max-w-full max-h-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-4 text-gray-500">
              <Video className="w-20 h-20" />
              <p className="text-sm">{slide.title || slide.filename}</p>
            </div>
          )}
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
  const hasMusic = !!(data && data.music.length > 0);

  return (
    <>
      {/* ── Trigger-Button ────────────────────────────────────────────────── */}
      <button
        onClick={openSlideshow}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 border border-amber-500/50 text-sm font-medium text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SlidersHorizontal className="w-4 h-4" />}
        Gesamtdiashow starten
      </button>

      {/* ── Modal (Portal) ───────────────────────────────────────────────── */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={containerRef}
            className="fixed inset-0 z-50 bg-black"
            role="dialog"
            aria-modal="true"
            aria-label="Gesamtdiashow"
            onMouseMove={showControls}
            onTouchStart={showControls}
            style={{ cursor: controlsVisible ? "default" : "none" }}
          >
            {/* ── Slide-Bereich ────────────────────────────────────────── */}
            <div className="absolute inset-0">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4 text-gray-500">
                    <Loader2 className="w-10 h-10 animate-spin" />
                    <p className="text-sm">Diashow wird geladen…</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center px-8">
                    <p className="text-red-400 text-sm mb-3">{error}</p>
                    <button onClick={() => loadData()} className="text-xs text-gray-400 hover:text-white underline">
                      Erneut versuchen
                    </button>
                  </div>
                </div>
              )}

              {!loading && !error && slides.map((slide, i) => (
                <div key={i} className={`absolute inset-0 ${i === current ? "" : "pointer-events-none"}`}>
                  {renderSlide(slide, i === current)}
                </div>
              ))}
            </div>

            {/* ── Prev / Next (unsichtbar, volle Höhe) ─────────────────── */}
            {!loading && !error && slides.length > 1 && (
              <>
                <button
                  onClick={goPrev}
                  className={`absolute left-0 top-0 bottom-0 w-16 z-10 flex items-center justify-start pl-3 transition-opacity duration-300 ${controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                  aria-label="Vorherige Folie"
                >
                  <span className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 border border-white/10 flex items-center justify-center text-white">
                    <ChevronLeft className="w-6 h-6" />
                  </span>
                </button>
                <button
                  onClick={goNext}
                  className={`absolute right-0 top-0 bottom-0 w-16 z-10 flex items-center justify-end pr-3 transition-opacity duration-300 ${controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                  aria-label="Nächste Folie"
                >
                  <span className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 border border-white/10 flex items-center justify-center text-white">
                    <ChevronRight className="w-6 h-6" />
                  </span>
                </button>
              </>
            )}

            {/* ── Info oben links (Slide-Zähler + Unteralbum) ───────────── */}
            <div
              className={`absolute top-4 left-4 z-20 flex flex-col gap-1 transition-opacity duration-300 pointer-events-none ${controlsVisible ? "opacity-100" : "opacity-0"}`}
            >
              <span className="text-xs text-gray-400 tabular-nums bg-black/50 rounded px-2 py-0.5 w-fit">
                {current + 1} / {slides.length}
              </span>
              {subalbumName && (
                <span className="text-xs text-amber-400 font-medium bg-black/50 rounded px-2 py-0.5 max-w-[200px] truncate">
                  {subalbumName}
                </span>
              )}
            </div>

            {/* ── Einstellungs-Panel ────────────────────────────────────── */}
            {showSettings && controlsVisible && (
              <div
                className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 bg-black/90 border border-white/10 rounded-xl px-5 py-3 flex flex-wrap items-center gap-5 text-sm text-gray-300 shadow-xl"
                onMouseMove={(e) => e.stopPropagation()}
              >
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

            {/* ── Lautstärke-Slider (über dem Kontrollbalken) ───────────── */}
            {showVolumeSlider && hasMusic && controlsVisible && (
              <div
                className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 bg-black/90 border border-white/10 rounded-xl px-5 py-3 flex items-center gap-3 shadow-xl"
                onMouseMove={(e) => e.stopPropagation()}
              >
                <VolumeX className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(e) => { setVolume(parseFloat(e.target.value)); setMuted(false); }}
                  className="w-32 accent-amber-400"
                />
                <Volume2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-400 w-8 text-right">{Math.round(volume * 100)}%</span>
              </div>
            )}

            {/* ── Musik-Info (über Kontrollbalken, Mitte) ───────────────── */}
            {hasMusic && musicTitle && controlsVisible && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 text-xs text-gray-400 bg-black/50 rounded-full px-3 py-1 pointer-events-none max-w-xs">
                <Music className="w-3 h-3 text-gray-600 flex-shrink-0" />
                <span className="truncate">{musicTitle}</span>
              </div>
            )}

            {/* ── Kontrollbalken unten ──────────────────────────────────── */}
            <div
              className={`absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-300 ${controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            >
              {/* Fortschrittsbalken */}
              {!paused && !loading && !error && (
                <div className="w-full h-0.5 bg-white/10">
                  <div
                    key={`${current}-bar`}
                    className="h-full bg-amber-400 origin-left"
                    style={{ animation: `gesamtSlideshowProgress ${intervalSec}s linear forwards` }}
                  />
                </div>
              )}

              {/* Buttons */}
              <div
                className="flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-t from-black/80 to-transparent"
                onMouseMove={(e) => e.stopPropagation()}
              >
                {/* Lautstärke */}
                {hasMusic && (
                  <button
                    onClick={() => { setShowVolumeSlider((v) => !v); setShowSettings(false); showControls(); }}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors border ${showVolumeSlider ? "bg-amber-500/40 border-amber-500/50" : "bg-black/60 hover:bg-white/20 border-white/20"}`}
                    title="Lautstärke"
                  >
                    {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                )}

                {/* Mute-Toggle */}
                {hasMusic && (
                  <button
                    onClick={() => { setMuted((m) => !m); showControls(); }}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${muted ? "bg-amber-500/20 border-amber-500/50 text-amber-400" : "bg-black/60 border-white/20 text-gray-400 hover:text-white"}`}
                    title={muted ? "Ton einschalten (M)" : "Ton ausschalten (M)"}
                  >
                    {muted ? "Ton ein" : "Stumm"}
                  </button>
                )}

                {/* Pause / Play */}
                <button
                  onClick={() => { setPaused((p) => !p); showControls(); }}
                  className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 border border-white/30 flex items-center justify-center text-white transition-colors shadow-lg"
                  title={paused ? "Fortsetzen (Leertaste)" : "Pausieren (Leertaste)"}
                >
                  {paused ? <Play className="w-5 h-5 ml-0.5" /> : <Pause className="w-5 h-5" />}
                </button>

                {/* Einstellungen */}
                <button
                  onClick={() => { setShowSettings((s) => !s); setShowVolumeSlider(false); showControls(); }}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors border ${showSettings ? "bg-amber-500/40 border-amber-500/50" : "bg-black/60 hover:bg-white/20 border-white/20"}`}
                  title="Einstellungen"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>

                {/* Fullscreen */}
                <button
                  onClick={() => { toggleFullscreen(); showControls(); }}
                  className="w-10 h-10 rounded-full bg-black/60 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-colors"
                  title={isFullscreen ? "Vollbild beenden (F)" : "Vollbild (F)"}
                >
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </button>

                {/* Schließen */}
                <button
                  onClick={closeSlideshow}
                  className="w-10 h-10 rounded-full bg-black/60 hover:bg-red-600/70 border border-white/20 flex items-center justify-center text-white transition-colors"
                  title="Diashow beenden (Escape)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

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
