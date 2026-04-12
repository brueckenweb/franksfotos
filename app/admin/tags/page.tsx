"use client";

import { useEffect, useState, useRef } from "react";
import { Tag, Plus, Trash2, Loader2, Layers, ChevronDown, ChevronRight, Pencil, Check, X, Wand2, FolderOpen, SkipForward } from "lucide-react";
import AlbumTreeSelect from "@/app/admin/alben/AlbumTreeSelect";

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

// ─── Album-Typ für Generator ─────────────────────────────────────────────────

interface AlbumFlat {
  id: number;
  name: string;
  parentId: number | null;
  depth?: number;
  label?: string;
}

interface GenerateResult {
  created: { id?: number; name: string; slug: string }[];
  skipped: { name: string; reason: string }[];
  preview: boolean;
}

// ─── Haupt-Komponente ────────────────────────────────────────────────────────

export default function AdminTagsPage() {
  const [activeTab, setActiveTab] = useState<"groups" | "tags" | "generate">("groups");

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
  const [editingTagGroupId, setEditingTagGroupId] = useState<number | null>(null);

  // Tag-Name bearbeiten
  const [editingTagNameId, setEditingTagNameId] = useState<number | null>(null);
  const [editingTagNameValue, setEditingTagNameValue] = useState("");
  const [tagNameSaving, setTagNameSaving] = useState(false);
  const tagNameInputRef = useRef<HTMLInputElement>(null);

  // Gruppe bearbeiten
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [editingGroupColor, setEditingGroupColor] = useState("#3b82f6");
  const [groupEditSaving, setGroupEditSaving] = useState(false);
  const [groupEditError, setGroupEditError] = useState("");
  const groupNameInputRef = useRef<HTMLInputElement>(null);

  // ─── Collapsible Tag-Gruppen ─────────────────────────────────────────────
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  function toggleGroupCollapse(key: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // ─── Generator-State ─────────────────────────────────────────────────────
  const [alben, setAlben] = useState<AlbumFlat[]>([]);
  const [albenLoading, setAlbenLoading] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set());
  const [parentAlbumId, setParentAlbumId] = useState<string>("");
  const [genLoading, setGenLoading] = useState(false);
  const [genResult, setGenResult] = useState<GenerateResult | null>(null);
  const [genError, setGenError] = useState("");

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

  async function loadAlben() {
    setAlbenLoading(true);
    try {
      const res = await fetch("/api/alben");
      if (res.ok) setAlben(await res.json());
    } finally {
      setAlbenLoading(false);
    }
  }

  useEffect(() => {
    loadGroups();
    loadTags();
  }, []);

  // Alben nur laden wenn Generator-Tab aktiv wird
  useEffect(() => {
    if (activeTab === "generate" && alben.length === 0) {
      loadAlben();
    }
  }, [activeTab]);

  // Fokus auf Input wenn Edit-Mode startet
  useEffect(() => {
    if (editingTagNameId !== null) {
      tagNameInputRef.current?.focus();
      tagNameInputRef.current?.select();
    }
  }, [editingTagNameId]);

  useEffect(() => {
    if (editingGroupId !== null) {
      groupNameInputRef.current?.focus();
      groupNameInputRef.current?.select();
    }
  }, [editingGroupId]);

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

  function startEditGroup(group: TagGroup) {
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
    setEditingGroupColor(group.color);
    setGroupEditError("");
  }

  function cancelEditGroup() {
    setEditingGroupId(null);
    setEditingGroupName("");
    setEditingGroupColor("#3b82f6");
    setGroupEditError("");
  }

  async function handleSaveGroup(id: number) {
    if (!editingGroupName.trim()) return;
    setGroupEditSaving(true);
    setGroupEditError("");
    try {
      const res = await fetch(`/api/tag-groups?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingGroupName.trim(), color: editingGroupColor }),
      });
      const data = await res.json();
      if (!res.ok) { setGroupEditError(data.error || "Fehler"); return; }
      setEditingGroupId(null);
      await Promise.all([loadGroups(), loadTags()]);
    } catch {
      setGroupEditError("Netzwerkfehler");
    } finally {
      setGroupEditSaving(false);
    }
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
    setEditingTagGroupId(tagId);
    try {
      await fetch(`/api/tags/${tagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      });
      await Promise.all([loadTags(), loadGroups()]);
    } finally {
      setEditingTagGroupId(null);
    }
  }

  function startEditTagName(tag: TagItem) {
    setEditingTagNameId(tag.id);
    setEditingTagNameValue(tag.name);
  }

  function cancelEditTagName() {
    setEditingTagNameId(null);
    setEditingTagNameValue("");
  }

  async function handleSaveTagName(tagId: number) {
    if (!editingTagNameValue.trim()) return;
    setTagNameSaving(true);
    try {
      const res = await fetch(`/api/tags/${tagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingTagNameValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTagError(data.error || "Fehler beim Speichern");
        return;
      }
      setEditingTagNameId(null);
      setEditingTagNameValue("");
      setTagError("");
      await loadTags();
    } catch {
      setTagError("Netzwerkfehler");
    } finally {
      setTagNameSaving(false);
    }
  }

  // ─── Generator-Funktionen ────────────────────────────────────────────────

  function toggleTag(id: number) {
    setSelectedTagIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setGenResult(null);
  }

  function selectAllTags() {
    setSelectedTagIds(new Set(tags.map(t => t.id)));
    setGenResult(null);
  }

  function deselectAllTags() {
    setSelectedTagIds(new Set());
    setGenResult(null);
  }

  async function callGenApi(preview: boolean) {
    if (!parentAlbumId || selectedTagIds.size === 0) return;
    setGenLoading(true);
    setGenError("");
    setGenResult(null);
    try {
      const res = await fetch("/api/admin/generate-tag-albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentAlbumId: Number(parentAlbumId),
          tagIds: Array.from(selectedTagIds),
          preview,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setGenError(data.error || "Fehler"); return; }
      setGenResult(data);
    } catch {
      setGenError("Netzwerkfehler");
    } finally {
      setGenLoading(false);
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
        <button
          onClick={() => setActiveTab("generate")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "generate"
              ? "bg-amber-500 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Wand2 className="w-4 h-4" />
          Album-Generator
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
                {groups.map((group) =>
                  editingGroupId === group.id ? (
                    /* ── Bearbeiten-Zeile ── */
                    <div key={group.id} className="px-5 py-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <input
                          ref={groupNameInputRef}
                          type="text"
                          value={editingGroupName}
                          onChange={(e) => setEditingGroupName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveGroup(group.id);
                            if (e.key === "Escape") cancelEditGroup();
                          }}
                          className="flex-1 bg-gray-800 border border-amber-500 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                          placeholder="Gruppenname"
                        />
                      </div>
                      {/* Farb-Picker (Edit) */}
                      <div className="flex flex-wrap gap-2 items-center">
                        {COLOR_PRESETS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setEditingGroupColor(c)}
                            className={`w-6 h-6 rounded-full transition-transform ${
                              editingGroupColor === c ? "ring-2 ring-white ring-offset-1 ring-offset-gray-900 scale-110" : ""
                            }`}
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))}
                        <label className="relative cursor-pointer" title="Benutzerdefinierte Farbe">
                          <span
                            className={`flex items-center justify-center w-6 h-6 rounded-full border-2 border-dashed border-gray-600 text-gray-400 text-xs hover:border-gray-400 ${
                              !COLOR_PRESETS.includes(editingGroupColor) ? "ring-2 ring-white ring-offset-1 ring-offset-gray-900" : ""
                            }`}
                            style={!COLOR_PRESETS.includes(editingGroupColor) ? { backgroundColor: editingGroupColor } : {}}
                          >
                            {COLOR_PRESETS.includes(editingGroupColor) ? "+" : ""}
                          </span>
                          <input
                            type="color"
                            value={editingGroupColor}
                            onChange={(e) => setEditingGroupColor(e.target.value)}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                          />
                        </label>
                        {/* Vorschau */}
                        <div
                          className="ml-1 px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: editingGroupColor }}
                        >
                          {editingGroupName || "Vorschau"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSaveGroup(group.id)}
                          disabled={groupEditSaving || !editingGroupName.trim()}
                          className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                        >
                          {groupEditSaving ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          Speichern
                        </button>
                        <button
                          onClick={cancelEditGroup}
                          className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                        >
                          <X className="w-3 h-3" />
                          Abbrechen
                        </button>
                        {groupEditError && <p className="text-red-400 text-xs">{groupEditError}</p>}
                      </div>
                    </div>
                  ) : (
                    /* ── Normal-Zeile ── */
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
                      {/* Bearbeiten */}
                      <button
                        onClick={() => startEditGroup(group)}
                        className="text-gray-600 hover:text-amber-400 transition-colors flex-shrink-0"
                        title={`Gruppe "${group.name}" bearbeiten`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {/* Löschen */}
                      <button
                        onClick={() => handleDeleteGroup(group.id, group.name)}
                        className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                        title={`Gruppe "${group.name}" löschen`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )
                )}
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
              {tagsByGroup.map(({ group, tags: groupTags }) => {
                const groupKey = group?.id?.toString() ?? "ungrouped";
                const isCollapsed = collapsedGroups.has(groupKey);
                return (
                  <div
                    key={groupKey}
                    className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
                  >
                    {/* Gruppen-Header als klickbarer Button zum Ein-/Ausklappen */}
                    <button
                      type="button"
                      onClick={() => toggleGroupCollapse(groupKey)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-800/60 transition-colors text-left"
                      style={
                        group
                          ? { borderLeft: `3px solid ${group.color}`, borderBottom: isCollapsed ? "none" : "1px solid rgb(31 41 55)" }
                          : { borderBottom: isCollapsed ? "none" : "1px solid rgb(31 41 55)" }
                      }
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      )}
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
                    </button>

                    {/* Tags als Badges – nur wenn nicht eingeklappt */}
                    {!isCollapsed && (
                      groupTags.length === 0 ? (
                        <p className="text-gray-600 text-xs px-4 py-3">
                          Keine Tags in dieser Gruppe.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2 p-4">
                          {groupTags.map((tag) =>
                            editingTagNameId === tag.id ? (
                              /* ── Tag-Name-Edit-Mode ── */
                              <div key={tag.id} className="flex items-center gap-1">
                                <input
                                  ref={tagNameInputRef}
                                  type="text"
                                  value={editingTagNameValue}
                                  onChange={(e) => setEditingTagNameValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveTagName(tag.id);
                                    if (e.key === "Escape") cancelEditTagName();
                                  }}
                                  className="bg-gray-700 border border-amber-500 text-white rounded-lg px-2 py-1 text-xs focus:outline-none w-32"
                                  style={{ height: "26px" }}
                                />
                                <button
                                  onClick={() => handleSaveTagName(tag.id)}
                                  disabled={tagNameSaving || !editingTagNameValue.trim()}
                                  className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded-lg px-1.5 flex items-center justify-center transition-colors"
                                  style={{ height: "26px" }}
                                  title="Speichern"
                                >
                                  {tagNameSaving ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Check className="w-3 h-3" />
                                  )}
                                </button>
                                <button
                                  onClick={cancelEditTagName}
                                  className="bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg px-1.5 flex items-center justify-center transition-colors"
                                  style={{ height: "26px" }}
                                  title="Abbrechen"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              /* ── Tag-Normal-Mode ── */
                              <div key={tag.id} className="flex items-center gap-0 group">
                                {/* Badge */}
                                <span
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-l-full text-xs font-medium text-white"
                                  style={{
                                    backgroundColor: tag.groupColor || "#6b7280",
                                  }}
                                >
                                  {tag.name}
                                </span>

                                {/* Name bearbeiten */}
                                <button
                                  onClick={() => startEditTagName(tag)}
                                  className="bg-gray-700 hover:bg-amber-700 text-gray-400 hover:text-white transition-colors px-1.5 py-1 border-l border-gray-600"
                                  style={{ height: "26px" }}
                                  title={`Tag "${tag.name}" umbenennen`}
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>

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
                                    disabled={editingTagGroupId === tag.id}
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
                                  {editingTagGroupId === tag.id ? (
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
                            )
                          )}
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: ALBUM-GENERATOR ── */}
      {activeTab === "generate" && (
        <div className="space-y-5">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">

            {/* Eltern-Album wählen */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-amber-400" />
                Eltern-Album
              </label>
              {albenLoading ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Alben werden geladen…
                </div>
              ) : (
                <AlbumTreeSelect
                  albums={alben}
                  value={parentAlbumId}
                  onChange={v => { setParentAlbumId(v); setGenResult(null); }}
                  noSelectionLabel="— Bitte Eltern-Album wählen —"
                />
              )}
              <p className="text-xs text-gray-600 mt-1">
                Die Tag-Alben werden als Unteralben dieses Albums angelegt.
              </p>
            </div>

            {/* Tag-Auswahl */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-amber-400" />
                  Tags auswählen
                  <span className="text-gray-500 font-normal">({selectedTagIds.size} von {tags.length})</span>
                </label>
                <div className="flex gap-2">
                  <button onClick={selectAllTags} className="text-xs text-amber-400 hover:text-amber-300 transition-colors">Alle</button>
                  <span className="text-gray-700">|</span>
                  <button onClick={deselectAllTags} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Keine</button>
                </div>
              </div>

              {tagsLoading ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Tags werden geladen…
                </div>
              ) : (
                <div className="bg-gray-800 rounded-lg border border-gray-700 divide-y divide-gray-700 max-h-64 overflow-y-auto">
                  {tagsByGroup.map(({ group, tags: groupTags }) => (
                    groupTags.length > 0 && (
                      <div key={group?.id ?? "ungrouped"}>
                        {/* Gruppen-Header als trennende Zeile */}
                        <div
                          className="px-3 py-1.5 flex items-center gap-2 bg-gray-900/50 sticky top-0"
                          style={group ? { borderLeft: `3px solid ${group.color}` } : {}}
                        >
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: group?.color ?? "#6b7280" }}
                          />
                          <span className="text-xs font-semibold" style={{ color: group?.color ?? "#9ca3af" }}>
                            {group?.name ?? "Ohne Gruppe"}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const allSelected = groupTags.every(t => selectedTagIds.has(t.id));
                              setSelectedTagIds(prev => {
                                const next = new Set(prev);
                                groupTags.forEach(t => allSelected ? next.delete(t.id) : next.add(t.id));
                                return next;
                              });
                              setGenResult(null);
                            }}
                            className="text-xs text-gray-600 hover:text-amber-400 transition-colors ml-auto"
                          >
                            {groupTags.every(t => selectedTagIds.has(t.id)) ? "Alle weg" : "Alle"}
                          </button>
                        </div>
                        {/* Tags */}
                        {groupTags.map(tag => (
                          <label
                            key={tag.id}
                            className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-700/50 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={selectedTagIds.has(tag.id)}
                              onChange={() => toggleTag(tag.id)}
                              className="rounded border-gray-600 bg-gray-700 text-amber-500 focus:ring-amber-500"
                            />
                            <span
                              className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                              style={{ backgroundColor: tag.groupColor ?? "#6b7280" }}
                            >
                              {tag.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>

            {/* Aktions-Buttons */}
            <div className="flex flex-wrap gap-3 items-center">
              <button
                onClick={() => callGenApi(true)}
                disabled={genLoading || !parentAlbumId || selectedTagIds.size === 0}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors border border-gray-600"
              >
                {genLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Vorschau
              </button>
              <button
                onClick={() => callGenApi(false)}
                disabled={genLoading || !parentAlbumId || selectedTagIds.size === 0}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {genLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                Alben generieren
              </button>
              {genError && <p className="text-red-400 text-sm">{genError}</p>}
            </div>
          </div>

          {/* Ergebnis */}
          {genResult && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-300">
                {genResult.preview ? "Vorschau" : "Ergebnis"}
              </h3>

              {/* Zusammenfassung */}
              <div className="flex gap-4 text-sm">
                <span className="text-green-400">
                  ✅ {genResult.created.length} {genResult.preview ? "würden angelegt" : "angelegt"}
                </span>
                {genResult.skipped.length > 0 && (
                  <span className="text-gray-500">
                    <SkipForward className="inline w-3 h-3 mr-1" />
                    {genResult.skipped.length} übersprungen
                  </span>
                )}
              </div>

              {/* Neue Alben */}
              {genResult.created.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">
                    {genResult.preview ? "Werden angelegt:" : "Angelegt:"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {genResult.created.map((a, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-900/30 border border-green-800/50 text-green-400 text-xs rounded-lg">
                        <FolderOpen className="w-3 h-3" />
                        {a.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Übersprungene */}
              {genResult.skipped.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Übersprungen (existieren bereits):</p>
                  <div className="flex flex-wrap gap-2">
                    {genResult.skipped.map((a, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-800 border border-gray-700 text-gray-500 text-xs rounded-lg">
                        <SkipForward className="w-3 h-3" />
                        {a.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
