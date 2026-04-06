"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2 } from "lucide-react";

type Group = { id: number; name: string; slug: string; description: string | null };

export default function NeuerBenutzerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Alle verfügbaren Gruppen aus DB
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  // Vorauswahl: "user"-Gruppe, falls vorhanden
  const [selectedGroupSlugs, setSelectedGroupSlugs] = useState<Set<string>>(new Set(["user"]));

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    isActive: true,
  });

  // Gruppen beim Laden der Seite aus der API holen
  useEffect(() => {
    fetch("/api/groups")
      .then((r) => r.json())
      .then((data) => {
        if (data.groups) setAllGroups(data.groups);
      })
      .catch(() => {/* ignorieren, Fallback: leere Liste */});
  }, []);

  function toggleGroup(slug: string) {
    setSelectedGroupSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          isActive: form.isActive,
          groupSlugs: Array.from(selectedGroupSlugs),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Fehler beim Erstellen");
        return;
      }

      router.push("/admin/benutzer");
      router.refresh();
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/benutzer" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Neuer Benutzer</h1>
          <p className="text-gray-400 text-sm mt-0.5">Benutzer-Konto anlegen</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
            placeholder="Vollständiger Name"
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            E-Mail <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            required
            placeholder="email@beispiel.de"
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Passwort <span className="text-red-400">*</span>
          </label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            required
            placeholder="Sicheres Passwort"
            minLength={8}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
          />
          <p className="text-gray-600 text-xs mt-1">Mindestens 8 Zeichen</p>
        </div>

        {/* Gruppen – dynamisch aus DB */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Gruppen</label>
          {allGroups.length === 0 ? (
            <p className="text-xs text-gray-600">Gruppen werden geladen…</p>
          ) : (
            <div className="space-y-2">
              {allGroups.map((g) => (
                <label key={g.slug} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedGroupSlugs.has(g.slug)}
                    onChange={() => toggleGroup(g.slug)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-amber-500"
                  />
                  <span className="text-gray-300 text-sm font-medium">{g.name}</span>
                  {g.description && (
                    <span className="text-gray-500 text-xs">– {g.description}</span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-amber-500"
            />
            <span className="text-gray-300 text-sm">Konto sofort aktiv</span>
          </label>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Benutzer erstellen
          </button>
          <Link href="/admin/benutzer" className="text-gray-400 hover:text-white text-sm transition-colors">
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  );
}
