"use client";

import { useState, useEffect, useCallback } from "react";
import {
  StickyNote, Plus, Pencil, Trash2, Check, X,
  ToggleLeft, ToggleRight, Loader2, AlertCircle, RefreshCw, Lock, Globe, UserX,
} from "lucide-react";
import PostItTipTapEditor from "@/components/postit/PostItTipTapEditor";

// ── Typen ─────────────────────────────────────────────────────────────────────
type Sichtbarkeit = "alle" | "angemeldet" | "nicht_angemeldet";

interface PostIt {
  id: number;
  message: string;
  color: string;
  slot: string;
  isActive: boolean;
  sichtbarkeit: Sichtbarkeit;
  createdAt: string;
  updatedAt: string;
}

const COLOR_OPTIONS = [
  { value: "yellow", label: "Gelb",   hex: "#feff9c" },
  { value: "pink",   label: "Rosa",   hex: "#ffb3d9" },
  { value: "blue",   label: "Blau",   hex: "#a8e6ff" },
  { value: "green",  label: "Grün",   hex: "#b8f5b8" },
  { value: "orange", label: "Orange", hex: "#ffd4a3" },
];

const COLOR_BG: Record<string, string> = {
  yellow: "bg-yellow-100",
  pink:   "bg-pink-100",
  blue:   "bg-sky-100",
  green:  "bg-green-100",
  orange: "bg-orange-100",
};

const SICHTBARKEIT_OPTIONS: { value: Sichtbarkeit; label: string; icon: React.ReactNode; desc: string }[] = [
  {
    value: "alle",
    label: "Alle",
    icon: <Globe className="w-4 h-4" />,
    desc: "Für alle Besucher sichtbar",
  },
  {
    value: "nicht_angemeldet",
    label: "Nur Gäste",
    icon: <UserX className="w-4 h-4" />,
    desc: "Nur für nicht eingeloggte Besucher",
  },
  {
    value: "angemeldet",
    label: "Nur Mitglieder",
    icon: <Lock className="w-4 h-4" />,
    desc: "Nur für eingeloggte Nutzer",
  },
];

// ── Hilfskomponenten ──────────────────────────────────────────────────────────

function ColorDot({ color }: { color: string }) {
  const opt = COLOR_OPTIONS.find((c) => c.value === color);
  return (
    <span
      className="inline-block w-4 h-4 rounded-full border border-gray-300 flex-shrink-0"
      style={{ background: opt?.hex ?? "#feff9c" }}
      title={opt?.label}
    />
  );
}

function SichtbarkeitBadge({ sichtbarkeit }: { sichtbarkeit: Sichtbarkeit }) {
  if (sichtbarkeit === "angemeldet") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full whitespace-nowrap">
        <Lock className="w-3 h-3" /> Nur Mitglieder
      </span>
    );
  }
  if (sichtbarkeit === "nicht_angemeldet") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-blue-400 bg-blue-400/10 border border-blue-400/30 px-2 py-0.5 rounded-full whitespace-nowrap">
        <UserX className="w-3 h-3" /> Nur Gäste
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-green-400 bg-green-400/10 border border-green-400/30 px-2 py-0.5 rounded-full whitespace-nowrap">
      <Globe className="w-3 h-3" /> Alle
    </span>
  );
}

function fmtDate(raw: string) {
  try {
    const d = raw.includes("Z") || raw.includes("+") ? raw : raw.replace(" ", "T") + "Z";
    return new Date(d).toLocaleString("de-DE", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return raw; }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function isEmptyHtml(html: string): boolean {
  return !stripHtml(html);
}

// ── Formular ──────────────────────────────────────────────────────────────────
interface FormState {
  message: string;
  color: string;
  slot: string;
  sichtbarkeit: Sichtbarkeit;
}

const EMPTY_FORM: FormState = { message: "", color: "yellow", slot: "", sichtbarkeit: "alle" };

interface PostItFormProps {
  initial?: FormState & { id?: number };
  onSave: (data: FormState) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
  title: string;
}

function PostItForm({ initial, onSave, onCancel, saving, error, title }: PostItFormProps) {
  const [form, setForm] = useState<FormState>(initial ?? EMPTY_FORM);

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
        <StickyNote className="w-4 h-4 text-amber-400" />
        {title}
      </h3>

      <div className="space-y-4">
        {/* Nachricht */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Nachricht *</label>
          <PostItTipTapEditor
            content={form.message}
            onChange={(html) => set("message", html)}
          />
        </div>

        {/* Slot */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Slot * <span className="text-gray-600">(z.B. home, alben, weltreise)</span>
          </label>
          <input
            type="text"
            value={form.slot}
            onChange={(e) => set("slot", e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
            placeholder="home"
            className="input-field"
          />
        </div>

        {/* Farbe */}
        <div>
          <label className="block text-xs text-gray-400 mb-2">Farbe</label>
          <div className="flex gap-2 flex-wrap">
            {COLOR_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set("color", opt.value)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 text-sm transition-all ${
                  form.color === opt.value
                    ? "border-amber-400 shadow-md"
                    : "border-gray-600 hover:border-gray-500"
                }`}
                style={{ background: opt.hex }}
              >
                <span className="text-gray-800 font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sichtbarkeit – 3-Optionen Segmented Control */}
        <div>
          <label className="block text-xs text-gray-400 mb-2">Sichtbar für</label>
          <div className="grid grid-cols-3 gap-2">
            {SICHTBARKEIT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set("sichtbarkeit", opt.value)}
                className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 text-sm transition-all ${
                  form.sichtbarkeit === opt.value
                    ? "border-amber-400 bg-amber-400/10 text-white"
                    : "border-gray-600 bg-gray-700/50 text-gray-400 hover:border-gray-500 hover:text-gray-300"
                }`}
              >
                <span className={form.sichtbarkeit === opt.value ? "text-amber-400" : ""}>
                  {opt.icon}
                </span>
                <span className="font-medium text-xs">{opt.label}</span>
                <span className="text-xs text-gray-500 text-center leading-tight hidden sm:block">
                  {opt.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-700 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onSave(form)}
            disabled={saving || isEmptyHtml(form.message) || !form.slot.trim()}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/40 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Speichern
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <X className="w-4 h-4" />
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function PostItAdminClient() {
  const [notes, setNotes]         = useState<PostIt[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId]         = useState<number | null>(null);
  const [deleteId, setDeleteId]     = useState<number | null>(null);

  const [saving, setSaving]     = useState(false);
  const [saveErr, setSaveErr]   = useState<string | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/postits");
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Fehler beim Laden"); return; }
      setNotes(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(form: FormState) {
    setSaving(true); setSaveErr(null);
    try {
      const res = await fetch("/api/postit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setSaveErr(data.error ?? "Fehler"); return; }
      setShowCreate(false);
      await load();
    } catch (e) { setSaveErr(String(e)); }
    finally { setSaving(false); }
  }

  async function handleEdit(form: FormState) {
    if (!editId) return;
    setSaving(true); setSaveErr(null);
    try {
      const res = await fetch(`/api/postit/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setSaveErr(data.error ?? "Fehler"); return; }
      setEditId(null);
      await load();
    } catch (e) { setSaveErr(String(e)); }
    finally { setSaving(false); }
  }

  async function handleToggle(note: PostIt) {
    setToggling(note.id);
    try {
      await fetch(`/api/postit/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !note.isActive }),
      });
      await load();
    } catch { /* ignore */ }
    finally { setToggling(null); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/postit/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      await load();
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  }

  const editNote = notes.find((n) => n.id === editId);

  return (
    <div>
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white flex items-center justify-center gap-3">
          <StickyNote className="w-8 h-8 text-amber-400" />
          Post-it Verwaltung
        </h1>
        <p className="text-gray-400 mt-1">Haftnotizen für verschiedene Seiten verwalten</p>
        <div className="flex gap-2 justify-center mt-4">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Aktualisieren
          </button>
          {!showCreate && (
            <button
              onClick={() => { setShowCreate(true); setEditId(null); setSaveErr(null); }}
              className="flex items-center gap-2 text-sm bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Neues Post-It
            </button>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="mb-6">
          <PostItForm
            title="Neues Post-It erstellen"
            onSave={handleCreate}
            onCancel={() => { setShowCreate(false); setSaveErr(null); }}
            saving={saving}
            error={saveErr}
          />
        </div>
      )}

      {editId && editNote && (
        <div className="mb-6">
          <PostItForm
            title={`Post-It #${editId} bearbeiten`}
            initial={{
              message:      editNote.message,
              color:        editNote.color,
              slot:         editNote.slot,
              sichtbarkeit: editNote.sichtbarkeit,
            }}
            onSave={handleEdit}
            onCancel={() => { setEditId(null); setSaveErr(null); }}
            saving={saving}
            error={saveErr}
          />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-700 rounded-xl px-4 py-3 mb-6">
          <AlertCircle className="w-4 h-4" />{error}
        </div>
      )}

      {/* Tabelle */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-amber-400" />
          <span className="text-white font-semibold text-sm">
            {notes.length} Post-It{notes.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />Lade…
          </div>
        ) : notes.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <StickyNote className="w-12 h-12 mx-auto mb-3 opacity-30" />
            Noch keine Post-Its vorhanden.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Farbe</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Slot</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Nachricht</th>
                  <th className="text-center px-5 py-3 text-gray-500 font-medium">Sichtbar für</th>
                  <th className="text-center px-5 py-3 text-gray-500 font-medium">Aktiv</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium hidden md:table-cell">Erstellt</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {notes.map((note, i) => (
                  <tr
                    key={note.id}
                    className={`border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors ${
                      i === notes.length - 1 ? "border-b-0" : ""
                    }`}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <ColorDot color={note.color} />
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${COLOR_BG[note.color] ?? ""} text-gray-800`}>
                          {COLOR_OPTIONS.find((c) => c.value === note.color)?.label ?? note.color}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-3">
                      <code className="text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded text-xs">
                        {note.slot}
                      </code>
                    </td>

                    <td className="px-5 py-3 text-gray-300 max-w-xs">
                      <p className="truncate" title={stripHtml(note.message)}>{stripHtml(note.message)}</p>
                    </td>

                    <td className="px-5 py-3 text-center">
                      <SichtbarkeitBadge sichtbarkeit={note.sichtbarkeit} />
                    </td>

                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => handleToggle(note)}
                        disabled={toggling === note.id}
                        title={note.isActive ? "Deaktivieren" : "Aktivieren"}
                        className="inline-flex items-center justify-center disabled:opacity-50"
                      >
                        {toggling === note.id ? (
                          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                        ) : note.isActive ? (
                          <ToggleRight className="w-6 h-6 text-green-400" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-gray-600" />
                        )}
                      </button>
                    </td>

                    <td className="px-5 py-3 text-right text-gray-500 text-xs hidden md:table-cell whitespace-nowrap">
                      {fmtDate(note.createdAt)}
                    </td>

                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => { setEditId(note.id); setShowCreate(false); setSaveErr(null); }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
                          title="Bearbeiten"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(note.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          title="Löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lösch-Bestätigungsdialog */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-white font-semibold text-lg mb-2">Post-It löschen?</h3>
            <p className="text-gray-400 text-sm mb-6">Das Post-It wird unwiderruflich gelöscht.</p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-600/40 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Löschen
              </button>
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
