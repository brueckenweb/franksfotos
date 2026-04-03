"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, Tag as TagIcon, Users, Lock, ChevronDown } from "lucide-react";
import PhotoZoom from "@/app/foto/[id]/PhotoZoom";
import ExifBox from "@/app/foto/[id]/ExifBox";
import AlbumTreeSelect, { AlbumOption } from "@/app/admin/alben/AlbumTreeSelect";

interface Tag {
  id: number;
  name: string;
  slug: string;
  groupId: number | null;
  groupName: string | null;
  groupColor: string | null;
}

interface Group {
  id: number;
  name: string;
  slug: string;
  description: string | null;
}

export default function EditFotoPage() {
  const router = useRouter();
  const params = useParams();
  const photoId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [albums, setAlbums] = useState<AlbumOption[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [expandedTagGroups, setExpandedTagGroups] = useState<Set<string>>(new Set());
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
        const [photoRes, albumsRes, tagsRes, groupsRes] = await Promise.all([
          fetch(`/api/photos/${photoId}`),
          fetch("/api/albums"),
          fetch("/api/tags"),
          fetch("/api/groups"),
        ]);
        const photoData = await photoRes.json();
        const albumsData = await albumsRes.json();
        const tagsData = await tagsRes.json();
        const groupsData = await groupsRes.json();

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
          if (photoData.photo.groupIds) {
            setSelectedGroupIds(photoData.photo.groupIds);
          }
        }

        setAlbums(albumsData.albums || []);
        setAllTags(Array.isArray(tagsData) ? tagsData : (tagsData.tags ?? []));
        setAllGroups(groupsData.groups || []);
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

  function toggleTagGroup(groupName: string) {
    setExpandedTagGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  }

  // Tags nach Gruppen gruppieren
  const tagsByGroup = allTags.reduce<Record<string, Tag[]>>((acc, tag) => {
    const key = tag.groupName ?? "Ohne Gruppe";
    if (!acc[key]) acc[key] = [];
    acc[key].push(tag);
    return acc;
  }, {});

  function toggleGroup(groupId: number) {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
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
          groupIds: selectedGroupIds,
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
              <AlbumTreeSelect
                albums={albums}
                value={form.albumId}
                onChange={(val) => setForm((p) => ({ ...p, albumId: val }))}
                noSelectionLabel="— Kein Album —"
              />
            </div>

            {/* Tags – Akkordeon nach Gruppen */}
            {allTags.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <span className="flex items-center gap-1.5">
                    <TagIcon className="w-3.5 h-3.5" />
                    Tags
                    {selectedTagIds.length > 0 && (
                      <span className="ml-1 text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full px-1.5 py-0.5 font-normal">
                        {selectedTagIds.length} ausgewählt
                      </span>
                    )}
                  </span>
                </label>
                <div className="border border-gray-700 rounded-lg overflow-hidden">
                  {Object.entries(tagsByGroup).map(([groupName, groupTags], idx, arr) => {
                    const isOpen = expandedTagGroups.has(groupName);
                    const selectedCount = groupTags.filter((t) =>
                      selectedTagIds.includes(t.id)
                    ).length;
                    return (
                      <div
                        key={groupName}
                        className={idx < arr.length - 1 ? "border-b border-gray-700" : ""}
                      >
                        {/* Gruppen-Header */}
                        <button
                          type="button"
                          onClick={() => toggleTagGroup(groupName)}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-800/60 transition-colors text-left"
                        >
                          <span className="text-sm font-medium text-gray-300">{groupName}</span>
                          <div className="flex items-center gap-2">
                            {selectedCount > 0 && (
                              <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full px-1.5 py-0.5">
                                {selectedCount}
                              </span>
                            )}
                            <ChevronDown
                              className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-150 ${
                                isOpen ? "rotate-180" : ""
                              }`}
                            />
                          </div>
                        </button>
                        {/* Tags der Gruppe */}
                        {isOpen && (
                          <div className="px-3 py-2.5 flex flex-wrap gap-2 bg-gray-800/40 border-t border-gray-700">
                            {groupTags.map((tag) => {
                              const active = selectedTagIds.includes(tag.id);
                              return (
                                <button
                                  key={tag.id}
                                  type="button"
                                  onClick={() => toggleTag(tag.id)}
                                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                                    active
                                      ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                                      : "bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300"
                                  }`}
                                >
                                  {tag.name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
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

            {/* Privat-Einstellung */}
            <div className="border border-gray-800 rounded-lg p-4 space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPrivate}
                  onChange={(e) => setForm((p) => ({ ...p, isPrivate: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-amber-500"
                />
                <span className="flex items-center gap-1.5 text-gray-300 text-sm font-medium">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  Privat (eingeschränkte Sichtbarkeit)
                </span>
              </label>

              {/* Gruppen-Freigabe – immer sichtbar, Hinweis wenn nicht privat */}
              <div>
                <p className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Sichtbar für Benutzergruppen
                  {!form.isPrivate && (
                    <span className="text-gray-600 font-normal">
                      (nur relevant wenn „Privat" aktiv)
                    </span>
                  )}
                </p>

                {allGroups.length === 0 ? (
                  <p className="text-xs text-gray-600">Keine Gruppen vorhanden.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {allGroups.map((group) => {
                      const active = selectedGroupIds.includes(group.id);
                      return (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => toggleGroup(group.id)}
                          title={group.description || group.name}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                            active
                              ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                              : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                          }`}
                        >
                          {group.name}
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedGroupIds.length > 0 && (
                  <p className="text-xs text-gray-600 mt-1.5">
                    {selectedGroupIds.length} Gruppe{selectedGroupIds.length !== 1 ? "n" : ""} freigeschaltet
                  </p>
                )}
              </div>
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
