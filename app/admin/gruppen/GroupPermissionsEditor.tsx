"use client";

import { useState } from "react";
import { Save, Loader2, CheckCircle2 } from "lucide-react";
import { ALL_PERMISSIONS } from "@/lib/auth/permissions";

interface GroupPermissionsEditorProps {
  groupId: number;
  groupSlug: string;
  initialPermNames: string[];
}

const categoryLabels: Record<string, string> = {
  media: "Medien",
  albums: "Alben",
  admin: "Administration",
  social: "Sozial",
  download: "Downloads",
};

// Rechte nach Kategorie gruppieren
const permsByCategory = ALL_PERMISSIONS.reduce(
  (acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  },
  {} as Record<string, typeof ALL_PERMISSIONS>
);

export default function GroupPermissionsEditor({
  groupId,
  groupSlug,
  initialPermNames,
}: GroupPermissionsEditorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialPermNames));
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState("");

  function toggle(permName: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(permName)) next.delete(permName);
      else next.add(permName);
      return next;
    });
    setSavedOk(false);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSavedOk(false);

    try {
      const res = await fetch(`/api/groups/${groupId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionNames: Array.from(selected) }),
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

  // Admin-Gruppe: keine Bearbeitung
  if (groupSlug === "admin") {
    return null;
  }

  return (
    <div className="border-t border-gray-800 mt-3 pt-4">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">
        Berechtigungen bearbeiten
      </p>

      <div className="space-y-4">
        {Object.entries(permsByCategory).map(([category, perms]) => (
          <div key={category}>
            <p className="text-xs text-gray-600 font-medium uppercase tracking-wide mb-2">
              {categoryLabels[category] || category}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {perms.map((perm) => {
                const active = selected.has(perm.name);
                return (
                  <label
                    key={perm.name}
                    className="flex items-start gap-2.5 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggle(perm.name)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-amber-500 mt-0.5 flex-shrink-0"
                    />
                    <div>
                      <span
                        className={`text-sm transition-colors ${
                          active ? "text-gray-200" : "text-gray-500"
                        }`}
                      >
                        {perm.label}
                      </span>
                      <p className="text-xs text-gray-700 leading-tight">{perm.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-400 mt-3">{error}</p>}

      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? "Wird gespeichert…" : "Speichern"}
        </button>
        {savedOk && (
          <span className="flex items-center gap-1 text-green-400 text-sm">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Gespeichert
          </span>
        )}
        <span className="text-xs text-gray-600 ml-auto">
          {selected.size} Recht{selected.size !== 1 ? "e" : ""} aktiv
        </span>
      </div>
    </div>
  );
}
