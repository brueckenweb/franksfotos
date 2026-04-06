"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Plus, Globe, Map, List, X, Check, Loader2, Pencil, Trash2, MapPin, Star, ChevronDown, Share2, Copy, ExternalLink } from "lucide-react";
import type { VisitedCountry, CityMarker, SightMarker } from "@/components/reisen/WorldMap";
import ReisenStats from "@/components/reisen/ReisenStats";
import { COUNTRIES, COUNTRY_MAP } from "@/lib/reisen/countries";

const WorldMap = dynamic(() => import("@/components/reisen/WorldMap"), { ssr: false, loading: () => (
  <div className="w-full rounded-xl border border-gray-700 bg-gray-900 flex items-center justify-center" style={{ height: 500 }}>
    <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
  </div>
) });

interface TravelMap {
  id: number;
  name: string;
  description: string | null;
  userId: number;
  partnerId: number | null;
  ownerName: string;
  partnerName: string | null;
  countries: VisitedCountry[];
  cities: CityMarker[];
  sights: SightMarker[];
}

interface UserOption { id: number; name: string; }

const SIGHT_CATEGORIES = ["Museum", "Naturdenkmal", "Burg/Schloss", "Kirche/Dom", "Denkmal", "Strand", "Park", "Aussichtspunkt", "Sonstiges"];

// ─── Modals ────────────────────────────────────────────────────────────────

function CountryModal({ code, name, existing, partnerName, onSave, onDelete, onClose }: {
  code: string; name: string; existing: VisitedCountry | null;
  partnerName: string | null;
  onSave: (data: { visitedBy: string; visitedAt: string; notes: string }) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [visitedBy, setVisitedBy] = useState(existing?.visitedBy ?? "user1");
  const [visitedAt, setVisitedAt] = useState(existing?.visitedAt?.substring(0, 10) ?? "");
  const [notes, setNotes]         = useState(existing?.notes ?? "");
  const [saving, setSaving]       = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave({ visitedBy, visitedAt, notes });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[2000] flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold text-lg">{name}</h3>
            <p className="text-gray-400 text-xs">{code}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {/* Wer hat bereist */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Bereist von</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: "user1", label: "Nur ich", color: "blue" },
                ...(partnerName ? [{ val: "user2", label: partnerName, color: "orange" }] : []),
                { val: "both",  label: "Gemeinsam", color: "green" },
              ].map((opt) => (
                <button key={opt.val} onClick={() => setVisitedBy(opt.val)}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                    visitedBy === opt.val
                      ? opt.color === "blue"   ? "bg-blue-500 border-blue-400 text-white"
                      : opt.color === "orange" ? "bg-orange-500 border-orange-400 text-white"
                      : "bg-green-500 border-green-400 text-white"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {/* Datum */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Datum (optional)</label>
            <input type="date" value={visitedAt} onChange={(e) => setVisitedAt(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
          </div>
          {/* Notiz */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Notiz</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none"
              placeholder="Kurze Notiz..." maxLength={500} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between">
          {existing ? (
            <button onClick={onDelete} className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1">
              <Trash2 className="w-4 h-4" />Entfernen
            </button>
          ) : <div />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Abbrechen</button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/40 text-white px-4 py-2 rounded-lg text-sm font-medium">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CityOrSightModal({ type, mapId, cities, partnerName, initialLat, initialLng, onSaved, onClose }: {
  type: "city" | "sight"; mapId: number; cities: CityMarker[];
  partnerName: string | null; initialLat?: number; initialLng?: number;
  onSaved: () => void; onClose: () => void;
}) {
  const [name, setName]           = useState("");
  const [countryCode, setCC]      = useState("DE");
  const [lat, setLat]             = useState(initialLat?.toFixed(5) ?? "");
  const [lng, setLng]             = useState(initialLng?.toFixed(5) ?? "");
  const [visitedBy, setVisitedBy] = useState("user1");
  const [visitedAt, setVisitedAt] = useState("");
  const [notes, setNotes]         = useState("");
  const [category, setCategory]   = useState("Sonstiges");
  const [cityId, setCityId]       = useState<string>("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoMsg, setGeoMsg]         = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const countryName = COUNTRY_MAP.get(countryCode)?.name ?? "";

  /** Geocoding via Nominatim – sucht Stadtname und füllt lat/lng/Land */
  async function searchGeo() {
    const q = name.trim();
    if (!q) { setGeoMsg({ type: "err", text: "Bitte zuerst einen Namen eingeben." }); return; }
    setGeoLoading(true);
    setGeoMsg(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=1&accept-language=de`;
      const res = await fetch(url, { headers: { "User-Agent": "FranksFotos/1.0" } });
      const data: Array<{
        lat: string; lon: string;
        display_name: string;
        address?: { country_code?: string };
      }> = await res.json();
      if (!data || data.length === 0) {
        setGeoMsg({ type: "err", text: `„${q}" wurde nicht gefunden.` });
        return;
      }
      const hit = data[0];
      setLat(parseFloat(hit.lat).toFixed(5));
      setLng(parseFloat(hit.lon).toFixed(5));
      // Länderkürzel aus Ergebnis übernehmen, wenn vorhanden
      const cc = hit.address?.country_code?.toUpperCase();
      if (cc && COUNTRY_MAP.has(cc)) setCC(cc);
      setGeoMsg({ type: "ok", text: `✓ ${hit.display_name}` });
    } catch {
      setGeoMsg({ type: "err", text: "Geocoding-Fehler. Bitte Koordinaten manuell eingeben." });
    } finally {
      setGeoLoading(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) { setError("Name ist erforderlich"); return; }
    setSaving(true);
    setError(null);
    try {
      const url = type === "city"
        ? `/api/reisen/${mapId}/cities`
        : `/api/reisen/${mapId}/sights`;
      const body = type === "city"
        ? { name, countryCode, countryName, lat: lat || null, lng: lng || null, visitedBy, visitedAt: visitedAt || null, notes: notes || null }
        : { name, category, cityId: cityId || null, countryCode, countryName, lat: lat || null, lng: lng || null, visitedBy, visitedAt: visitedAt || null, notes: notes || null };
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Fehler"); return; }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[2000] flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-white font-semibold">{type === "city" ? "Stadt hinzufügen" : "Sehenswürdigkeit hinzufügen"}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Name *</label>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => { setName(e.target.value); setGeoMsg(null); }}
                onKeyDown={(e) => e.key === "Enter" && searchGeo()}
                className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                placeholder={type === "city" ? "z.B. Paris" : "z.B. Eiffelturm"}
              />
              <button
                type="button"
                onClick={searchGeo}
                disabled={geoLoading}
                title="Koordinaten per Name suchen (Nominatim/OSM)"
                className="flex items-center gap-1 bg-sky-700 hover:bg-sky-600 disabled:bg-sky-900 text-white px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap"
              >
                {geoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                Suchen
              </button>
            </div>
          </div>
          {type === "sight" && (
            <>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Kategorie</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
                  {SIGHT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              {cities.length > 0 && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Stadt (optional)</label>
                  <select value={cityId} onChange={(e) => setCityId(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
                    <option value="">– Keine –</option>
                    {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
            </>
          )}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Land</label>
            <select value={countryCode} onChange={(e) => setCC(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
              {COUNTRIES.sort((a, b) => a.name.localeCompare(b.name, "de")).map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Breite (lat)</label>
              <input value={lat} onChange={(e) => setLat(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" placeholder="48.8566" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Länge (lng)</label>
              <input value={lng} onChange={(e) => setLng(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" placeholder="2.3522" />
            </div>
          </div>
          {geoMsg && (
            <p className={`text-xs px-1 truncate ${geoMsg.type === "ok" ? "text-green-400" : "text-red-400"}`} title={geoMsg.text}>
              {geoMsg.text}
            </p>
          )}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Bereist von</label>
            <div className="flex gap-2">
              {[{ val: "user1", label: "Ich" }, ...(partnerName ? [{ val: "user2", label: partnerName }] : []), { val: "both", label: "Gemeinsam" }].map((o) => (
                <button key={o.val} onClick={() => setVisitedBy(o.val)}
                  className={`flex-1 py-1.5 rounded-lg text-xs border transition-colors ${visitedBy === o.val ? "bg-amber-500 border-amber-400 text-white" : "bg-gray-800 border-gray-700 text-gray-400"}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Datum</label>
            <input type="date" value={visitedAt} onChange={(e) => setVisitedAt(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Notiz</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none" maxLength={500} />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Abbrechen</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/40 text-white px-4 py-2 rounded-lg text-sm font-medium">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Neue Karte anlegen ────────────────────────────────────────────────────

function NeueKarteModal({ users, onCreated, onClose }: { users: UserOption[]; onCreated: (id: number) => void; onClose: () => void; }) {
  const [name, setName]       = useState("Meine Weltreise");
  const [desc, setDesc]       = useState("");
  const [partnerId, setPId]   = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) { setError("Name erforderlich"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/reisen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: desc || null, partnerId: partnerId || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Fehler"); return; }
      onCreated(data.id);
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[2000] flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-white font-semibold">Neue Reisekarte</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Beschreibung</label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Reisepartner (optional)</label>
            <select value={partnerId} onChange={(e) => setPId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
              <option value="">– Kein Partner –</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Abbrechen</button>
          <button onClick={handleCreate} disabled={saving}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/40 text-white px-4 py-2 rounded-lg text-sm font-medium">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Erstellen
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Hauptkomponente ───────────────────────────────────────────────────────

export default function ReisenClient({ currentUserId }: { currentUserId: number }) {
  const [maps, setMaps]       = useState<TravelMap[]>([]);
  const [activeMap, setActive] = useState<TravelMap | null>(null);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [loading, setLoading]  = useState(true);
  const [activeTab, setActiveTab] = useState<"karte" | "formular" | "liste">("karte");

  // Modals
  const [countryModal, setCountryModal]   = useState<{ code: string; name: string; existing: VisitedCountry | null } | null>(null);
  const [cityModal, setCityModal]         = useState<{ type: "city" | "sight"; lat?: number; lng?: number } | null>(null);
  const [neueKarteModal, setNeueKarteModal] = useState(false);

  // Zuletzt auf der Karte angeklickte Position (für Stadt/Sehenswürdigkeit)
  const [lastClickedPos, setLastClickedPos] = useState<{ lat: number; lng: number } | null>(null);

  // Welche Karte ist aktiv: Länder oder Städte/Sehenswürdigkeiten
  const [mapView, setMapView] = useState<"laender" | "staedte">("laender");

  // Formular-State
  const [fCountry, setFCountry] = useState("DE");
  const [fVisitedBy, setFVBy]   = useState("user1");
  const [fDate, setFDate]       = useState("");
  const [fNotes, setFNotes]     = useState("");
  const [fSaving, setFSaving]   = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied]       = useState(false);

  function handleCopy() {
    const url = `${window.location.origin}/weltreise/${activeMap?.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const loadMaps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reisen");
      const list = await res.json();
      setMaps(list);
      if (list.length > 0 && !activeMap) {
        // Detail der ersten Karte laden
        const detail = await fetch(`/api/reisen/${list[0].id}`).then((r) => r.json());
        setActive(detail);
      } else if (activeMap) {
        const detail = await fetch(`/api/reisen/${activeMap.id}`).then((r) => r.json());
        setActive(detail);
      }
    } finally { setLoading(false); }
  }, [activeMap]);

  useEffect(() => { loadMaps(); }, []);
  useEffect(() => {
    fetch("/api/reisen/users").then((r) => r.json()).then(setAllUsers).catch(() => {});
  }, []);

  async function switchMap(id: number) {
    const detail = await fetch(`/api/reisen/${id}`).then((r) => r.json());
    setActive(detail);
  }

  // Land-Klick → Modal öffnen
  function handleCountryClick(code: string, name: string, existing: VisitedCountry | null) {
    setCountryModal({ code, name, existing });
  }

  async function handleCountrySave(data: { visitedBy: string; visitedAt: string; notes: string }) {
    if (!activeMap || !countryModal) return;
    await fetch(`/api/reisen/${activeMap.id}/countries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countryCode: countryModal.code, ...data }),
    });
    setCountryModal(null);
    loadMaps();
  }

  async function handleCountryDelete() {
    if (!activeMap || !countryModal) return;
    await fetch(`/api/reisen/${activeMap.id}/countries`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countryCode: countryModal.code }),
    });
    setCountryModal(null);
    loadMaps();
  }

  async function handleFormularSave() {
    if (!activeMap) return;
    setFSaving(true);
    try {
      await fetch(`/api/reisen/${activeMap.id}/countries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryCode: fCountry, visitedBy: fVisitedBy, visitedAt: fDate || null, notes: fNotes || null }),
      });
      setFDate(""); setFNotes("");
      await loadMaps();
    } finally { setFSaving(false); }
  }

  async function deleteCity(id: number) {
    if (!activeMap) return;
    await fetch(`/api/reisen/${activeMap.id}/cities/${id}`, { method: "DELETE" });
    loadMaps();
  }

  async function deleteSight(id: number) {
    if (!activeMap) return;
    await fetch(`/api/reisen/${activeMap.id}/sights/${id}`, { method: "DELETE" });
    loadMaps();
  }

  if (loading && !activeMap) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500/10 rounded-lg p-2.5">
            <Globe className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Meine Reisen</h1>
<h2 className="text-gray-800 text-xl font-semibold">Bereiste Länder, Städte & Sehenswürdigkeiten</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Teilen-Button – für den Eigentümer der aktiven Karte */}
          {activeMap && activeMap.userId === currentUserId && (
            <button
              onClick={() => setShowShare((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                showShare
                  ? "bg-green-600 border-green-500 text-white"
                  : "bg-gray-800 border-gray-700 text-gray-300 hover:border-green-500 hover:text-green-400"
              }`}
            >
              <Share2 className="w-4 h-4" />
              Veröffentlichen
            </button>
          )}
          <button onClick={() => setNeueKarteModal(true)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" />
            Neue Karte
          </button>
        </div>
      </div>

      {/* Share-Panel */}
      {showShare && activeMap && activeMap.userId === currentUserId && (
        <div className="mb-6 bg-green-900/20 border border-green-700/50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Share2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-green-300 text-sm font-medium mb-1">Öffentliche Karte teilen</p>
              <p className="text-gray-400 text-xs mb-3">
                Diese URL zeigt deine bereisten Länder ohne Login – perfekt für Social Media.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-amber-300 truncate">
                  {typeof window !== "undefined" ? `${window.location.origin}/weltreise/${activeMap.id}` : `/weltreise/${activeMap.id}`}
                </code>
                <button
                  onClick={handleCopy}
                  title="URL kopieren"
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    copied
                      ? "bg-green-600 text-white"
                      : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                  }`}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Kopiert!" : "Kopieren"}
                </button>
                <a
                  href={`/weltreise/${activeMap.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                  title="Seite öffnen"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Karten-Auswahl (falls mehrere) */}
      {maps.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {maps.map((m) => (
            <button key={m.id} onClick={() => switchMap(m.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap border transition-colors ${
                activeMap?.id === m.id ? "bg-amber-500 border-amber-400 text-white" : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
              }`}>
              <Map className="w-3.5 h-3.5" />{m.name}
            </button>
          ))}
        </div>
      )}

      {!activeMap ? (
        /* Keine Karte */
        <div className="text-center py-20 bg-gray-900 border border-gray-800 rounded-xl">
          <Globe className="w-16 h-16 text-gray-700 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-400 mb-2">Noch keine Reisekarte</h2>
          <p className="text-gray-500 mb-6">Erstelle deine erste Karte und beginne deine Reisen einzutragen.</p>
          <button onClick={() => setNeueKarteModal(true)}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white px-5 py-2.5 rounded-lg font-medium">
            <Plus className="w-4 h-4" />Erste Karte erstellen
          </button>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
            {([["karte", "Weltkarte", Map], ["formular", "Formular", List], ["liste", "Listen", List]] as const).map(([tab, label, Icon]) => (
              <button key={tab} onClick={() => setActiveTab(tab as "karte" | "formular" | "liste")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab ? "bg-amber-500 text-white" : "text-gray-400 hover:text-white"
                }`}>
                <Icon className="w-4 h-4" />{label}
              </button>
            ))}
          </div>

          {/* Tab: Karte */}
          {activeTab === "karte" && (
            <div>
              {/* Karten-Modus-Toggle */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <div className="flex bg-gray-800 border border-gray-700 rounded-lg p-0.5 gap-0.5">
                  <button
                    onClick={() => setMapView("laender")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      mapView === "laender" ? "bg-amber-500 text-white" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />Länderkarte
                  </button>
                  <button
                    onClick={() => setMapView("staedte")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      mapView === "staedte" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" />Städte & Sehenswürdigkeiten
                  </button>
                </div>

                {mapView === "laender" && (
                  <span className="text-xs text-gray-500">Klicke auf ein Land, um es als bereist zu markieren.</span>
                )}

                {mapView === "staedte" && (
                  <>
                    {lastClickedPos && (
                      <span className="text-xs text-gray-500 bg-gray-800 rounded px-2 py-1">
                        📍 {lastClickedPos.lat.toFixed(3)}, {lastClickedPos.lng.toFixed(3)}
                      </span>
                    )}
                    <button
                      onClick={() => setCityModal({ type: "city", lat: lastClickedPos?.lat, lng: lastClickedPos?.lng })}
                      className="ml-auto flex items-center gap-1 bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
                    >
                      <MapPin className="w-3.5 h-3.5" />Stadt hinzufügen
                    </button>
                    <button
                      onClick={() => setCityModal({ type: "sight", lat: lastClickedPos?.lat, lng: lastClickedPos?.lng })}
                      className="flex items-center gap-1 bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
                    >
                      <Star className="w-3.5 h-3.5" />Sehenswürdigkeit
                    </button>
                  </>
                )}
              </div>

              {/* Länderkarte: bereiste Länder eingefärbt, keine Stadtmarker */}
              {mapView === "laender" && (
                <WorldMap
                  visitedCountries={activeMap.countries}
                  cities={[]}
                  sights={[]}
                  ownerName={activeMap.ownerName}
                  partnerName={activeMap.partnerName}
                  readOnly={false}
                  onCountryClick={handleCountryClick}
                  onMapClick={() => {}}
                />
              )}

              {/* Städtekarte: nur Marker, keine Länderfärbung */}
              {mapView === "staedte" && (
                <WorldMap
                  visitedCountries={[]}
                  cities={activeMap.cities}
                  sights={activeMap.sights}
                  ownerName={activeMap.ownerName}
                  partnerName={activeMap.partnerName}
                  readOnly={false}
                  onCountryClick={() => {}}
                  onMapClick={(lat, lng) => setLastClickedPos({ lat, lng })}
                />
              )}

              <ReisenStats
                countries={activeMap.countries}
                cities={activeMap.cities}
                sights={activeMap.sights}
                ownerName={activeMap.ownerName}
                partnerName={activeMap.partnerName}
              />
            </div>
          )}

          {/* Tab: Formular */}
          {activeTab === "formular" && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-lg">
              <h3 className="text-white font-semibold mb-4">Land hinzufügen</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Land *</label>
                  <select value={fCountry} onChange={(e) => setFCountry(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
                    {COUNTRIES.sort((a, b) => a.name.localeCompare(b.name, "de")).map((c) => (
                      <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Bereist von</label>
                  <div className="flex gap-2">
                    {[
                      { val: "user1", label: "Ich" },
                      ...(activeMap.partnerName ? [{ val: "user2", label: activeMap.partnerName }] : []),
                      { val: "both", label: "Gemeinsam" },
                    ].map((o) => (
                      <button key={o.val} onClick={() => setFVBy(o.val)}
                        className={`flex-1 py-2 rounded-lg text-xs border transition-colors ${fVisitedBy === o.val ? "bg-amber-500 border-amber-400 text-white" : "bg-gray-800 border-gray-700 text-gray-400"}`}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Datum</label>
                  <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Notiz</label>
                  <textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} rows={2}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none" maxLength={500} />
                </div>
                <button onClick={handleFormularSave} disabled={fSaving}
                  className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/40 text-white px-4 py-2.5 rounded-lg text-sm font-medium">
                  {fSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Land speichern
                </button>
              </div>

              {/* Stadt / Sehenswürdigkeit Buttons */}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button onClick={() => setCityModal({ type: "city" })}
                  className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium">
                  <MapPin className="w-4 h-4" />Stadt hinzufügen
                </button>
                <button onClick={() => setCityModal({ type: "sight" })}
                  className="flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium">
                  <Star className="w-4 h-4" />Sehenswürdigkeit
                </button>
              </div>
            </div>
          )}

          {/* Tab: Listen */}
          {activeTab === "liste" && (
            <div className="space-y-6">
              {/* Länder-Liste */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-amber-400" />
                  <h3 className="text-white font-medium">Länder ({activeMap.countries.length})</h3>
                </div>
                {activeMap.countries.length === 0 ? (
                  <p className="px-5 py-6 text-gray-500 text-sm text-center">Noch keine Länder eingetragen.</p>
                ) : (
                  <div className="divide-y divide-gray-800/60">
                    {activeMap.countries.sort((a, b) => a.countryName.localeCompare(b.countryName, "de")).map((c) => (
                      <div key={c.id} className="px-5 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`w-2.5 h-2.5 rounded-full ${c.visitedBy === "both" ? "bg-green-500" : c.visitedBy === "user2" ? "bg-orange-500" : "bg-blue-500"}`} />
                          <div>
                            <span className="text-white text-sm">{c.countryName}</span>
                            {c.visitedAt && <span className="text-gray-500 text-xs ml-2">{new Date(c.visitedAt).toLocaleDateString("de-DE")}</span>}
                          </div>
                        </div>
                        <button onClick={async () => {
                          await fetch(`/api/reisen/${activeMap.id}/countries`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ countryCode: c.countryCode }) });
                          loadMaps();
                        }} className="text-gray-600 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Städte-Liste */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-purple-400" />
                  <h3 className="text-white font-medium">Städte ({activeMap.cities.length})</h3>
                </div>
                {activeMap.cities.length === 0 ? (
                  <p className="px-5 py-6 text-gray-500 text-sm text-center">Noch keine Städte eingetragen.</p>
                ) : (
                  <div className="divide-y divide-gray-800/60">
                    {activeMap.cities.map((c) => (
                      <div key={c.id} className="px-5 py-3 flex items-center justify-between">
                        <div>
                          <span className="text-white text-sm">{c.name}</span>
                          <span className="text-gray-500 text-xs ml-2">{COUNTRY_MAP.get(c.countryCode)?.name ?? c.countryCode}</span>
                        </div>
                        <button onClick={() => deleteCity(c.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sehenswürdigkeiten-Liste */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-400" />
                  <h3 className="text-white font-medium">Sehenswürdigkeiten ({activeMap.sights.length})</h3>
                </div>
                {activeMap.sights.length === 0 ? (
                  <p className="px-5 py-6 text-gray-500 text-sm text-center">Noch keine Sehenswürdigkeiten eingetragen.</p>
                ) : (
                  <div className="divide-y divide-gray-800/60">
                    {activeMap.sights.map((s) => (
                      <div key={s.id} className="px-5 py-3 flex items-center justify-between">
                        <div>
                          <span className="text-white text-sm">{s.name}</span>
                          <span className="text-gray-500 text-xs ml-2">{s.category}</span>
                        </div>
                        <button onClick={() => deleteSight(s.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {countryModal && activeMap && (
        <CountryModal
          code={countryModal.code}
          name={countryModal.name}
          existing={countryModal.existing}
          partnerName={activeMap.partnerName}
          onSave={handleCountrySave}
          onDelete={handleCountryDelete}
          onClose={() => setCountryModal(null)}
        />
      )}
      {cityModal && activeMap && (
        <CityOrSightModal
          type={cityModal.type}
          mapId={activeMap.id}
          cities={activeMap.cities}
          partnerName={activeMap.partnerName}
          initialLat={cityModal.lat}
          initialLng={cityModal.lng}
          onSaved={() => { setCityModal(null); loadMaps(); }}
          onClose={() => setCityModal(null)}
        />
      )}
      {neueKarteModal && (
        <NeueKarteModal
          users={allUsers.filter((u) => u.id !== currentUserId)}
          onCreated={async (id) => {
            setNeueKarteModal(false);
            const detail = await fetch(`/api/reisen/${id}`).then((r) => r.json());
            setActive(detail);
            loadMaps();
          }}
          onClose={() => setNeueKarteModal(false)}
        />
      )}
    </div>
  );
}
