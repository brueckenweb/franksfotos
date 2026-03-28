"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Trash2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ApproveCommentButton({
  commentId,
  isApproved,
}: {
  commentId: number;
  isApproved: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      await fetch(`/api/comments?id=${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isApproved: !isApproved }),
      });
      router.refresh();
    } catch {
      alert("Fehler");
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!confirm("Kommentar wirklich löschen?")) return;
    setLoading(true);
    try {
      await fetch(`/api/comments?id=${commentId}`, { method: "DELETE" });
      router.refresh();
    } catch {
      alert("Fehler beim Löschen");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <Loader2 className="w-4 h-4 animate-spin text-gray-500" />;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={toggle}
        className={`p-1.5 rounded-lg transition-colors ${
          isApproved
            ? "text-green-400 hover:bg-red-500/10 hover:text-red-400"
            : "text-gray-500 hover:bg-green-500/10 hover:text-green-400"
        }`}
        title={isApproved ? "Freigabe zurückziehen" : "Freigeben"}
      >
        {isApproved ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : (
          <XCircle className="w-4 h-4" />
        )}
      </button>
      <button
        onClick={remove}
        className="p-1.5 rounded-lg text-gray-600 hover:bg-red-500/10 hover:text-red-400 transition-colors"
        title="Löschen"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
