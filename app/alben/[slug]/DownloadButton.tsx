"use client";

import { Download } from "lucide-react";

export default function DownloadButton({ photoId }: { photoId: number }) {
  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    window.location.href = `/api/download/${photoId}`;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
      title="Herunterladen (mit Wasserzeichen)"
    >
      <Download className="w-3 h-3" />
    </button>
  );
}
