"use client";

import { useState } from "react";
import { Mail, Send, Users, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export default function AdminEmailPage() {
  const [subject, setSubject] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    sent?: number;
    failed?: number;
    total?: number;
    errors?: string[];
    error?: string;
  } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !htmlContent.trim()) return;

    const confirmed = window.confirm(
      `Möchtest du diese E-Mail wirklich an ALLE aktiven Nutzer senden?\n\nBetreff: ${subject}`
    );
    if (!confirmed) return;

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, htmlContent }),
      });

      const data = await response.json();

      if (!response.ok) {
        setResult({ error: data.error || "Unbekannter Fehler" });
      } else {
        setResult(data);
        if (data.sent > 0) {
          setSubject("");
          setHtmlContent("");
        }
      }
    } catch {
      setResult({ error: "Netzwerkfehler. Bitte versuche es erneut." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Mail className="w-8 h-8 text-amber-400" />
          E-Mail an alle Nutzer
        </h1>
        <p className="text-gray-400 mt-1">
          Verfasse und versende eine E-Mail an alle aktiven Nutzer der Galerie.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Formular */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Send className="w-5 h-5 text-amber-400" />
            E-Mail verfassen
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Betreff */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Betreff *
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="z. B. Neue Fotos online!"
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
              />
            </div>

            {/* Inhalt */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">
                  Inhalt (HTML erlaubt) *
                </label>
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                >
                  {showPreview ? "Vorschau ausblenden" : "Vorschau anzeigen"}
                </button>
              </div>
              <textarea
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                placeholder={`<p>Hallo,</p>\n<p>ich freue mich, euch mitteilen zu können, dass neue Fotos online sind!</p>\n<p>Viel Spaß beim Anschauen,<br>Frank</p>`}
                required
                rows={12}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors font-mono text-sm resize-y"
              />
              <p className="text-xs text-gray-500 mt-1">
                Du kannst HTML-Tags verwenden. Der Inhalt wird automatisch in das FranksFotos-E-Mail-Layout eingebettet.
              </p>
            </div>

            {/* Empfänger-Hinweis */}
            <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <Users className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-blue-300 font-medium">Empfänger</p>
                <p className="text-xs text-blue-400 mt-0.5">
                  Die E-Mail wird an alle <strong>aktiven Nutzer</strong> in der Datenbank gesendet.
                </p>
              </div>
            </div>

            {/* Ergebnis */}
            {result && (
              <div
                className={`rounded-lg p-4 ${
                  result.error
                    ? "bg-red-500/10 border border-red-500/20"
                    : "bg-green-500/10 border border-green-500/20"
                }`}
              >
                {result.error ? (
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-300">{result.error}</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                      <p className="text-sm font-medium text-green-300">
                        Versand abgeschlossen
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-sm mt-3">
                      <div className="bg-gray-800 rounded-lg p-2">
                        <div className="text-2xl font-bold text-green-400">{result.sent}</div>
                        <div className="text-gray-400 text-xs">Gesendet</div>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-2">
                        <div className="text-2xl font-bold text-red-400">{result.failed}</div>
                        <div className="text-gray-400 text-xs">Fehlgeschlagen</div>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-2">
                        <div className="text-2xl font-bold text-gray-300">{result.total}</div>
                        <div className="text-gray-400 text-xs">Gesamt</div>
                      </div>
                    </div>
                    {result.errors && result.errors.length > 0 && (
                      <details className="mt-3">
                        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">
                          Fehlerdetails anzeigen ({result.errors.length})
                        </summary>
                        <ul className="mt-2 space-y-1">
                          {result.errors.map((err, i) => (
                            <li key={i} className="text-xs text-red-400 font-mono">{err}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || !subject.trim() || !htmlContent.trim()}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/40 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-6 py-3 transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Wird gesendet…
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  An alle Nutzer senden
                </>
              )}
            </button>
          </form>
        </div>

        {/* Vorschau */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-6">
            📧 E-Mail-Vorschau
          </h2>
          {showPreview && htmlContent ? (
            <div className="bg-white rounded-lg overflow-hidden">
              {/* Simulierter Email-Header */}
              <div className="bg-[#1a1a2e] p-6">
                <h1 className="text-amber-400 font-bold text-lg m-0">📸 FranksFotos</h1>
              </div>
              <div
                className="p-6 text-sm"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
              <div className="px-6 py-3 bg-gray-50 border-t text-center">
                <p className="text-gray-400 text-xs">
                  FranksFotos · fotos.frank-sellke.de
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-600">
              <Mail className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">
                {!htmlContent
                  ? "Gib einen Inhalt ein, um die Vorschau zu sehen"
                  : "Klicke auf 'Vorschau anzeigen' oben, um die Vorschau zu aktivieren"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
