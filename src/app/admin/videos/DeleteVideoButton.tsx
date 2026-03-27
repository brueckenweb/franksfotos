"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function DeleteVideoButton({ videoId }: { videoId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Video wirklich löschen?")) return;

    setLoading(true);
    try {
      await fetch(`/api/videos/${videoId}`, { method: "DELETE" });
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
      className="text-gray-400 hover:text-red-400 transition-colors p-1"
      title="Video löschen"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Trash2 className="w-4 h-4" />
      )}
    </button>
  );
}
