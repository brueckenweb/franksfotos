"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Camera, Eye, EyeOff, Loader2, CheckCircle, XCircle } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Kein Reset-Token gefunden. Bitte fordere einen neuen Reset-Link an.");
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Das Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ein Fehler ist aufgetreten.");
      } else {
        setSuccess(true);
        // Nach 3 Sekunden zur Login-Seite weiterleiten
        setTimeout(() => router.push("/login"), 3000);
      }
    } catch {
      setError("Ein unbekannter Fehler ist aufgetreten.");
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

        <div className="bg-gray-900 rounded-2xl p-8 shadow-2xl border border-gray-800">
          <h2 className="text-xl font-semibold text-white mb-6">Neues Passwort vergeben</h2>

          {/* Erfolgsmeldung */}
          {success && (
            <div className="bg-green-900/50 border border-green-700 text-green-300 rounded-lg p-4 flex gap-3 items-start">
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Passwort erfolgreich geändert!</p>
                <p className="text-sm mt-1 text-green-400">
                  Du wirst in Kürze zur Anmeldeseite weitergeleitet…
                </p>
              </div>
            </div>
          )}

          {/* Fehlermeldung ohne Token */}
          {!token && !success && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 rounded-lg p-4 flex gap-3 items-start">
              <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Ungültiger Reset-Link</p>
                <p className="text-sm mt-1 text-red-400">
                  Dieser Link ist ungültig oder abgelaufen.
                </p>
                <a
                  href="/login"
                  className="inline-block mt-3 text-sm text-amber-500 hover:text-amber-400 font-medium"
                >
                  Zur Anmeldung → neuen Link anfordern
                </a>
              </div>
            </div>
          )}

          {/* Formular */}
          {token && !success && (
            <>
              {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-300 rounded-lg p-3 mb-4 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Neues Passwort */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Neues Passwort
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-500"
                      placeholder="Mindestens 8 Zeichen"
                      autoFocus
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
                  <div className="relative">
                    <input
                      type={showPasswordConfirm ? "text" : "password"}
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      required
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-500"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                    >
                      {showPasswordConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Passwort-Match-Indikator */}
                  {passwordConfirm && (
                    <p className={`text-xs mt-1.5 ${password === passwordConfirm ? "text-green-400" : "text-red-400"}`}>
                      {password === passwordConfirm ? "✓ Passwörter stimmen überein" : "✗ Passwörter stimmen nicht überein"}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || password !== passwordConfirm || password.length < 8}
                  className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2.5 transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Passwort wird gespeichert…
                    </>
                  ) : (
                    "Passwort speichern"
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Zurück zur Anmeldung */}
        <div className="text-center mt-4">
          <a href="/login" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
            ← Zurück zur Anmeldung
          </a>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
