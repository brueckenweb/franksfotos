"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function DeletePhotoButton({ photoId }: { photoId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Foto wirklich löschen?")) return;

    setLoading(true);
    try {
      await fetch(`/api/photos/${photoId}`, { method: "DELETE" });
      router.refresh();
    } catch {
      alert("Fehler beim Löschen");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="bg-red-500/90 hover:bg-red-500 text-white rounded-full p-1.5 transition-colors"
      title="Löschen"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Trash2 className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
