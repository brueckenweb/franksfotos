"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";

interface LikeButtonProps {
  photoId: number;
  initialLikeCount: number;
  initialHasLiked: boolean;
  isLoggedIn: boolean;
}

export default function LikeButton({
  photoId,
  initialLikeCount,
  initialHasLiked,
  isLoggedIn,
}: LikeButtonProps) {
  const [hasLiked, setHasLiked] = useState(initialHasLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLike() {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    if (loading) return;

    setLoading(true);
    try {
      const method = hasLiked ? "DELETE" : "POST";
      const res = await fetch("/api/likes", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId }),
      });

      if (res.ok) {
        setHasLiked(!hasLiked);
        setLikeCount((prev) => (hasLiked ? prev - 1 : prev + 1));
      }
    } catch {
      // Fehler ignorieren
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleLike}
      disabled={loading}
      title={isLoggedIn ? (hasLiked ? "Like entfernen" : "Gefällt mir") : "Anmelden zum Liken"}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors border ${
        hasLiked
          ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30"
          : "bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700"
      } disabled:opacity-60 disabled:cursor-not-allowed`}
    >
      <Heart
        className={`w-4 h-4 transition-transform ${loading ? "scale-90" : ""} ${
          hasLiked ? "fill-red-400" : ""
        }`}
      />
      <span>{likeCount}</span>
    </button>
  );
}
