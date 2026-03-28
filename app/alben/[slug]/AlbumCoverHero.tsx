"use client";

import { useState } from "react";

interface Props {
  /** Vollbild-URL (bevorzugt für Hero) */
  fileUrl: string;
  /** Thumbnail als Fallback */
  thumbnailUrl: string | null;
  alt: string;
}

/**
 * Hero-Banner für das Album-Cover.
 * Nutzt fileUrl (Originalbild) direkt – thumbnailUrl wird ignoriert,
 * da der /thumbs/-Ordner auf dem Server nicht existiert.
 * Bei Ladefehler oder fehlendem fileUrl wird nichts gerendert.
 */
export default function AlbumCoverHero({ fileUrl, alt }: Props) {
  const [failed, setFailed] = useState(!fileUrl);

  if (!fileUrl || failed) return null;

  return (
    <div className="relative w-full h-48 sm:h-64 lg:h-72 rounded-2xl overflow-hidden mb-6 bg-gray-900 flex-shrink-0">
      <img
        src={fileUrl}
        alt={alt}
        className="w-full h-full object-cover"
        onError={() => setFailed(true)}
      />
      {/* Gradient-Overlay für bessere Lesbarkeit des Texts darunter */}
      <div className="absolute inset-0 bg-gradient-to-t from-gray-950/70 via-transparent to-transparent pointer-events-none" />
    </div>
  );
}
