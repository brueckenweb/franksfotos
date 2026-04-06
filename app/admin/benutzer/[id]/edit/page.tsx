"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Save, Loader2, Trash2, User, Camera,
  ShieldCheck, ChevronDown, ChevronUp,
} from "lucide-react";
import UserPermissionsEditor from "./UserPermissionsEditor";

type Group = { id: number; name: string; slug: string; description: string | null };

export default function EditBenutzerPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [error, setError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Alle verfügbaren Gruppen aus der DB
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  // Aktuell ausgewählte Gruppen-Slugs dieses Benutzers
  const [selectedGroupSlugs, setSelectedGroupSlugs] = useState<Set<string>>(new Set());

  const [form, setForm] = useState({
    name: "",
    email: "",
    newPassword: "",
    isActive: true,
    avatar: "",
  });

  const [isMainAdmin, setIsMainAdmin] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        // Parallel: Benutzer-Daten + alle Gruppen laden
        const [userRes, groupsRes] = await Promise.all([
          fetch(`/api/users/${userId}`),
          fetch(`/api/groups`),
        ]);

        const userData = await userRes.json();
        const groupsData = await groupsRes.json();

        if (userData.user) {
          const groupSlugs: string[] = (userData.groups ?? []).map(
            (g: { groupSlug: string }) => g.groupSlug
          );
          setForm({
            name: userData.user.name,
            email: userData.user.email,
            newPassword: "",
            isActive: userData.user.isActive,
            avatar: userData.user.avatar || "",
          });
          setIsMainAdmin(userData.user.isMainAdmin);
          setSelectedGroupSlugs(new Set(groupSlugs));
        }

        if (groupsData.groups) {
          setAllGroups(groupsData.groups);
        }
      } catch {
        setError("Benutzer konnte nicht geladen werden");
      } finally {
        setFetching(false);
      }
    }
    load();
  }, [userId]);

  function toggleGroup(slug: string) {
    setSelectedGroupSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Nur Bilddateien erlaubt");
      return;
    }

    setAvatarUploading(true);
    setError("");

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("target", "avatars");
      fd.append("generateUniqueName", "true");

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload fehlgeschlagen");
      }
      const data = await res.json();
      setForm((p) => ({ ...p, avatar: data.fileUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Avatar-Upload fehlgeschlagen");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const payload: Record<string, unknown> = {
      name: form.name,
      isActive: form.isActive,
      avatar: form.avatar || null,
      groupSlugs: Array.from(selectedGroupSlugs),
    };
    if (form.newPassword) payload.password = form.newPassword;

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Fehler beim Speichern");
        return;
      }

      router.push("/admin/benutzer");
      router.refresh();
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Benutzer "${form.name}" wirklich löschen?`)) return;
    try {
      await fetch(`/api/users/${userId}`, { method: "DELETE" });
      router.push("/admin/benutzer");
      router.refresh();
    } catch {
      setError("Fehler beim Löschen");
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/benutzer"
            className="text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Benutzer bearbeiten</h1>
            <p className="text-gray-400 text-sm mt-0.5">{form.email}</p>
          </div>
        </div>
        {!isMainAdmin && (
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg px-3 py-2 text-sm transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Löschen
          </button>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5 mb-6"
      >
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {isMainAdmin && (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg px-4 py-3 text-sm">
            ⚠️ Dies ist der Hauptadmin. Gruppen-Änderungen sind gesperrt.
          </div>
        )}

        {/* Avatar */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Avatar</label>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
              {form.avatar ? (
                <img src={form.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-7 h-7 text-gray-500" />
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
              >
                {avatarUploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
                {avatarUploading ? "Wird hochgeladen…" : "Bild hochladen"}
              </button>
              {form.avatar && (
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, avatar: "" }))}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors text-left"
                >
                  Avatar entfernen
                </button>
              )}
            </div>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* E-Mail (gesperrt) */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">E-Mail</label>
          <input
            type="email"
            value={form.email}
            disabled
            className="w-full bg-gray-800/50 border border-gray-700 text-gray-500 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
          />
        </div>

        {/* Passwort */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Neues Passwort{" "}
            <span className="text-gray-600 font-normal">(leer lassen = unverändert)</span>
          </label>
          <input
            type="password"
            value={form.newPassword}
            onChange={(e) => setForm((p) => ({ ...p, newPassword: e.target.value }))}
            placeholder="Neues Passwort"
            minLength={8}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
          />
        </div>

        {/* Gruppen – dynamisch aus DB */}
        {!isMainAdmin && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Gruppen</label>
            {allGroups.length === 0 ? (
              <p className="text-xs text-gray-600">Keine Gruppen gefunden</p>
            ) : (
              <div className="space-y-2">
                {allGroups.map((g) => (
                  <label key={g.slug} className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedGroupSlugs.has(g.slug)}
                      onChange={() => toggleGroup(g.slug)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-amber-500"
                    />
                    <span className="text-gray-300 text-sm font-medium">{g.name}</span>
                    {g.description && (
                      <span className="text-gray-500 text-xs">– {g.description}</span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Konto aktiv */}
        <div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
              disabled={isMainAdmin}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-amber-500 disabled:opacity-50"
            />
            <span className={`text-sm ${isMainAdmin ? "text-gray-600" : "text-gray-300"}`}>
              Konto aktiv
            </span>
          </label>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading || avatarUploading}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Speichern
          </button>
          <Link
            href="/admin/benutzer"
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            Abbrechen
          </Link>
        </div>
      </form>

      {/* Individuelle Berechtigungen */}
      {!isMainAdmin && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowPermissions((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-800/40 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-gray-300">
                Individuelle Berechtigungen
              </span>
              <span className="text-xs text-gray-600">
                – Überschreiben die Gruppenrechte
              </span>
            </div>
            {showPermissions ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </button>

          {showPermissions && (
            <div className="px-6 pb-6 border-t border-gray-800">
              <p className="text-xs text-gray-600 mt-4 mb-5">
                Hier kannst du einzelne Rechte für diesen Benutzer gewähren (
                <span className="text-green-400">+</span>) oder entziehen (
                <span className="text-red-400">−</span>), unabhängig von seinen Gruppen.
                Klicke auf <strong className="text-gray-500">G</strong>, um einen individuellen
                Override zu entfernen und wieder das Gruppenrecht gelten zu lassen.
              </p>
              <UserPermissionsEditor userId={userId} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
