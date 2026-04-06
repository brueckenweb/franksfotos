"use client";

/**
 * ImageCropSelector
 * =================
 * Zeigt ein Bild auf einem Canvas und erlaubt das Ziehen eines Rechtecks
 * zur Auswahl eines Bildausschnitts.
 *
 * Die Crop-Koordinaten werden normalisiert (0–1, relativ zur natürlichen
 * Bildgröße nach EXIF-Rotation) zurückgegeben und können direkt an den
 * lokalen Server übergeben werden.
 */

import { useRef, useEffect, useCallback } from "react";

export interface CropRect {
  x: number; // 0–1 (Anteil der Bildbreite, linke Kante)
  y: number; // 0–1 (Anteil der Bildhöhe, obere Kante)
  w: number; // 0–1 (Anteil der Bildbreite)
  h: number; // 0–1 (Anteil der Bildhöhe)
}

interface Props {
  src:           string;
  isPortrait?:   boolean;
  cropRect:      CropRect | null;
  onCropChange:  (crop: CropRect | null) => void;
  /** Wird nach dem Laden des Bilds mit den natürlichen Dimensionen aufgerufen */
  onImageLoad?:  (naturalWidth: number, naturalHeight: number) => void;
}

export default function ImageCropSelector({ src, isPortrait, cropRect, onCropChange, onImageLoad }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const wrapperRef  = useRef<HTMLDivElement>(null);
  const imgRef      = useRef<HTMLImageElement | null>(null);

  // Aktuelle Auswahl in Canvas-Pixeln (kein State → kein re-render nötig)
  const selRef      = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const dragging    = useRef(false);
  const startPos    = useRef<{ x: number; y: number } | null>(null);

  // ── Canvas zeichnen ─────────────────────────────────────────────────────────
  const paint = useCallback(() => {
    const canvas  = canvasRef.current;
    const img     = imgRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !img || !img.complete || !img.naturalWidth || !wrapper) return;

    const maxW  = wrapper.clientWidth || 560;
    const maxH  = isPortrait ? 500 : 450;
    const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
    const cW    = Math.round(img.naturalWidth  * ratio);
    const cH    = Math.round(img.naturalHeight * ratio);

    if (canvas.width !== cW || canvas.height !== cH) {
      canvas.width  = cW;
      canvas.height = cH;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Bild zeichnen
    ctx.drawImage(img, 0, 0, cW, cH);

    const s = selRef.current;
    if (!s || s.w < 4 || s.h < 4) return;

    // Außenbereich abdunkeln (4 Rechtecke um Auswahl)
    ctx.fillStyle = "rgba(0,0,0,0.52)";
    ctx.fillRect(0,       0,       cW,          s.y);
    ctx.fillRect(0,       s.y,     s.x,         s.h);
    ctx.fillRect(s.x + s.w, s.y,  cW - s.x - s.w, s.h);
    ctx.fillRect(0,       s.y + s.h, cW,        cH - s.y - s.h);

    // Bernsteinfarbener Rahmen
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth   = 2;
    ctx.strokeRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2);

    // Drittel-Linien (Goldener Schnitt)
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth   = 0.8;
    for (let i = 1; i < 3; i++) {
      const xL = s.x + (s.w / 3) * i;
      const yL = s.y + (s.h / 3) * i;
      ctx.beginPath(); ctx.moveTo(xL, s.y);    ctx.lineTo(xL, s.y + s.h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s.x, yL);    ctx.lineTo(s.x + s.w, yL); ctx.stroke();
    }

    // Eckpunkte
    ctx.fillStyle = "#f59e0b";
    for (const [hx, hy] of [
      [s.x,       s.y],
      [s.x + s.w, s.y],
      [s.x,       s.y + s.h],
      [s.x + s.w, s.y + s.h],
    ] as const) {
      ctx.fillRect(hx - 4, hy - 4, 8, 8);
    }

    // Pixel-Dimensionen anzeigen
    if (s.w > 80 && s.h > 25) {
      const pW  = Math.round((s.w / cW) * img.naturalWidth);
      const pH  = Math.round((s.h / cH) * img.naturalHeight);
      const lbl = `${pW} × ${pH} px`;
      ctx.font  = "bold 11px monospace";
      const tw  = ctx.measureText(lbl).width;
      ctx.fillStyle = "rgba(0,0,0,0.78)";
      ctx.fillRect(s.x + 4, s.y + 4, tw + 8, 18);
      ctx.fillStyle = "#f59e0b";
      ctx.fillText(lbl, s.x + 8, s.y + 16);
    }
  }, [isPortrait]);

  // ── Bild laden ──────────────────────────────────────────────────────────────
  useEffect(() => {
    selRef.current = null;
    const img = new window.Image();
    img.onload = () => {
      imgRef.current = img;
      // Portrait-Erkennung an Elternkomponente melden
      onImageLoad?.(img.naturalWidth, img.naturalHeight);
      // Vorhandenes cropRect in Canvas-Pixel übersetzen
      if (cropRect) {
        const canvas  = canvasRef.current;
        const wrapper = wrapperRef.current;
        if (canvas && wrapper) {
          const maxW  = wrapper.clientWidth || 560;
          const maxH  = isPortrait ? 500 : 450;
          const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
          const cW    = Math.round(img.naturalWidth  * ratio);
          const cH    = Math.round(img.naturalHeight * ratio);
          selRef.current = {
            x: cropRect.x * cW,
            y: cropRect.y * cH,
            w: cropRect.w * cW,
            h: cropRect.h * cH,
          };
        }
      }
      paint();
    };
    img.src = src;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // ── Externes cropRect synchronisieren ───────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!cropRect) {
      selRef.current = null;
    } else if (canvas?.width) {
      selRef.current = {
        x: cropRect.x * canvas.width,
        y: cropRect.y * canvas.height,
        w: cropRect.w * canvas.width,
        h: cropRect.h * canvas.height,
      };
    }
    paint();
  }, [cropRect, paint]);

  // ── Mausposition relativ zum Canvas (inkl. CSS-Skalierung) ─────────────────
  const getPos = (e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const r  = canvas.getBoundingClientRect();
    const sx = canvas.width  / r.width;
    const sy = canvas.height / r.height;
    return {
      x: Math.max(0, Math.min(canvas.width,  (e.clientX - r.left) * sx)),
      y: Math.max(0, Math.min(canvas.height, (e.clientY - r.top)  * sy)),
    };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const pos = getPos(e);
    if (!pos) return;
    dragging.current   = true;
    startPos.current   = pos;
    selRef.current     = null;
    onCropChange(null);
    paint();
  };

  // ── Globale Maus-Events für Drag ────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !startPos.current) return;
      const pos = getPos(e);
      if (!pos) return;
      selRef.current = {
        x: Math.min(startPos.current.x, pos.x),
        y: Math.min(startPos.current.y, pos.y),
        w: Math.abs(pos.x - startPos.current.x),
        h: Math.abs(pos.y - startPos.current.y),
      };
      paint();
    };

    const onUp = (e: MouseEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      const canvas = canvasRef.current;
      if (!startPos.current || !canvas?.width) { startPos.current = null; return; }
      const start = startPos.current;
      startPos.current = null;
      const pos = getPos(e);
      if (!pos) { selRef.current = null; paint(); onCropChange(null); return; }
      const x = Math.min(start.x, pos.x);
      const y = Math.min(start.y, pos.y);
      const w = Math.abs(pos.x - start.x);
      const h = Math.abs(pos.y - start.y);
      if (w < 5 || h < 5) { selRef.current = null; paint(); onCropChange(null); return; }
      selRef.current = { x, y, w, h };
      paint();
      onCropChange({
        x: x / canvas.width,
        y: y / canvas.height,
        w: w / canvas.width,
        h: h / canvas.height,
      });
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
  }, [onCropChange, paint]);

  return (
    <div ref={wrapperRef} className={isPortrait ? "flex justify-center" : ""}>
      <canvas
        ref={canvasRef}
        onMouseDown={onMouseDown}
        className="cursor-crosshair rounded-lg bg-gray-800 block"
        style={{ maxWidth: "100%", maxHeight: isPortrait ? 500 : 450 }}
        title="Rechteck ziehen, um einen Bildausschnitt zu wählen"
      />
    </div>
  );
}
