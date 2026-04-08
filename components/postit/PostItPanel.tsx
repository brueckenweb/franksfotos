"use client";

import { useState, useEffect, useCallback } from "react";
import PostItNote from "./PostItNote";

interface PostIt {
  id: number;
  message: string;
  color: string;
  slot: string;
  isActive: boolean;
  sichtbarkeit: string;
  createdAt: string;
}

interface Props {
  /** Eindeutige Kennung der Position, z.B. "home", "alben", "weltreise" */
  slot: string;
  /** Optional: zusätzliche CSS-Klassen für den Container */
  className?: string;
}

export default function PostItPanel({ slot, className = "" }: Props) {
  const [notes, setNotes] = useState<PostIt[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/postit?slot=${encodeURIComponent(slot)}`);
      if (!res.ok) return;
      const data: PostIt[] = await res.json();
      setNotes(data);
    } catch {
      // Fehler still ignorieren – Post-Its sind optional
    } finally {
      setLoading(false);
    }
  }, [slot]);

  useEffect(() => {
    load();
  }, [load]);

  // Nichts rendern während des Ladens oder wenn keine aktiven Post-Its vorhanden
  if (loading || notes.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap gap-6 pt-2 ${className}`}
      aria-label="Haftnotizen"
    >
      {notes.map((note) => (
        <PostItNote
          key={note.id}
          message={note.message}
          color={note.color}
          sichtbarkeit={note.sichtbarkeit as "alle" | "angemeldet" | "nicht_angemeldet"}
        />
      ))}
    </div>
  );
}
