"use client";

import { useState, useEffect, useCallback } from "react";
import { BookOpen, Send, Loader2, AlertCircle } from "lucide-react";

interface GuestbookEntry {
  id: number;
  message: string;
  createdAt: string;
  userName: string;
  userId: number;
}

interface Props {
  /** Name des aktuell eingeloggten Users (null = nicht eingeloggt) */
  currentUserName: string | null;
}

export default function GuestbookPanel({ currentUserName }: Props) {
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [message,    setMessage]    = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitErr,  setSubmitErr]  = useState<string | null>(null);
  const [submitOk,   setSubmitOk]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/guestbook");
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Fehler"); return; }
      setEntries(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    setSubmitErr(null);
    setSubmitOk(false);
    try {
      const res = await fetch("/api/guestbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitErr(data.error ?? "Fehler"); return; }
      setMessage("");
      setSubmitOk(true);
      await load();
      setTimeout(() => setSubmitOk(false), 3000);
    } catch (e) {
      setSubmitErr(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  function formatDatum(raw: string) {
    try {
      // MySQL-Timestamps haben kein "Z"-Suffix → als UTC normalisieren
      const normalized =
        raw && !raw.includes("Z") && !raw.includes("+")
          ? raw.replace(" ", "T") + "Z"
          : raw;
      return new Date(normalized).toLocaleString("de-DE", {
        day:    "2-digit",
        month:  "2-digit",
        year:   "numeric",
        hour:   "2-digit",
        minute: "2-digit",
      });
    } catch {
      return raw;
    }
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3">
          <div className="bg-amber-500/10 rounded-lg p-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold">Gästebuch</h2>
            <p className="text-gray-500 text-xs">
              {entries.length > 0
                ? `${entries.length} Eintrag${entries.length !== 1 ? "einträge" : ""}`
                : "Noch keine Einträge"}
            </p>
          </div>
        </div>

        {/* Formular (nur wenn eingeloggt) */}
        {currentUserName ? (
          <form onSubmit={handleSubmit} className="px-6 py-4 border-b border-gray-800 bg-gray-800/30">
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 text-sm font-bold flex-shrink-0 mt-0.5">
                {currentUserName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={`Hinterlasse einen Eintrag, ${currentUserName}…`}
                  rows={3}
                  maxLength={1000}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500 resize-none"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-gray-600 text-xs">{message.length}/1000</span>
                  <div className="flex items-center gap-3">
                    {submitErr && (
                      <span className="text-red-400 text-xs flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />{submitErr}
                      </span>
                    )}
                    {submitOk && (
                      <span className="text-green-400 text-xs">✓ Eingetragen!</span>
                    )}
                    <button
                      type="submit"
                      disabled={submitting || !message.trim()}
                      className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/40 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    >
                      {submitting
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Send className="w-3.5 h-3.5" />}
                      Eintragen
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </form>
        ) : (
          <div className="px-6 py-4 border-b border-gray-800 bg-gray-800/20 text-center">
            <p className="text-gray-500 text-sm">
              <a href="/login" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">
                Anmelden
              </a>{" "}
              um einen Eintrag zu hinterlassen
            </p>
          </div>
        )}

        {/* Einträge */}
        <div className="divide-y divide-gray-800/60">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 text-amber-400 animate-spin mr-2" />
              <span className="text-gray-400 text-sm">Lade…</span>
            </div>
          ) : error ? (
            <div className="px-6 py-6 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />{error}
            </div>
          ) : entries.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-500 text-sm">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
              Noch keine Einträge – sei der Erste!
            </div>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="px-6 py-4 flex items-start gap-3">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 text-sm font-bold flex-shrink-0">
                  {entry.userName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-white text-sm font-medium">{entry.userName}</span>
                    <span className="text-gray-600 text-xs">{formatDatum(entry.createdAt)}</span>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {entry.message}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
