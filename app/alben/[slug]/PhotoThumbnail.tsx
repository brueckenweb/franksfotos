"use client";

import { useState } from "react";
import { Camera } from "lucide-react";

interface Props {
  thumbnailUrl: string | null;
  fileUrl: string;
  alt: string;
}

/**
 * Zeigt zuerst thumbnailUrl, fällt bei Ladefehler auf fileUrl zurück,
 * und zeigt bei totalem Ausfall das Camera-Icon als Platzhalter.
 */
export default function PhotoThumbnail({ thumbnailUrl, fileUrl, alt }: Props) {
  const initialSrc = thumbnailUrl || fileUrl;
  const [src, setSrc] = useState(initialSrc);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Camera className="w-8 h-8 text-gray-600" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      loading="lazy"
      onError={() => {
        // Thumbnail hat nicht geladen → fileUrl versuchen
        if (thumbnailUrl && src === thumbnailUrl && fileUrl && fileUrl !== thumbnailUrl) {
          setSrc(fileUrl);
        } else {
          // Auch fileUrl fehlgeschlagen → Platzhalter zeigen
          setFailed(true);
        }
      }}
    />
  );
}
