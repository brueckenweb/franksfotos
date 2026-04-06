"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, Camera, Search, X, Tag } from "lucide-react";
import AlbumTreeSelect from "../../AlbumTreeSelect";
import type { AlbumOption } from "../../AlbumTreeSelect";
import TagGroupSelect from "../../TagGroupSelect";
import type { TagOption } from "../../TagGroupSelect";

/** Thumbnail mit Fallback thumbnailUrl → fileUrl → Platzhalter */
function CoverThumb({
  thumbnailUrl,
  fileUrl,
  alt,
}: {
  thumbnailUrl: string | null;
  fileUrl: string;
  alt: string;
}) {
  const [src, setSrc] = useState<string>(thumbnailUrl || fileUrl);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-700">
        <Camera className="w-4 h-4 text-gray-500" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover"
      loading="lazy"
      onError={() => {
        if (thumbnailUrl && src === thumbnailUrl && fileUrl && fileUrl !== thumbnailUrl) {
          setSrc(fileUrl);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}

interface AlbumPhoto {
  id: number;
  filename: string;
  title: string | null;
  thumbnailUrl: string | null;
  fileUrl: string;
}

interface SearchPhoto extends AlbumPhoto {
  albumName: string | null;
}

export default function EditAlbumPage() {
  const router = useRouter();
  const params = useParams();
  const albumId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [albumPhotos, setAlbumPhotos] = useState<AlbumPhoto[]>([]);
  const [allAlbums, setAllAlbums] = useState<AlbumOption[]>([]);
  const [availableTags, setAvailableTags] = useState<TagOption[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [groups, setGroups] = useState<{ id: number; name: string; slug: string; description: string | null }[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

  // Cover-Foto: Tab + Suche
  const [coverTab, setCoverTab] = useState<"album" | "search">("album");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchPhoto[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    parentId: "",
    sortOrder: "0",
    childSortMode: "order",
    photoSortMode: "created_asc",
    isActive: true,
    coverPhotoId: "",
    visibleForGroups: [] as string[],
    sourceType: "own" as "own" | "tag",
    tagId: "",
  });

  useEffect(() => {
    // Tags laden
    setTagsLoading(true);
    fetch("/api/tags")
      .then((r) => r.json())
      .then((data) => setAvailableTags(Array.isArray(data) ? data : (data.tags ?? [])))
      .catch(() => {})
      .finally(() => setTagsLoading(false));
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

  useEffect(() => {
    async function load() {
      try {
        const [albumRes, photosRes, allAlbumsRes] = await Promise.all([
          fetch(`/api/albums/${albumId}`),
          fetch(`/api/albums/${albumId}/photos?limit=100`),
          fetch(`/api/albums`),
        ]);
        const albumData = await albumRes.json();
        const photosData = await photosRes.json();
        const allAlbumsData = await allAlbumsRes.json();

        if (albumData.album) {
          const vis: string[] =
            albumData.visibility?.map((v: { groupSlug: string }) => v.groupSlug) ?? [];
          setForm({
            name: albumData.album.name,
            slug: albumData.album.slug,
            description: albumData.album.description || "",
            parentId: albumData.album.parentId ? String(albumData.album.parentId) : "",
            sortOrder: String(albumData.album.sortOrder ?? 0),
            childSortMode: albumData.album.childSortMode ?? "order",
            photoSortMode: albumData.album.photoSortMode ?? "created_asc",
            isActive: albumData.album.isActive,
            coverPhotoId: albumData.album.coverPhotoId
              ? String(albumData.album.coverPhotoId)
              : "",
            visibleForGroups: vis,
            sourceType: albumData.album.sourceType === "tag" ? "tag" : "own",
            tagId: albumData.album.tagId ? String(albumData.album.tagId) : "",
          });
        }

        setAlbumPhotos(photosData.photos || []);
        setAllAlbums(allAlbumsData.albums ?? []);
      } catch {
        setError("Album konnte nicht geladen werden");
      } finally {
        setFetching(false);
      }
    }
    load();
  }, [albumId]);

  // Debounced-Suche über alle Fotos
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(
          `/api/photos/search?q=${encodeURIComponent(searchQuery.trim())}&limit=24`
        );
        const data = await res.json();
        setSearchResults(data.photos ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/albums/${albumId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          description: form.description,
          parentId: form.parentId ? parseInt(form.parentId) : null,
          sortOrder: parseInt(form.sortOrder) || 0,
          childSortMode: form.childSortMode,
          photoSortMode: form.photoSortMode,
          isActive: form.isActive,
          coverPhotoId: form.coverPhotoId ? parseInt(form.coverPhotoId) : null,
          visibleForGroups: form.visibleForGroups,
          sourceType: form.sourceType,
          tagId: form.sourceType === "tag" && form.tagId ? parseInt(form.tagId) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Fehler beim Speichern");
        return;
      }

      router.push("/admin/alben");
      router.refresh();
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/alben" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Album bearbeiten</h1>
          <p className="text-gray-400 text-sm mt-0.5">{form.name}</p>
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

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            URL-Slug <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.slug}
            onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
            required
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 font-mono"
          />
        </div>

        {/* Übergeordnetes Album */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Übergeordnetes Album
          </label>
          <AlbumTreeSelect
            albums={allAlbums}
            value={form.parentId}
            onChange={(val) => setForm((p) => ({ ...p, parentId: val }))}
            excludeId={parseInt(albumId)}
          />
          <p className="text-gray-500 text-xs mt-1">
            Wähle ein Album, um dieses als Unteralbum einzuordnen.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Beschreibung
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            rows={3}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none"
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
            <label className="flex items-start gap-3 cursor-pointer">
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

            <label className="flex items-start gap-3 cursor-pointer">
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

        {/* Cover-Foto (nur bei eigenen Fotos sinnvoll, aber auch bei Tag-Alben möglich) */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5" />
            Cover-Foto
          </label>

          {/* Tabs */}
          <div className="flex gap-1 mb-3 bg-gray-800 rounded-lg p-1 w-fit">
            <button
              type="button"
              onClick={() => setCoverTab("album")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                coverTab === "album"
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              {form.sourceType === "tag" ? "Tag-Fotos" : "Dieses Album"}
            </button>
            <button
              type="button"
              onClick={() => setCoverTab("search")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                coverTab === "search"
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              <Search className="w-3 h-3" />
              Alle Fotos durchsuchen
            </button>
          </div>

          {/* Tab: Dieses Album / Tag-Fotos */}
          {coverTab === "album" && (
            albumPhotos.length === 0 ? (
              <p className="text-gray-600 text-sm">
                {form.sourceType === "tag"
                  ? "Keine Tag-Fotos geladen (Album muss zuerst gespeichert werden)."
                  : "Dieses Album enthält noch keine Fotos."}
              </p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-52 overflow-y-auto p-1">
                {/* Option: Kein Cover */}
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, coverPhotoId: "" }))}
                  className={`aspect-square rounded-lg border-2 flex items-center justify-center transition-colors ${
                    form.coverPhotoId === ""
                      ? "border-amber-500 bg-amber-500/10"
                      : "border-gray-700 bg-gray-800 hover:border-gray-600"
                  }`}
                  title="Kein Cover"
                >
                  <Camera className="w-5 h-5 text-gray-500" />
                </button>
                {albumPhotos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, coverPhotoId: String(photo.id) }))}
                    className={`aspect-square rounded-lg border-2 overflow-hidden transition-colors ${
                      form.coverPhotoId === String(photo.id)
                        ? "border-amber-500 ring-2 ring-amber-500/30"
                        : "border-gray-700 hover:border-gray-500"
                    }`}
                    title={photo.title || photo.filename}
                  >
                    <CoverThumb
                      thumbnailUrl={photo.thumbnailUrl}
                      fileUrl={photo.fileUrl}
                      alt={photo.title || photo.filename}
                    />
                  </button>
                ))}
              </div>
            )
          )}

          {/* Tab: Alle Fotos durchsuchen */}
          {coverTab === "search" && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Titel oder Dateiname suchen …"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg pl-9 pr-8 py-2 text-sm focus:outline-none focus:border-amber-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {searchLoading && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                </div>
              )}
              {!searchLoading && searchQuery.trim() && searchResults.length === 0 && (
                <p className="text-gray-600 text-sm text-center py-4">
                  Keine Fotos gefunden.
                </p>
              )}
              {!searchLoading && searchResults.length > 0 && (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-52 overflow-y-auto p-1">
                  {searchResults.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, coverPhotoId: String(photo.id) }))}
                      className={`aspect-square rounded-lg border-2 overflow-hidden transition-colors relative group ${
                        form.coverPhotoId === String(photo.id)
                          ? "border-amber-500 ring-2 ring-amber-500/30"
                          : "border-gray-700 hover:border-gray-500"
                      }`}
                      title={`${photo.title || photo.filename}${photo.albumName ? ` · ${photo.albumName}` : ""}`}
                    >
                      <CoverThumb
                        thumbnailUrl={photo.thumbnailUrl}
                        fileUrl={photo.fileUrl}
                        alt={photo.title || photo.filename}
                      />
                      {photo.albumName && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[9px] px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity leading-tight">
                          {photo.albumName}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {!searchQuery.trim() && (
                <p className="text-gray-600 text-sm text-center py-4">
                  Suchbegriff eingeben, um Fotos aus allen Alben zu finden.
                </p>
              )}
            </div>
          )}

          {form.coverPhotoId && (
            <p className="text-xs text-amber-400 mt-2">
              ✓ Cover ausgewählt: Foto #{form.coverPhotoId}
            </p>
          )}
        </div>

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
          <p className="text-gray-500 text-xs mt-1">
            Legt fest, wie direkte Unteralben dieses Albums sortiert werden.
          </p>
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
          <p className="text-gray-500 text-xs mt-1">
            Legt fest, in welcher Reihenfolge die Fotos im Album angezeigt werden.
          </p>
        </div>

        <div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-amber-500"
            />
            <span className="text-gray-300 text-sm font-medium">Album ist aktiv</span>
          </label>
        </div>

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

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Speichern
          </button>
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
