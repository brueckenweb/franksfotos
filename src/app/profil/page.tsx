"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { User, Mail, Shield, LogOut, Save, Loader2, Key } from "lucide-react";

export default function ProfilPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    newPassword: "",
    currentPassword: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
    if (session?.user) {
      setForm((p) => ({
        ...p,
        name: session.user.name || "",
        email: session.user.email || "",
      }));
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!session?.user) return null;

  const userId = (session.user as { id?: string }).id;
  const isMainAdmin = (session.user as { isMainAdmin?: boolean }).isMainAdmin;
  const userGroups = (session.user as { groups?: string[] }).groups ?? [];

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload: Record<string, string> = {};
      if (form.name !== session!.user.name) payload.name = form.name;
      if (form.newPassword) payload.password = form.newPassword;

      if (Object.keys(payload).length === 0) {
        setSaving(false);
        return;
      }

      const res = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Fehler beim Speichern");
        return;
      }

      setSuccess("Profil gespeichert! Bitte neu anmelden wenn du das Passwort geändert hast.");
      setForm((p) => ({ ...p, newPassword: "", currentPassword: "" }));
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold">Mein Profil</h1>
          <button
            onClick={() => router.push("/")}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            Zurück
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profil-Karte */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500/30 flex items-center justify-center mb-3">
                <span className="text-2xl font-bold text-amber-400">
                  {session.user.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <h2 className="text-white font-semibold">{session.user.name}</h2>
              <p className="text-gray-500 text-sm">{session.user.email}</p>

              {/* Badges */}
              <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                {isMainAdmin && (
                  <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs px-2 py-0.5 rounded-full">
                    Hauptadmin
                  </span>
                )}
                {userGroups.map((g) => (
                  <span
                    key={g}
                    className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded-full"
                  >
                    {g}
                  </span>
                ))}
              </div>

              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="mt-4 flex items-center gap-2 text-gray-500 hover:text-red-400 text-sm transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Abmelden
              </button>
            </div>
          </div>

          {/* Profil-Bearbeiten */}
          <div className="md:col-span-2">
            <form
              onSubmit={handleSave}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4"
            >
              <h3 className="text-sm font-semibold text-gray-300">Profil bearbeiten</h3>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg px-4 py-3 text-sm">
                  {success}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  <User className="w-3.5 h-3.5 inline mr-1.5" />
                  Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  <Mail className="w-3.5 h-3.5 inline mr-1.5" />
                  E-Mail
                </label>
                <input
                  type="email"
                  value={form.email}
                  disabled
                  className="w-full bg-gray-800/50 border border-gray-700 text-gray-500 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
                />
                <p className="text-gray-600 text-xs mt-1">E-Mail kann nicht geändert werden</p>
              </div>

              <div className="pt-2 border-t border-gray-800">
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  <Key className="w-3.5 h-3.5 inline mr-1.5" />
                  Neues Passwort <span className="text-gray-600 font-normal">(optional)</span>
                </label>
                <input
                  type="password"
                  value={form.newPassword}
                  onChange={(e) => setForm((p) => ({ ...p, newPassword: e.target.value }))}
                  placeholder="Neues Passwort (min. 8 Zeichen)"
                  minLength={8}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
