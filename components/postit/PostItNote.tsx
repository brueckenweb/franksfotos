"use client";

import { Lock, Globe, UserX } from "lucide-react";

type Sichtbarkeit = "alle" | "angemeldet" | "nicht_angemeldet";

interface PostItNoteProps {
  message: string;
  color: string;
  /** Sichtbarkeit: "alle" | "angemeldet" | "nicht_angemeldet" */
  sichtbarkeit?: Sichtbarkeit;
}

export default function PostItNote({ message, color, sichtbarkeit = "alle" }: PostItNoteProps) {
  const safeColor = ["yellow", "pink", "blue", "green", "orange"].includes(color)
    ? color
    : "yellow";

  return (
    <div className={`postit-note postit-${safeColor} relative`}>
      {/* Pinnadel */}
      <div className="postit-pin" />

      {/* Sichtbarkeits-Badge – nur wenn nicht "alle" */}
      {sichtbarkeit === "angemeldet" && (
        <div
          className="absolute top-2 right-2 flex items-center gap-1 bg-black/20 rounded-full px-1.5 py-0.5"
          title="Nur für angemeldete Nutzer sichtbar"
        >
          <Lock className="w-3 h-3 text-gray-700" />
        </div>
      )}
      {sichtbarkeit === "nicht_angemeldet" && (
        <div
          className="absolute top-2 right-2 flex items-center gap-1 bg-black/20 rounded-full px-1.5 py-0.5"
          title="Nur für Gäste (nicht angemeldet) sichtbar"
        >
          <UserX className="w-3 h-3 text-gray-700" />
        </div>
      )}

      {/* Nachricht – rendert TipTap-HTML */}
      <div
        className="postit-message"
        dangerouslySetInnerHTML={{ __html: message }}
      />
    </div>
  );
}
