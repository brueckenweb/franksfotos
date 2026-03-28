"use client";

import { useState, useEffect } from "react";
import { X, Plus, Loader2, Layers, Tag } from "lucide-react";

// ─── Konstanten ───────────────────────────────────────────────────────────────

const COLOR_PRESETS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899",
  "#6b7280", "#78350f", "#134e4a", "#1e1b4b",
];

// ─── Typen ────────────────────────────────────────────────────────────────────

interface TagGroup {
  id: number;
  name: string;
  color: string;
}

export interface CreatedTag {
  id: number;
  name: string;
  slug: string;
  groupId?: number | null;
  groupName?: string | null;
  groupColor?: string | null;
}

interface CreateTagModalProps {
  onClose: () => void;
  /** Wird aufgerufen nachdem ein Tag erstellt wurde – der Tag wird direkt zum Foto hinzugefügt */
  onTagCreated: (tag: CreatedTag) => void;
}

// ─── Komponente ───────────────────────────────────────────────────────────────

export default function CreateTagModal({ onClose, onTagCreated }: CreateTagModalProps) {
  const [activeTab, setActiveTab] = useState<"tag" | "group">("tag");
  const [groups, setGroups] = useState<TagGroup[]>([]);

  // Neuer Tag
  const [tagName, setTagName] = useState("");
  const [tagGroupId, setTagGroupId] = useState<number | "">("");
  const [tagSaving, setTagSaving] = useState(false);
  const [tagError, setTagError] = useState("");

  // Neue Gruppe
  const [groupName, setGroupName] = useState("");
  const [groupColor, setGroupColor] = useState("#3b82f6");
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupError, setGroupError] = useState("");
  const [groupSuccess, setGroupSuccess] = useState("");

  useEffect(() => {
    loadGroups();
  }, []);

  // ESC schließt das Modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function loadGroups() {
    try {
      const res = await fetch("/api/tag-groups");
      if (res.ok) setGroups(await res.json());
    } catch { /* ignorieren */ }
  }

  // ─── Tag erstellen ───────────────────────────────────────────────────────

  async function handleCreateTag(e: React.FormEvent) {
    e.preventDefault();
    if (!tagName.trim()) return;
    setTagSaving(true);
    setTagError("");
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tagName.trim(), groupId: tagGroupId || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTagError(data.error || "Fehler beim Erstellen");
        return;
      }
      const group = groups.find((g) => g.id === tagGroupId);
      onTagCreated({
        id: data.tagId,
        name: tagName.trim(),
        slug: data.slug,
        groupId: tagGroupId || null,
        groupName: group?.name ?? null,
        groupColor: group?.color ?? null,
      });
    } catch {
      setTagError("Netzwerkfehler");
    } finally {
      setTagSaving(false);
    }
  }

  // ─── Gruppe erstellen ────────────────────────────────────────────────────

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!groupName.trim()) return;
    setGroupSaving(true);
    setGroupError("");
    setGroupSuccess("");
    try {
      const res = await fetch("/api/tag-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName.trim(), color: groupColor }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGroupError(data.error || "Fehler beim Erstellen");
        return;
      }
      setGroupSuccess(`Gruppe „${groupName.trim()}" erstellt!`);
      const createdId = data.id as number;
      setGroupName("");
      await loadGroups();
      // Nach kurzer Pause: Tab wechseln & neue Gruppe vorselektieren
      setTimeout(() => {
        setActiveTab("tag");
        setTagGroupId(createdId);
        setGroupSuccess("");
      }, 900);
    } catch {
      setGroupError("Netzwerkfehler");
    } finally {
      setGroupSaving(false);
    }
  }

  // ─── Aktuelle Gruppenfarbe für Vorschau ──────────────────────────────────

  const selectedGroup = groups.find((g) => g.id === tagGroupId);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal-Box */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-base font-semibold text-white">Tag erstellen</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-4">
          <button
            onClick={() => setActiveTab("tag")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "tag"
                ? "bg-amber-500 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            Neuer Tag
          </button>
          <button
            onClick={() => setActiveTab("group")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "group"
                ? "bg-amber-500 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Neue Gruppe
          </button>
        </div>

        {/* Inhalt */}
        <div className="p-5">
          {/* ── Tab: Neuer Tag ── */}
          {activeTab === "tag" && (
            <form onSubmit={handleCreateTag} className="space-y-4">
              {/* Tag-Name */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Tag-Name <span className="text-amber-500">*</span>
                </label>
                <input
                  type="text"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  placeholder="z. B. Stahlbrücke, Bogen, Sanierung"
                  autoFocus
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-600"
                />
              </div>

              {/* Gruppe auswählen */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Gruppe{" "}
                  <span className="text-gray-600">(optional)</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={tagGroupId}
                    onChange={(e) =>
                      setTagGroupId(
                        e.target.value ? parseInt(e.target.value) : ""
                      )
                    }
                    className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">— Keine Gruppe —</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setActiveTab("group")}
                    className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg px-2.5 py-2 transition-colors whitespace-nowrap"
                    title="Neue Gruppe anlegen"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Neue Gruppe
                  </button>
                </div>
              </div>

              {/* Live-Vorschau */}
              {tagName.trim() && (
                <div className="flex items-center gap-2 py-1">
                  <span className="text-xs text-gray-500">Vorschau:</span>
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-white"
                    style={{
                      backgroundColor: selectedGroup?.color || "#6b7280",
                    }}
                  >
                    {selectedGroup && (
                      <span className="opacity-75">{selectedGroup.name}:</span>
                    )}
                    {tagName.trim()}
                  </span>
                </div>
              )}

              {tagError && (
                <p className="text-red-400 text-xs">{tagError}</p>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={tagSaving || !tagName.trim()}
                  className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
                >
                  {tagSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Erstellen & hinzufügen
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          )}

          {/* ── Tab: Neue Gruppe ── */}
          {activeTab === "group" && (
            <form onSubmit={handleCreateGroup} className="space-y-4">
              {/* Gruppenname */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Gruppenname <span className="text-amber-500">*</span>
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="z. B. Bauwerk, Ort, Technik, Epoche"
                  autoFocus
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-600"
                />
              </div>

              {/* Farb-Picker */}
              <div>
                <label className="block text-xs text-gray-400 mb-2">
                  Gruppenfarbe
                </label>
                <div className="flex flex-wrap gap-2 items-center">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setGroupColor(c)}
                      className={`w-6 h-6 rounded-full transition-transform flex-shrink-0 ${
                        groupColor === c
                          ? "ring-2 ring-white ring-offset-1 ring-offset-gray-900 scale-110"
                          : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                  {/* Custom-Color */}
                  <label className="relative cursor-pointer flex-shrink-0" title="Eigene Farbe">
                    <span
                      className={`flex items-center justify-center w-6 h-6 rounded-full border-2 border-dashed border-gray-600 text-gray-400 text-xs hover:border-gray-400 ${
                        !COLOR_PRESETS.includes(groupColor)
                          ? "ring-2 ring-white ring-offset-1 ring-offset-gray-900"
                          : ""
                      }`}
                      style={
                        !COLOR_PRESETS.includes(groupColor)
                          ? { backgroundColor: groupColor }
                          : {}
                      }
                    >
                      {COLOR_PRESETS.includes(groupColor) ? "+" : ""}
                    </span>
                    <input
                      type="color"
                      value={groupColor}
                      onChange={(e) => setGroupColor(e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </label>

                  {/* Vorschau */}
                  {groupName.trim() && (
                    <span
                      className="ml-1 px-2.5 py-1 rounded-full text-xs font-medium text-white flex-shrink-0"
                      style={{ backgroundColor: groupColor }}
                    >
                      {groupName.trim()}
                    </span>
                  )}
                </div>
              </div>

              {groupError && (
                <p className="text-red-400 text-xs">{groupError}</p>
              )}
              {groupSuccess && (
                <p className="text-green-400 text-xs flex items-center gap-1">
                  ✓ {groupSuccess} Weiter zum Tag...
                </p>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={groupSaving || !groupName.trim()}
                  className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
                >
                  {groupSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Gruppe erstellen
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
