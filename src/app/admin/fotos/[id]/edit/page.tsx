"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, Tag as TagIcon } from "lucide-react";
import PhotoZoom from "@/app/foto/[id]/PhotoZoom";
import ExifBox from "@/app/foto/[id]/ExifBox";

interface Album {
  id: number;
  name: string;
}

interface Tag {
  id: number;
  name: string;
  slug: string;
}

export default function EditFotoPage() {
  const router = useRouter();
  const params = useParams();
  const photoId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [photoFileUrl, setPhotoFileUrl] = useState("");
  const [photoAlt, setPhotoAlt] = useState("Vorschau");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [exifData, setExifData] = useState<Record<string, any> | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    albumId: "",
    isPrivate: false,
    sortOrder: "0",
    bnummer: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const [photoRes, albumsRes, tagsRes] = await Promise.all([
          fetch(`/api/photos/${photoId}`),
          fetch("/api/albums"),
          fetch("/api/tags"),
        ]);
        const photoData = await photoRes.json();
        const albumsData = await albumsRes.json();
        const tagsData = await tagsRes.json();

        if (photoData.photo) {
          setForm({
            title: photoData.photo.title || "",
            description: photoData.photo.description || "",
            albumId: photoData.photo.albumId ? String(photoData.photo.albumId) : "",
            isPrivate: photoData.photo.isPrivate || false,
            sortOrder: String(photoData.photo.sortOrder ?? 0),
            bnummer: photoData.photo.bnummer || "",
          });
          setPhotoFileUrl(photoData.photo.fileUrl || "");
          setPhotoAlt(photoData.photo.title || photoData.photo.filename || "Vorschau");
          setExifData(photoData.photo.exifData ?? null);

          if (photoData.photo.tags) {
            setSelectedTagIds(photoData.photo.tags.map((t: Tag) => t.id));
          }
        }

        setAlbums(albumsData.albums || []);
        setAllTags(tagsData.tags || []);
      } catch {
        setError("Foto konnte nicht geladen werden");
      } finally {
        setFetching(false);
      }
    }
    load();
  }, [photoId]);

  function toggleTag(tagId: number) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/photos/${photoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title || null,
          description: form.description || null,
          albumId: form.albumId ? parseInt(form.albumId) : null,
          isPrivate: form.isPrivate,
          sortOrder: parseInt(form.sortOrder) || 0,
          bnummer: form.bnummer || null,
          tagIds: selectedTagIds,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Fehler beim Speichern");
        return;
      }

      router.push("/admin/fotos");
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
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/fotos" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Foto bearbeiten</h1>
          {photoAlt && <p className="text-gray-500 text-sm mt-0.5">{photoAlt}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Linke Spalte: Bild + ExifBox */}
        <div className="space-y-4">
          {/* Foto mit Zoom */}
          {photoFileUrl && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <PhotoZoom src={photoFileUrl} alt={photoAlt} />
            </div>
          )}

          {/* EXIF-Daten */}
          <ExifBox exifData={exifData} />
        </div>

        {/* Rechte Spalte: Formular */}
        <div>
          <form
            onSubmit={handleSubmit}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4"
          >
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Titel</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Optionaler Titel"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
              />
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

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Album</label>
              <select
                value={form.albumId}
                onChange={(e) => setForm((p) => ({ ...p, albumId: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              >
                <option value="">Kein Album</option>
                {albums.map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            {allTags.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <span className="flex items-center gap-1.5">
                    <TagIcon className="w-3.5 h-3.5" />
                    Tags
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {allTags.map((tag) => {
                    const active = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                          active
                            ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                            : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                        }`}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
                {selectedTagIds.length > 0 && (
                  <p className="text-xs text-gray-600 mt-1.5">
                    {selectedTagIds.length} Tag{selectedTagIds.length !== 1 ? "s" : ""} ausgewählt
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Bnummer <span className="text-gray-600 text-xs">(Fotodatenbank)</span>
              </label>
              <input
                type="text"
                value={form.bnummer}
                onChange={(e) => setForm((p) => ({ ...p, bnummer: e.target.value }))}
                placeholder="z.B. B12345"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600 font-mono"
              />
            </div>

            <div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPrivate}
                  onChange={(e) => setForm((p) => ({ ...p, isPrivate: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-amber-500"
                />
                <span className="text-gray-300 text-sm">Privat (nur für mich sichtbar)</span>
              </label>
            </div>

            <div className="flex items-center gap-3 pt-2 border-t border-gray-800">
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
                Speichern
              </button>
              <Link
                href="/admin/fotos"
                className="text-gray-400 hover:text-white text-sm transition-colors"
              >
                Abbrechen
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
