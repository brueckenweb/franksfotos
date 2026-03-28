"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Eye, EyeOff, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

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
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess("Registrierung erfolgreich! Sie können sich jetzt anmelden.");
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      } else {
        setError(data.error || "Registrierung fehlgeschlagen.");
      }
    } catch (error) {
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

        {/* Register-Formular */}
        <div className="bg-gray-900 rounded-2xl p-8 shadow-2xl border border-gray-800">
          <h2 className="text-xl font-semibold text-white mb-6">Registrieren</h2>

          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 rounded-lg p-3 mb-4 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-900/50 border border-green-700 text-green-300 rounded-lg p-3 mb-4 text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
      </div>
    </div>
  );
}