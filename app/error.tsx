"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Globaler Fehler:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-8">
      <div className="max-w-2xl w-full bg-gray-900 border border-red-500/30 rounded-2xl p-8">
        <h2 className="text-2xl font-bold text-red-400 mb-4">⚠️ Fehler auf dieser Seite</h2>
        <p className="text-gray-400 mb-4">
          Es ist ein unerwarteter Fehler aufgetreten:
        </p>
        <pre className="bg-gray-800 rounded-lg p-4 text-sm text-red-300 overflow-auto mb-4 whitespace-pre-wrap break-all">
          {error?.message || "Unbekannter Fehler"}
          {error?.digest ? `\n\nDigest: ${error.digest}` : ""}
        </pre>
        <p className="text-gray-500 text-sm mb-6">
          Stack: <span className="text-gray-400">{error?.stack?.split("\n").slice(0, 3).join(" | ")}</span>
        </p>
        <button
          onClick={reset}
          className="bg-amber-500 hover:bg-amber-400 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          Erneut versuchen
        </button>
      </div>
    </div>
  );
}
