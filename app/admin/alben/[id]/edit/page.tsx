"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, Camera } from "lucide-react";
import AlbumTreeSelect from "../../AlbumTreeSelect";
import type { AlbumOption } from "../../AlbumTreeSelect";

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

export default function EditAlbumPage() {
  const router = useRouter();
  const params = useParams();
  const albumId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [albumPhotos, setAlbumPhotos] = useState<AlbumPhoto[]>([]);
  const [allAlbums, setAllAlbums] = useState<AlbumOption[]>([]);

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
    visibleForPublic: false,
    visibleForUser: false,
    visibleForFamilie: false,
  });

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
          const vis =
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
            visibleForPublic: vis.includes("public"),
            visibleForUser: vis.includes("user"),
            visibleForFamilie: vis.includes("familie"),
          });
        }

        setAlbumPhotos(photosData.photos || []);
        // Alle Alben laden – das Filtern (Selbst + Nachkommen ausschließen)
        // übernimmt AlbumTreeSelect via excludeId
        setAllAlbums(allAlbumsData.albums ?? []);
      } catch {
        setError("Album konnte nicht geladen werden");
      } finally {
        setFetching(false);
      }
    }
    load();
  }, [albumId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const visibleForGroups = [];
    if (form.visibleForPublic) visibleForGroups.push("public");
    if (form.visibleForUser) visibleForGroups.push("user");
    if (form.visibleForFamilie) visibleForGroups.push("familie");

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
          visibleForGroups,
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

        {/* Übergeordnetes Album – einklappbares Baummenü */}
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

        {/* Cover-Foto */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5" />
            Cover-Foto
          </label>
          {albumPhotos.length === 0 ? (
            <p className="text-gray-600 text-sm">Dieses Album enthält noch keine Fotos.</p>
          ) : (
            <>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-48 overflow-y-auto p-1">
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
              {form.coverPhotoId && (
                <p className="text-xs text-amber-400 mt-1.5">
                  Cover ausgewählt: Foto #{form.coverPhotoId}
                </p>
              )}
            </>
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
          <div className="space-y-2">
            {[
              { key: "visibleForPublic", label: "Öffentlich (kein Login)", slug: "public" },
              { key: "visibleForUser", label: "Benutzer (eingeloggt)", slug: "user" },
              { key: "visibleForFamilie", label: "Familie", slug: "familie" },
            ].map((group) => (
              <label key={group.key} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form[group.key as keyof typeof form] as boolean}
                  onChange={(e) => setForm((p) => ({ ...p, [group.key]: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-amber-500"
                />
                <span className="text-gray-300 text-sm">{group.label}</span>
                <span className="text-gray-600 text-xs font-mono">{group.slug}</span>
              </label>
            ))}
          </div>
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
