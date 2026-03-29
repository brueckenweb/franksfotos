"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { deleteGroup } from "./actions";

interface DeleteGroupButtonProps {
  groupId: number;
  groupName: string;
}

export default function DeleteGroupButton({ groupId, groupName }: DeleteGroupButtonProps) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setError("");
    startTransition(async () => {
      const result = await deleteGroup(groupId);
      if (result?.error) {
        setError(result.error);
        setConfirm(false);
      }
    });
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-2">
        {error && <span className="text-xs text-red-400">{error}</span>}
        <span className="text-xs text-gray-400">Sicher?</span>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="flex items-center gap-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded px-2 py-1 text-xs transition-colors"
        >
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          Löschen
        </button>
        <button
          onClick={() => setConfirm(false)}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Abbrechen
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      title={`Gruppe „${groupName}" löschen`}
      className="text-gray-600 hover:text-red-400 transition-colors"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
