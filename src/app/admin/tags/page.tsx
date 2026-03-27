"use client";

import { useEffect, useState } from "react";
import { Tag, Plus, Trash2, Loader2, Layers, ChevronDown } from "lucide-react";

// ─── Typen ────────────────────────────────────────────────────────────────────

interface TagGroup {
  id: number;
  name: string;
  slug: string;
  color: string;
  tagCount: number;
  createdAt: string;
}

interface TagItem {
  id: number;
  name: string;
  slug: string;
  groupName?: string | null;
  groupSlug?: string | null;
  groupColor?: string | null;
  groupId?: number | null;
  createdAt: string;
}

// ─── Farb-Presets ─────────────────────────────────────────────────────────────

const COLOR_PRESETS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899",
  "#6b7280", "#78350f", "#134e4a", "#1e1b4b",
];

// ─── Haupt-Komponente ────────────────────────────────────────────────────────

export default function AdminTagsPage() {
  const [activeTab, setActiveTab] = useState<"groups" | "tags">("groups");

  // Gruppen
  const [groups, setGroups] = useState<TagGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState("#3b82f6");
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupError, setGroupError] = useState("");

  // Tags
  const [tags, setTags] = useState<TagItem[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [newTagName, setNewTagName] = useState("");
  const [newTagGroupId, setNewTagGroupId] = useState<number | "">("");
  const [tagSaving, setTagSaving] = useState(false);
  const [tagError, setTagError] = useState("");

  // Tag-Gruppen-Änderung (Inline)
  const [editingTagId, setEditingTagId] = useState<number | null>(null);

  // ─── Laden ───────────────────────────────────────────────────────────────

  async function loadGroups() {
    setGroupsLoading(true);
    try {
      const res = await fetch("/api/tag-groups");
      if (res.ok) setGroups(await res.json());
    } finally {
      setGroupsLoading(false);
    }
  }

  async function loadTags() {
    setTagsLoading(true);
    try {
      const res = await fetch("/api/tags");
      if (res.ok) setTags(await res.json());
    } finally {
      setTagsLoading(false);
    }
  }

  useEffect(() => {
    loadGroups();
    loadTags();
  }, []);

  // ─── Gruppen CRUD ────────────────────────────────────────────────────────

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setGroupSaving(true);
    setGroupError("");
    try {
      const res = await fetch("/api/tag-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName.trim(), color: newGroupColor }),
      });
      const data = await res.json();
      if (!res.ok) { setGroupError(data.error || "Fehler"); return; }
      setNewGroupName("");
      setNewGroupColor("#3b82f6");
      await loadGroups();
    } catch {
      setGroupError("Netzwerkfehler");
    } finally {
      setGroupSaving(false);
    }
  }

  async function handleDeleteGroup(id: number, name: string) {
    if (!confirm(`Gruppe "${name}" wirklich löschen? Die Tags in dieser Gruppe werden keiner Gruppe mehr zugeordnet.`)) return;
    await fetch(`/api/tag-groups?id=${id}`, { method: "DELETE" });
    await Promise.all([loadGroups(), loadTags()]);
  }

  // ─── Tags CRUD ───────────────────────────────────────────────────────────

  async function handleCreateTag(e: React.FormEvent) {
    e.preventDefault();
    if (!newTagName.trim()) return;
    setTagSaving(true);
    setTagError("");
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTagName.trim(),
          groupId: newTagGroupId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setTagError(data.error || "Fehler"); return; }
      setNewTagName("");
      setNewTagGroupId("");
      await Promise.all([loadTags(), loadGroups()]);
    } catch {
      setTagError("Netzwerkfehler");
    } finally {
      setTagSaving(false);
    }
  }

  async function handleDeleteTag(id: number, name: string) {
    if (!confirm(`Tag "${name}" wirklich löschen?`)) return;
    await fetch(`/api/tags/${id}`, { method: "DELETE" });
    await Promise.all([loadTags(), loadGroups()]);
  }

  async function handleChangeTagGroup(tagId: number, groupId: number | null) {
    setEditingTagId(tagId);
    try {
      await fetch(`/api/tags/${tagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      });
      await Promise.all([loadTags(), loadGroups()]);
    } finally {
      setEditingTagId(null);
    }
  }

  // ─── Tags nach Gruppen sortieren ────────────────────────────────────────

  const tagsByGroup: { group: TagGroup | null; tags: TagItem[] }[] = [];

  // Tags ohne Gruppe zuerst
  const ungroupedTags = tags.filter((t) => !t.groupName);
  if (ungroupedTags.length > 0) {
    tagsByGroup.push({ group: null, tags: ungroupedTags });
  }

  // Tags nach Gruppen
  for (const group of groups) {
    const groupTags = tags.filter((t) => t.groupName === group.name);
    tagsByGroup.push({ group, tags: groupTags });
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Tags & Gruppen</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {tags.length} Tags in {groups.length} Gruppen
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab("groups")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "groups"
              ? "bg-amber-500 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Layers className="w-4 h-4" />
          Tag-Gruppen
        </button>
        <button
          onClick={() => setActiveTab("tags")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "tags"
              ? "bg-amber-500 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Tag className="w-4 h-4" />
          Tags
        </button>
      </div>

      {/* ── TAB: GRUPPEN ── */}
      {activeTab === "groups" && (
        <div className="space-y-5">
          {/* Neue Gruppe */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Neue Gruppe anlegen</h2>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Gruppenname (z. B. Bauwerk, Ort, Technik)"
                  className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
                />
              </div>

              {/* Farb-Picker */}
              <div>
                <p className="text-xs text-gray-500 mb-2">Gruppenfarbe</p>
                <div className="flex flex-wrap gap-2 items-center">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewGroupColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        newGroupColor === c ? "ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110" : ""
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                  {/* Custom Color */}
                  <label className="relative cursor-pointer" title="Benutzerdefinierte Farbe">
                    <span
                      className={`flex items-center justify-center w-7 h-7 rounded-full border-2 border-dashed border-gray-600 text-gray-400 text-xs hover:border-gray-400 ${
                        !COLOR_PRESETS.includes(newGroupColor) ? "ring-2 ring-white ring-offset-2 ring-offset-gray-900" : ""
                      }`}
                      style={!COLOR_PRESETS.includes(newGroupColor) ? { backgroundColor: newGroupColor } : {}}
                    >
                      {COLOR_PRESETS.includes(newGroupColor) ? "+" : ""}
                    </span>
                    <input
                      type="color"
                      value={newGroupColor}
                      onChange={(e) => setNewGroupColor(e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </label>

                  {/* Vorschau */}
                  <div
                    className="ml-2 px-3 py-1 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: newGroupColor }}
                  >
                    {newGroupName || "Vorschau"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={groupSaving || !newGroupName.trim()}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                >
                  {groupSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Gruppe erstellen
                </button>
                {groupError && <p className="text-red-400 text-sm">{groupError}</p>}
              </div>
            </form>
          </div>

          {/* Gruppen-Liste */}
          {groupsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-10 bg-gray-900 border border-gray-800 rounded-xl">
              <Layers className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Noch keine Gruppen vorhanden.</p>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="divide-y divide-gray-800">
                {groups.map((group) => (
                  <div key={group.id} className="flex items-center gap-4 px-5 py-4">
                    {/* Farbindikator */}
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: group.color }}
                    />
                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <span className="text-white font-medium text-sm">{group.name}</span>
                      <span className="text-gray-500 text-xs ml-2 font-mono">/{group.slug}</span>
                    </div>
                    {/* Badge-Vorschau */}
                    <span
                      className="px-2.5 py-1 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: group.color }}
                    >
                      {group.tagCount} Tags
                    </span>
                    {/* Löschen */}
                    <button
                      onClick={() => handleDeleteGroup(group.id, group.name)}
                      className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                      title={`Gruppe "${group.name}" löschen`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: TAGS ── */}
      {activeTab === "tags" && (
        <div className="space-y-5">
          {/* Neuer Tag */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Neuen Tag anlegen</h2>
            <form onSubmit={handleCreateTag} className="flex flex-wrap gap-3">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Tag-Name"
                className="flex-1 min-w-[160px] bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
              />
              <select
                value={newTagGroupId}
                onChange={(e) =>
                  setNewTagGroupId(e.target.value ? parseInt(e.target.value) : "")
                }
                className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 min-w-[160px]"
              >
                <option value="">— Keine Gruppe —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={tagSaving || !newTagName.trim()}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                {tagSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Erstellen
              </button>
            </form>
            {tagError && <p className="text-red-400 text-sm mt-2">{tagError}</p>}
          </div>

          {/* Tag-Liste nach Gruppen */}
          {tagsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
            </div>
          ) : tags.length === 0 ? (
            <div className="text-center py-10 bg-gray-900 border border-gray-800 rounded-xl">
              <Tag className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Noch keine Tags vorhanden.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tagsByGroup.map(({ group, tags: groupTags }) => (
                <div
                  key={group?.id ?? "ungrouped"}
                  className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
                >
                  {/* Gruppen-Header */}
                  <div
                    className="px-4 py-3 flex items-center gap-3 border-b border-gray-800"
                    style={group ? { borderLeftColor: group.color, borderLeftWidth: 3 } : {}}
                  >
                    {group ? (
                      <>
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: group.color }}
                        />
                        <span
                          className="text-sm font-semibold"
                          style={{ color: group.color }}
                        >
                          {group.name}
                        </span>
                        <span className="text-gray-600 text-xs">
                          ({groupTags.length} Tags)
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="w-3 h-3 rounded-full bg-gray-600 flex-shrink-0" />
                        <span className="text-sm font-semibold text-gray-400">
                          Ohne Gruppe
                        </span>
                        <span className="text-gray-600 text-xs">
                          ({groupTags.length} Tags)
                        </span>
                      </>
                    )}
                  </div>

                  {/* Tags als Badges */}
                  {groupTags.length === 0 ? (
                    <p className="text-gray-600 text-xs px-4 py-3">
                      Keine Tags in dieser Gruppe.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2 p-4">
                      {groupTags.map((tag) => (
                        <div key={tag.id} className="flex items-center gap-0 group">
                          {/* Badge */}
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-l-full text-xs font-medium text-white"
                            style={{
                              backgroundColor:
                                tag.groupColor || "#6b7280",
                            }}
                          >
                            {tag.name}
                          </span>

                          {/* Gruppe ändern */}
                          <div className="relative">
                            <select
                              value={tag.groupId ?? ""}
                              onChange={(e) =>
                                handleChangeTagGroup(
                                  tag.id,
                                  e.target.value ? parseInt(e.target.value) : null
                                )
                              }
                              disabled={editingTagId === tag.id}
                              className="appearance-none bg-gray-700 border-0 border-l border-gray-600 text-white text-xs pl-1.5 pr-5 py-1 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50 cursor-pointer"
                              title="Gruppe ändern"
                              style={{ height: "26px" }}
                            >
                              <option value="">— Keine —</option>
                              {groups.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.name}
                                </option>
                              ))}
                            </select>
                            {editingTagId === tag.id ? (
                              <Loader2 className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-gray-400 pointer-events-none" />
                            ) : (
                              <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                            )}
                          </div>

                          {/* Löschen */}
                          <button
                            onClick={() => handleDeleteTag(tag.id, tag.name)}
                            className="bg-gray-700 hover:bg-red-900 text-gray-400 hover:text-red-300 transition-colors px-1.5 py-1 rounded-r-full border-l border-gray-600"
                            style={{ height: "26px" }}
                            title={`Tag "${tag.name}" löschen`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
