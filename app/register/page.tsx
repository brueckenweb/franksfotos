"use client";

import { useState, useEffect, useRef } from "react";
import { Camera, Eye, EyeOff, Loader2, Mail } from "lucide-react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Bot-Schutz: Zeitstempel des Seitenladens
  const formLoadedAt = useRef<number>(Date.now());

  // Bot-Schutz: Honeypot-Feld (unsichtbar für echte User)
  const [honeypot, setHoneypot] = useState("");

  useEffect(() => {
    formLoadedAt.current = Date.now();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwörter stimmen nicht überein.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
          website: honeypot,              // Honeypot-Feld (Bot-Schutz)
          formLoadedAt: formLoadedAt.current, // Zeitstempel (Bot-Schutz)
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
      } else {
        setError(data.error || "Registrierung fehlgeschlagen.");
      }
    } catch {
      setError("Netzwerkfehler. Bitte versuchen Sie es erneut.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500 mb-4">
            <Camera className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">FranksFotos</h1>
          <p className="text-gray-400 mt-1">Fotogalerie CMS</p>
        </div>

        {/* Erfolgsmeldung nach Registrierung */}
        {success ? (
          <div className="bg-gray-900 rounded-2xl p-8 shadow-2xl border border-gray-800 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-900/50 border border-green-700 mb-4">
              <Mail className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-3">Fast geschafft! 📬</h2>
            <p className="text-gray-300 mb-2">
              Wir haben dir eine Bestätigungsmail an <strong className="text-white">{email}</strong> geschickt.
            </p>
            <p className="text-gray-400 text-sm mb-6">
              Bitte klicke auf den Link in der E-Mail, um deinen Account zu aktivieren.
              Der Link ist <strong className="text-gray-300">24 Stunden</strong> gültig.
            </p>
            <p className="text-gray-500 text-xs">
              Keine E-Mail erhalten? Prüfe deinen Spam-Ordner oder{" "}
              <button
                onClick={() => { setSuccess(false); }}
                className="text-amber-500 hover:text-amber-400 underline"
              >
                registriere dich erneut
              </button>
              .
            </p>
          </div>
        ) : (
          /* Register-Formular */
          <div className="bg-gray-900 rounded-2xl p-8 shadow-2xl border border-gray-800">
            <h2 className="text-xl font-semibold text-white mb-6">Registrieren</h2>

            {error && (
              <div className="bg-red-900/50 border border-red-700 text-red-300 rounded-lg p-3 mb-4 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* ── Bot-Schutz: Honeypot (für User vollständig unsichtbar) ── */}
              <div style={{ position: "absolute", left: "-9999px", top: "-9999px", opacity: 0, pointerEvents: "none" }} aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input
                  id="website"
                  name="website"
                  type="text"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Vollständiger Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-500"
                  placeholder="Max Mustermann"
                />
              </div>

              {/* E-Mail */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  E-Mail-Adresse
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-500"
                  placeholder="max@example.de"
                />
              </div>

              {/* Passwort */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Passwort
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-500"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Passwort bestätigen */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Passwort bestätigen
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-500"
                  placeholder="••••••••"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Registriere...
                  </>
                ) : (
                  "Registrieren"
                )}
              </button>
            </form>

            {/* Link zu Login */}
            <div className="mt-6 text-center">
              <p className="text-gray-400 text-sm">
                Bereits ein Konto?{" "}
                <a
                  href="/login"
                  className="text-amber-500 hover:text-amber-400 font-medium"
                >
                  Hier anmelden
                </a>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
