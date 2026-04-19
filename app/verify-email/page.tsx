"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Camera, CheckCircle2, XCircle, Loader2, Mail } from "lucide-react";
import Link from "next/link";

type Status = "loading" | "success" | "error";

// ── Innere Komponente benötigt Suspense wegen useSearchParams ──────────────────
function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Kein Bestätigungstoken gefunden. Bitte nutze den Link aus deiner E-Mail.");
      return;
    }

    async function verifyToken() {
      try {
        const response = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token as string)}`);
        const data = await response.json();

        if (response.ok) {
          setStatus("success");
          setMessage(data.message || "E-Mail-Adresse erfolgreich bestätigt.");
          setUserName(data.name || "");
        } else {
          setStatus("error");
          setMessage(data.error || "Bestätigung fehlgeschlagen.");
        }
      } catch {
        setStatus("error");
        setMessage("Netzwerkfehler. Bitte versuche es erneut.");
      }
    }

    verifyToken();
  }, [token]);

  return (
    <div className="bg-gray-900 rounded-2xl p-8 shadow-2xl border border-gray-800 text-center">

      {/* Laden */}
      {status === "loading" && (
        <>
          <Loader2 className="w-16 h-16 text-amber-500 mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-semibold text-white mb-2">Bestätigung läuft…</h2>
          <p className="text-gray-400">Deine E-Mail-Adresse wird überprüft.</p>
        </>
      )}

      {/* Erfolg */}
      {status === "success" && (
        <>
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">
            {userName ? `Willkommen, ${userName}! 🎉` : "E-Mail bestätigt! 🎉"}
          </h2>
          <p className="text-gray-300 mb-6">{message}</p>
          <Link
            href="/login"
            className="inline-block bg-amber-500 hover:bg-amber-600 text-white font-medium py-2.5 px-6 rounded-lg transition-colors"
          >
            Jetzt anmelden
          </Link>
        </>
      )}

      {/* Fehler */}
      {status === "error" && (
        <>
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Bestätigung fehlgeschlagen</h2>
          <p className="text-gray-300 mb-6">{message}</p>
          <div className="space-y-3">
            <Link
              href="/register"
              className="block bg-amber-500 hover:bg-amber-600 text-white font-medium py-2.5 px-6 rounded-lg transition-colors"
            >
              Erneut registrieren
            </Link>
            <Link
              href="/login"
              className="block bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2.5 px-6 rounded-lg transition-colors"
            >
              Zur Anmeldung
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

// ── Lade-Fallback ──────────────────────────────────────────────────────────────
function LoadingFallback() {
  return (
    <div className="bg-gray-900 rounded-2xl p-8 shadow-2xl border border-gray-800 text-center">
      <Mail className="w-16 h-16 text-amber-500 mx-auto mb-4 animate-pulse" />
      <h2 className="text-xl font-semibold text-white mb-2">Seite wird geladen…</h2>
      <p className="text-gray-400">Einen Moment bitte.</p>
    </div>
  );
}

// ── Haupt-Export ───────────────────────────────────────────────────────────────
export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500 mb-4">
            <Camera className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">FranksFotos</h1>
          <p className="text-gray-400 mt-1">E-Mail-Bestätigung</p>
        </div>

        {/* Suspense-Wrapper für useSearchParams */}
        <Suspense fallback={<LoadingFallback />}>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
