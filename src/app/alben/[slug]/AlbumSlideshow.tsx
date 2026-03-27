"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Pause, Play, X, SlidersHorizontal } from "lucide-react";

interface SlideshowPhoto {
  id: number;
  fileUrl: string;
  thumbnailUrl: string | null;
  title: string | null;
  filename: string;
}

interface Props {
  photos: SlideshowPhoto[];
  /** Sekunden pro Bild (Standard: 5) */
  intervalSeconds?: number;
}

/**
 * Diashow als Modal.
 * Zeigt einen "Diashow starten"-Button.
 * Bei Klick öffnet sich ein Vollbild-Modal mit automatischer Weiterschaltung.
 * Bilder werden im Originalformat (object-contain) angezeigt.
 * Nur sichtbar wenn mehr als 3 Fotos vorhanden sind.
 */
export default function AlbumSlideshow({ photos, intervalSeconds = 5 }: Props) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [loaded, setLoaded] = useState<Set<number>>(new Set([0]));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = useCallback(
    (index: number) => {
      const next = (index + photos.length) % photos.length;
      setCurrent(next);
      setLoaded((prev) => new Set(prev).add(next));
    },
    [photos.length]
  );

  const goNext = useCallback(() => goTo(current + 1), [current, goTo]);
  const goPrev = useCallback(() => goTo(current - 1), [current, goTo]);

  const openSlideshow = () => {
    setCurrent(0);
    setLoaded(new Set([0, 1]));
    setPaused(false);
    setOpen(true);
  };

  const closeSlideshow = useCallback(() => {
    setOpen(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // Preload benachbarte Bilder
  useEffect(() => {
    if (!open) return;
    const prev = (current - 1 + photos.length) % photos.length;
    const next = (current + 1) % photos.length;
    setLoaded((s) => new Set(s).add(prev).add(next));
  }, [current, photos.length, open]);

  // Auto-Advance
  useEffect(() => {
    if (!open) return;
    if (paused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setCurrent((c) => {
        const next = (c + 1) % photos.length;
        setLoaded((s) => new Set(s).add(next));
        return next;
      });
    }, intervalSeconds * 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open, paused, intervalSeconds, photos.length]);

  // Tastatur-Steuerung
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSlideshow();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === " ") { e.preventDefault(); setPaused((p) => !p); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, closeSlideshow, goNext, goPrev]);

  // Scroll sperren wenn Modal offen
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (photos.length <= 3) return null;

  const photo = photos[current];

  return (
    <>
      {/* ── Trigger-Button ──────────────────────────────────────────── */}
      <button
        onClick={openSlideshow}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-amber-500/50 text-sm font-medium text-white transition-all mb-4"
      >
        <SlidersHorizontal className="w-4 h-4 text-amber-400" />
        Diashow starten
        <span className="text-gray-500 text-xs">({photos.length} Fotos)</span>
      </button>

      {/* ── Modal (Portal) ──────────────────────────────────────────── */}
      {open && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="Diashow"
        >
          {/* ── Toolbar ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur border-b border-white/10 flex-shrink-0">
            {/* Zähler */}
            <span className="text-sm text-gray-400 tabular-nums">
              {current + 1} / {photos.length}
            </span>

            {/* Titel */}
            <span className="text-sm text-white font-medium truncate max-w-xs sm:max-w-lg text-center">
              {photo.title || photo.filename}
            </span>

            {/* Rechts: Pause + Schließen */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPaused((p) => !p)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                aria-label={paused ? "Diashow fortsetzen" : "Diashow pausieren"}
                title={paused ? "Fortsetzen (Leertaste)" : "Pausieren (Leertaste)"}
              >
                {paused ? <Play className="w-4 h-4 ml-0.5" /> : <Pause className="w-4 h-4" />}
              </button>
              <button
                onClick={closeSlideshow}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                aria-label="Diashow schließen"
                title="Schließen (Escape)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Bild-Bereich ─────────────────────────────────────────── */}
          <div className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden">
            {photos.map((p, i) => (
              <div
                key={p.id}
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-700 ${
                  i === current ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                {loaded.has(i) && (
                  <img
                    src={p.fileUrl}
                    alt={p.title || p.filename}
                    className="max-w-full max-h-full object-contain"
                    style={{ maxHeight: "calc(100vh - 120px)" }}
                    loading={i === 0 ? "eager" : "lazy"}
                  />
                )}
              </div>
            ))}

            {/* Prev-Button */}
            <button
              onClick={goPrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/50 hover:bg-black/80 border border-white/10 flex items-center justify-center text-white transition-colors"
              aria-label="Vorheriges Bild"
              title="Vorheriges Bild (←)"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Next-Button */}
            <button
              onClick={goNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/50 hover:bg-black/80 border border-white/10 flex items-center justify-center text-white transition-colors"
              aria-label="Nächstes Bild"
              title="Nächstes Bild (→)"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* ── Fußzeile: Fortschritts-Balken + Punkte ──────────────── */}
          <div className="flex-shrink-0 pb-safe">
            {/* Fortschritts-Balken */}
            {!paused && (
              <div className="w-full h-0.5 bg-white/10">
                <div
                  key={`${current}-bar`}
                  className="h-full bg-amber-400 origin-left"
                  style={{
                    animation: `slideshowProgress ${intervalSeconds}s linear forwards`,
                  }}
                />
              </div>
            )}

            {/* Punkt-Indikatoren */}
            <div className="flex justify-center gap-1.5 py-3 px-4 flex-wrap">
              {photos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { goTo(i); setPaused(true); }}
                  className={`h-1.5 rounded-full transition-all ${
                    i === current
                      ? "w-5 bg-amber-400"
                      : "w-1.5 bg-white/40 hover:bg-white/70"
                  }`}
                  aria-label={`Bild ${i + 1}`}
                />
              ))}
            </div>
          </div>

          {/* CSS-Animation */}
          <style>{`
            @keyframes slideshowProgress {
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
