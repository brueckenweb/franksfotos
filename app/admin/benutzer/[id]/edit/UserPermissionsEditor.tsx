"use client";

import { useEffect, useState, useCallback } from "react";
import { Save, Loader2, CheckCircle2, RefreshCw, Plus, Minus } from "lucide-react";
import { ALL_PERMISSIONS } from "@/lib/auth/permissions";

// Override-Zustände
// "grant"   → individuell gewähren  (isGranted = true)
// "deny"    → individuell entziehen (isGranted = false)
// "inherit" → kein Override, Gruppenrecht gilt
type OverrideState = "grant" | "deny" | "inherit";

const categoryLabels: Record<string, string> = {
  media: "Medien",
  albums: "Alben",
  admin: "Administration",
  social: "Sozial",
  download: "Downloads",
};

const permsByCategory = ALL_PERMISSIONS.reduce(
  (acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  },
  {} as Record<string, typeof ALL_PERMISSIONS>
);

export default function UserPermissionsEditor({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState("");

  // Welche Rechte kommen aus der Gruppe (Set von permission-names)
  const [groupPerms, setGroupPerms] = useState<Set<string>>(new Set());
  // Aktueller Override-Zustand je Permission
  const [overrides, setOverrides] = useState<Record<string, OverrideState>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/users/${userId}/permissions`);
      if (!res.ok) throw new Error("Laden fehlgeschlagen");
      const data = await res.json();
      setGroupPerms(new Set(data.groupPermissions as string[]));

      // overrides aus API: { permName: true/false }  → OverrideState
      const rawOverrides: Record<string, boolean> = data.overrides ?? {};
      const mapped: Record<string, OverrideState> = {};
      for (const [name, granted] of Object.entries(rawOverrides)) {
        mapped[name] = granted ? "grant" : "deny";
      }
      setOverrides(mapped);
    } catch {
      setError("Berechtigungen konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  function setExplicit(permName: string, state: OverrideState) {
    setSavedOk(false);
    setOverrides((prev) => {
      const updated = { ...prev };
      if (state === "inherit") {
        delete updated[permName];
      } else {
        updated[permName] = state;
      }
      return updated;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSavedOk(false);

    const payload: Record<string, boolean | null> = {};
    for (const perm of ALL_PERMISSIONS) {
      const state = overrides[perm.name];
      if (state === "grant") payload[perm.name] = true;
      else if (state === "deny") payload[perm.name] = false;
      // "inherit" wird nicht mitgeschickt
    }

    try {
      const res = await fetch(`/api/users/${userId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides: payload }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Fehler beim Speichern");
        return;
      }
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setSaving(false);
    }
  }

  // Effektives Recht (nach Merging von Gruppe + Override)
  function effectiveGranted(permName: string): boolean {
    const state = overrides[permName] ?? "inherit";
    if (state === "grant") return true;
    if (state === "deny") return false;
    return groupPerms.has(permName);
  }

  const overrideCount = Object.keys(overrides).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div>
      {/* Legende */}
      <div className="flex flex-wrap items-center gap-4 mb-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-gray-700 inline-block" />
          Über Gruppe geerbt
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-500/80 inline-block" />
          Individuell gewährt
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
          Individuell entzogen
        </span>
      </div>

      <div className="space-y-5">
        {Object.entries(permsByCategory).map(([category, perms]) => (
          <div key={category}>
            <p className="text-xs text-gray-600 font-medium uppercase tracking-wide mb-2.5">
              {categoryLabels[category] || category}
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {perms.map((perm) => {
                const state: OverrideState = overrides[perm.name] ?? "inherit";
                const fromGroup = groupPerms.has(perm.name);
                const effective = effectiveGranted(perm.name);

                // Hintergrundfarbe der Zeile
                let rowBg = "bg-gray-800/30";
                if (state === "grant") rowBg = "bg-green-500/10 border-green-500/20";
                else if (state === "deny") rowBg = "bg-red-500/10 border-red-500/20";
                else if (fromGroup) rowBg = "bg-gray-800/50";

                return (
                  <div
                    key={perm.name}
                    className={`flex items-start gap-3 rounded-lg border border-transparent p-2.5 transition-colors ${rowBg}`}
                  >
                    {/* Status-Indikator */}
                    <div className="mt-0.5 flex-shrink-0">
                      {effective ? (
                        <span
                          className={`w-2.5 h-2.5 rounded-full inline-block mt-0.5 ${
                            state === "grant" ? "bg-green-500" : "bg-gray-500"
                          }`}
                        />
                      ) : (
                        <span
                          className={`w-2.5 h-2.5 rounded-full inline-block mt-0.5 ${
                            state === "deny" ? "bg-red-500" : "bg-gray-700"
                          }`}
                        />
                      )}
                    </div>

                    {/* Name + Beschreibung + Badges */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-sm font-medium ${
                            effective ? "text-gray-200" : "text-gray-500"
                          }`}
                        >
                          {perm.label}
                        </span>
                        {fromGroup && state === "inherit" && (
                          <span className="text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">
                            via Gruppe
                          </span>
                        )}
                        {state === "grant" && (
                          <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">
                            individuell +
                          </span>
                        )}
                        {state === "deny" && (
                          <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">
                            individuell −
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-700 leading-tight mt-0.5">
                        {perm.description}
                      </p>
                    </div>

                    {/* 3-Zustands-Steuerung: [+] [G] [−] */}
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {/* Gewähren */}
                      <button
                        type="button"
                        title="Individuell gewähren"
                        onClick={() =>
                          setExplicit(perm.name, state === "grant" ? "inherit" : "grant")
                        }
                        className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                          state === "grant"
                            ? "bg-green-500 text-white"
                            : "text-gray-600 hover:text-green-400 hover:bg-green-500/10"
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>

                      {/* Erben (Override entfernen) */}
                      <button
                        type="button"
                        title="Gruppenrecht vererben (Override entfernen)"
                        onClick={() => setExplicit(perm.name, "inherit")}
                        className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                          state === "inherit"
                            ? "bg-gray-600 text-white"
                            : "text-gray-700 hover:text-gray-400 hover:bg-gray-700"
                        }`}
                      >
                        <span className="text-[9px] font-bold leading-none">G</span>
                      </button>

                      {/* Entziehen */}
                      <button
                        type="button"
                        title="Individuell entziehen"
                        onClick={() =>
                          setExplicit(perm.name, state === "deny" ? "inherit" : "deny")
                        }
                        className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                          state === "deny"
                            ? "bg-red-500 text-white"
                            : "text-gray-600 hover:text-red-400 hover:bg-red-500/10"
                        }`}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-400 mt-4">{error}</p>}

      <div className="flex items-center gap-3 mt-5">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {saving ? "Wird gespeichert…" : "Rechte speichern"}
        </button>

        <button
          type="button"
          onClick={load}
          title="Neu laden"
          className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-gray-400 hover:bg-gray-800 rounded transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        {savedOk && (
          <span className="flex items-center gap-1 text-green-400 text-sm">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Gespeichert
          </span>
        )}

        <span className="text-xs text-gray-600 ml-auto">
          {overrideCount} individuell{overrideCount !== 1 ? "e" : "r"} Override
          {overrideCount !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
