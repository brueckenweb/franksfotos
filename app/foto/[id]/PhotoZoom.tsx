"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ZoomIn } from "lucide-react";

interface Props {
  src: string;
  alt: string;
}

export default function PhotoZoom({ src, alt }: Props) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handler);
    // Scroll verhindern, wenn Lightbox offen
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, close]);

  return (
    <>
      {/* Klickbares Vorschaubild */}
      <div
        className="relative group cursor-zoom-in"
        onClick={() => setOpen(true)}
        role="button"
        aria-label="Bild vergrößern"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setOpen(true)}
      >
        <img
          src={src}
          alt={alt}
          className="w-full h-auto max-h-[75vh] object-contain"
          style={{ background: "#0a0a0a" }}
        />
        {/* Zoom-Overlay-Hinweis */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="bg-black/60 rounded-full p-3 shadow-lg">
            <ZoomIn className="w-7 h-7 text-white" />
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Bildansicht"
        >
          {/* Schließen-Button */}
          <button
            className="absolute top-4 right-4 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            onClick={close}
            aria-label="Schließen"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Vollbild-Bild */}
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-full object-contain select-none"
            style={{ maxWidth: "95vw", maxHeight: "95vh" }}
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />

          {/* Hinweis zum Schließen */}
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-xs pointer-events-none">
            Klicken oder ESC zum Schließen
          </p>
        </div>
      )}
    </>
  );
}
