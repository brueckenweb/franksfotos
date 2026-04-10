"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, Upload, Tag } from "lucide-react";
import AlbumTreeSelect from "../AlbumTreeSelect";
import type { AlbumOption } from "../AlbumTreeSelect";
import TagGroupSelect from "../TagGroupSelect";
import type { TagOption } from "../TagGroupSelect";
import PostItTipTapEditor from "@/components/postit/PostItTipTapEditor";

export default function NeuesAlbumPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [albums, setAlbums] = useState<AlbumOption[]>([]);
  const [availableTags, setAvailableTags] = useState<TagOption[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);

  const [groups, setGroups] = useState<{ id: number; name: string; slug: string; description: string | null }[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    parentId: "",
    sortOrder: "0",
    childSortMode: "order",
    photoSortMode: "created_asc",
    visibleForGroups: ["public"] as string[],
    sourceType: "own" as "own" | "tag",
    tagId: "",
  });

  // Alle vorhandenen Alben für das Übergeordnet-Dropdown laden
  useEffect(() => {
    fetch("/api/albums")
      .then((r) => r.json())
      .then((data) => setAlbums(data.albums ?? []))
      .catch(() => {});
  }, []);

  // Usergruppen laden
  useEffect(() => {
    setGroupsLoading(true);
    fetch("/api/groups")
      .then((r) => r.json())
      .then((data) => setGroups(data.groups ?? []))
      .catch(() => {})
      .finally(() => setGroupsLoading(false));
  }, []);

  // Tags laden
  useEffect(() => {
    setTagsLoading(true);
    fetch("/api/tags")
      .then((r) => r.json())
      .then((data) => setAvailableTags(Array.isArray(data) ? data : (data.tags ?? [])))
      .catch(() => {})
      .finally(() => setTagsLoading(false));
  }, []);

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[äöüß]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" }[c] || c))
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const name = e.target.value;
    setForm((prev) => ({
      ...prev,
      name,
      slug: prev.slug === generateSlug(prev.name) ? generateSlug(name) : prev.slug,
    }));
  }

  async function saveAlbum(redirectToUpload = false) {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          description: form.description,
          parentId: form.parentId ? parseInt(form.parentId) : null,
          sortOrder: parseInt(form.sortOrder) || 0,
          childSortMode: form.childSortMode,
          photoSortMode: form.photoSortMode,
          visibleForGroups: form.visibleForGroups,
          sourceType: form.sourceType,
          tagId: form.sourceType === "tag" && form.tagId ? parseInt(form.tagId) : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Fehler beim Erstellen");
        return;
      }

      if (redirectToUpload && data.albumId) {
        router.push(`/admin/upload?albumId=${data.albumId}`);
      } else {
        router.push("/admin/alben");
      }
      router.refresh();
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await saveAlbum(false);
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/alben" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Neues Album</h1>
          <p className="text-gray-400 text-sm mt-0.5">Album anlegen</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5"
      >
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={handleNameChange}
            required
            placeholder="z.B. Urlaub 2024"
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
          />
        </div>

        {/* Slug */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            URL-Slug <span className="text-red-400">*</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-sm">/alben/</span>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
              required
              placeholder="urlaub-2024"
              className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600 font-mono"
            />
          </div>
        </div>

        {/* Übergeordnetes Album */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Übergeordnetes Album
          </label>
          <AlbumTreeSelect
            albums={albums}
            value={form.parentId}
            onChange={(val) => setForm((p) => ({ ...p, parentId: val }))}
          />
          <p className="text-gray-500 text-xs mt-1">
            Wähle ein Album, um dieses als Unteralbum einzuordnen.
          </p>
        </div>

        {/* Beschreibung */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Beschreibung
          </label>
          <PostItTipTapEditor
            content={form.description}
            onChange={(html) => setForm((p) => ({ ...p, description: html }))}
          />
        </div>

        {/* ── Fotoquelle ─────────────────────────────────────────────── */}
        <div className="border border-gray-700 rounded-xl p-4 space-y-4">
          <label className="block text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Tag className="w-4 h-4 text-amber-400" />
            Fotoquelle
          </label>

          {/* Radio-Auswahl */}
          <div className="space-y-2">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="radio"
                name="sourceType"
                value="own"
                checked={form.sourceType === "own"}
                onChange={() => setForm((p) => ({ ...p, sourceType: "own", tagId: "" }))}
                className="mt-0.5 w-4 h-4 border-gray-600 bg-gray-800 text-amber-500 focus:ring-amber-500"
              />
              <div>
                <span className="text-gray-200 text-sm font-medium">Eigene Fotos</span>
                <p className="text-gray-500 text-xs mt-0.5">
                  Fotos werden diesem Album direkt zugewiesen (über Upload oder manuell).
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="radio"
                name="sourceType"
                value="tag"
                checked={form.sourceType === "tag"}
                onChange={() => setForm((p) => ({ ...p, sourceType: "tag" }))}
                className="mt-0.5 w-4 h-4 border-gray-600 bg-gray-800 text-amber-500 focus:ring-amber-500"
              />
              <div>
                <span className="text-gray-200 text-sm font-medium">Tag-Fotos</span>
                <p className="text-gray-500 text-xs mt-0.5">
                  Das Album zeigt dynamisch alle Fotos, die mit einem bestimmten Tag versehen sind.
                </p>
              </div>
            </label>
          </div>

          {/* Tag-Auswahl (nur bei sourceType === "tag") */}
          {form.sourceType === "tag" && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Tag auswählen <span className="text-red-400">*</span>
              </label>
              {tagsLoading ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Tags werden geladen…
                </div>
              ) : availableTags.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  Keine Tags vorhanden. Bitte zuerst Tags anlegen.
                </p>
              ) : (
                <TagGroupSelect
                  tags={availableTags}
                  value={form.tagId}
                  onChange={(val) => setForm((p) => ({ ...p, tagId: val }))}
                />
              )}
            </div>
          )}
        </div>

        {/* Sortierung */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Sortierreihenfolge
          </label>
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))}
            className="w-32 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          />
          <p className="text-gray-500 text-xs mt-1">Niedrigere Zahlen erscheinen zuerst</p>
        </div>

        {/* Sortierung der Unteralben */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Sortierung der Unteralben
          </label>
          <div className="flex items-center gap-3">
            {[
              { value: "order", label: "# Manuelle Reihenfolge" },
              { value: "alpha", label: "A–Z Alphabetisch" },
              { value: "alpha_desc", label: "Z–A Alphabetisch" },
            ].map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="childSortMode"
                  value={opt.value}
                  checked={form.childSortMode === opt.value}
                  onChange={(e) => setForm((p) => ({ ...p, childSortMode: e.target.value }))}
                  className="w-4 h-4 border-gray-600 bg-gray-800 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-gray-300 text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Sortierung der Fotos */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Sortierung der Fotos
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { value: "created_asc", label: "📅 Aufnahmezeit (älteste zuerst)" },
              { value: "created_desc", label: "📅 Aufnahmezeit (neueste zuerst)" },
              { value: "title_asc", label: "A–Z Titel" },
              { value: "title_desc", label: "Z–A Titel" },
              { value: "filename_asc", label: "A–Z Dateiname" },
              { value: "manual", label: "# Manuelle Reihenfolge (sortOrder)" },
            ].map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="photoSortMode"
                  value={opt.value}
                  checked={form.photoSortMode === opt.value}
                  onChange={(e) => setForm((p) => ({ ...p, photoSortMode: e.target.value }))}
                  className="w-4 h-4 border-gray-600 bg-gray-800 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-gray-300 text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Sichtbarkeit */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Sichtbar für</label>
          {groupsLoading ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Gruppen werden geladen…
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map((group) => (
                <label key={group.slug} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.visibleForGroups.includes(group.slug)}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        visibleForGroups: e.target.checked
                          ? [...p.visibleForGroups, group.slug]
                          : p.visibleForGroups.filter((s) => s !== group.slug),
                      }))
                    }
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-gray-900"
                  />
                  <span className="text-gray-300 text-sm">{group.name}</span>
                  <span className="text-gray-600 text-xs font-mono">{group.slug}</span>
                </label>
              ))}
              {groups.length === 0 && (
                <p className="text-gray-500 text-sm">Keine Gruppen vorhanden.</p>
              )}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Album speichern
          </button>
          {form.sourceType === "own" && (
            <button
              type="button"
              disabled={loading}
              onClick={(e) => {
                const formEl = (e.target as HTMLElement).closest("form") as HTMLFormElement;
                if (!formEl.reportValidity()) return;
                saveAlbum(true);
              }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Speichern &amp; Fotos eingeben
            </button>
          )}
          <Link
            href="/admin/alben"
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  );
}
