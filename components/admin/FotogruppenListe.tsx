"use client";

/**
 * Fotogruppen-Liste mit CRUD-Formular
 * Tabelle aller fd_fotogruppen-Einträge, filterbar + sortierbar.
 * Modal zum Anlegen / Bearbeiten.
 * Separates Modal für Reisekarten-Zuordnung (inkl. Geocoding für neue Städte).
 */

import { useState, useEffect, Fragment, useRef } from "react";
import Link from "next/link";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Filter,
  EyeOff,
  Eye,
  List,
  FileText,
  ExternalLink,
  CalendarRange,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  AlertTriangle,
  ArrowLeft,
  Map,
  MapPin,
  Link2,
  Unlink,
  Search,
  Globe,
} from "lucide-react";

// ─── Typen ────────────────────────────────────────────────────────────────────

type SortCol = "idfgruppe" | "name" | "adatum" | "edatum" | "eingetragen" | "anzahl" | "gpxTracks";
type SortDir = "asc" | "desc";

interface TravelMap { id: number; name: string; }
interface TravelFotogruppenLink {
  id: number;
  entityType: string;
  entityId: number;
  entityName?: string;
  mapId: number;
  fotogruppeId: number;
  fotogruppeNname: string;
}

interface Fotogruppe {
  idfgruppe:       number;
  name:            string;
  beschreibung:    string;
  adatum:          string | null;
  edatum:          string | null;
  einaktiv:        string;        // "ja" | "nein"
  bartAlt:         number;
  routendatenHtml: string;
  routendatenTk2:  string;
  routendatenKmz:  string;
  eingetragen:     string | null;
  anzahl:          number;        // aus DB (Cache für inaktive Gruppen)
  anzahlFotos?:    number;        // lazy nachgeladen (nur aktive Gruppen)
  anzahlGpxTracks?: number;       // lazy nachgeladen: Anzahl verknüpfter GPX-Tracks
  anzahlReiseLinks?: number;      // lazy nachgeladen: Anzahl Reisekarten-Verknüpfungen
}

interface FormData {
  name:        string;
  beschreibung: string;
  adatum:      string; // YYYY-MM-DD
  edatum:      string;
  einaktiv:    "ja" | "nein";
}

type EntityOption = { id: number; name: string; entityType: string; };

type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    country_code?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    country?: string;
  };
};

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

/** ISO-Datum oder DB-String → TT.MM.JJJJ */
function formatDate(raw: string | null | undefined): string {
  if (!raw) return "–";
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  return raw;
}

/** ISO-Datum oder DB-String → YYYY-MM-DD (für <input type="date">) */
function toInputDate(raw: string | null | undefined): string {
  if (!raw) return "";
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

/** Heutiges Datum als YYYY-MM-DD */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM: FormData = {
  name:        "",
  beschreibung: "",
  adatum:      today(),
  edatum:      today(),
  einaktiv:    "nein",
};

// ─── ReisekarteLinkModal ──────────────────────────────────────────────────────

interface ReisekarteLinkModalProps {
  gruppe: Fotogruppe;
  onClose: () => void;
}

function ReisekarteLinkModal({ gruppe, onClose }: ReisekarteLinkModalProps) {
  // Travel-Maps State
  const [travelMaps,       setTravelMaps]       = useState<TravelMap[]>([]);
  const [travelMapsLoaded, setTravelMapsLoaded] = useState(false);
  const [selMapId,         setSelMapId]         = useState<number | null>(null);
  const [travelLinks,      setTravelLinks]      = useState<TravelFotogruppenLink[]>([]);
  const [travelLinksLoad,  setTravelLinksLoad]  = useState(false);
  const [linkFehler,       setLinkFehler]       = useState<string | null>(null);
  const [linkSaving,       setLinkSaving]       = useState(false);

  // Entity-Suche
  const [entityTyp,        setEntityTyp]        = useState<"country" | "city" | "sight">("city");
  const [entitySuche,      setEntitySuche]      = useState("");
  const [entityOptionen,   setEntityOptionen]   = useState<EntityOption[]>([]);
  const [entitySuchLaeuft, setEntitySuchLaeuft] = useState(false);
  const [selEntity,        setSelEntity]        = useState<EntityOption | null>(null);
  const [keineErgebnisse,  setKeineErgebnisse]  = useState(false);

  // Neue Stadt anlegen (Geocoding-Flow)
  const [neueStadtModus,   setNeueStadtModus]   = useState(false);
  const [neueStadtName,    setNeueStadtName]    = useState("");
  const [neueStadtLat,     setNeueStadtLat]     = useState("");
  const [neueStadtLng,     setNeueStadtLng]     = useState("");
  const [neueStadtCC,      setNeueStadtCC]      = useState("DE");
  const [neueStadtLandName, setNeueStadtLandName] = useState("Deutschland");
  const [geoLoading,       setGeoLoading]       = useState(false);
  const [geoMsg,           setGeoMsg]           = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [neueStadtSaving,  setNeueStadtSaving]  = useState(false);

  // Nominatim Autocomplete
  const [suggestions,      setSuggestions]      = useState<NominatimResult[]>([]);
  const [showSuggestions,  setShowSuggestions]  = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Beim ersten Öffnen: Karten laden
  useEffect(() => {
    ladenTravelMapsInit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ladenTravelMapsInit() {
    if (travelMapsLoaded) return;
    try {
      const res = await fetch("/api/reisen");
      if (!res.ok) return;
      const data = await res.json() as TravelMap[] | { maps?: TravelMap[] };
      const maps = Array.isArray(data) ? data : (data.maps ?? []);
      setTravelMaps(maps);
      setTravelMapsLoaded(true);
      if (maps.length > 0) {
        const firstId = maps[0].id;
        setSelMapId(firstId);
        await ladenTravelLinks(firstId, gruppe.idfgruppe);
      }
    } catch { /* ignorieren */ }
  }

  async function ladenTravelLinks(mapId: number, fotogruppeId: number) {
    setTravelLinksLoad(true);
    setLinkFehler(null);
    try {
      const res = await fetch(
        `/api/reisen/${mapId}/fotogruppen-links?fotogruppeId=${fotogruppeId}`
      );
      if (!res.ok) return;
      const data = await res.json() as TravelFotogruppenLink[];
      setTravelLinks(data);
    } catch { /* ignorieren */ }
    finally { setTravelLinksLoad(false); }
  }

  async function sucheEntities(q: string, mapId: number, typ: "country" | "city" | "sight") {
    if (!q.trim()) { setEntityOptionen([]); setKeineErgebnisse(false); return; }
    setEntitySuchLaeuft(true);
    setKeineErgebnisse(false);
    try {
      const res = await fetch(
        `/api/reisen/${mapId}/entities?q=${encodeURIComponent(q)}&type=${typ}`
      );
      if (!res.ok) { setEntityOptionen([]); return; }
      const data = await res.json() as EntityOption[];
      setEntityOptionen(data);
      setKeineErgebnisse(data.length === 0 && q.trim().length >= 2);
    } catch { setEntityOptionen([]); }
    finally { setEntitySuchLaeuft(false); }
  }

  async function linkHinzufuegen() {
    if (!selEntity || !selMapId) return;
    setLinkSaving(true);
    setLinkFehler(null);
    try {
      const res = await fetch(`/api/reisen/${selMapId}/fotogruppen-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType:      selEntity.entityType,
          entityId:        selEntity.id,
          fotogruppeId:    gruppe.idfgruppe,
          fotogruppeNname: gruppe.name,
        }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setLinkFehler(d.error ?? "Fehler beim Verknüpfen");
        return;
      }
      await ladenTravelLinks(selMapId, gruppe.idfgruppe);
      setSelEntity(null);
      setEntitySuche("");
      setEntityOptionen([]);
      setKeineErgebnisse(false);
    } catch (e) { setLinkFehler(String(e)); }
    finally { setLinkSaving(false); }
  }

  async function linkEntfernen(linkId: number) {
    if (!selMapId) return;
    setLinkFehler(null);
    try {
      const res = await fetch(`/api/reisen/${selMapId}/fotogruppen-links?id=${linkId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setLinkFehler(d.error ?? "Fehler beim Entfernen");
        return;
      }
      setTravelLinks((prev) => prev.filter((l) => l.id !== linkId));
    } catch (e) { setLinkFehler(String(e)); }
  }

  // ── Geocoding / neue Stadt ────────────────────────────────────────

  function handleNeueStadtNameChange(value: string) {
    setNeueStadtName(value);
    setGeoMsg(null);
    setShowSuggestions(false);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (value.trim().length < 2) { setSuggestions([]); return; }
    suggestTimer.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&limit=5&addressdetails=1&accept-language=de`;
        const res = await fetch(url, { headers: { "User-Agent": "FranksFotos/1.0" } });
        const data: NominatimResult[] = await res.json();
        setSuggestions(data ?? []);
        setShowSuggestions((data ?? []).length > 0);
      } catch { /* ignorieren */ }
    }, 400);
  }

  function pickSuggestion(hit: NominatimResult) {
    const primaryName = hit.address?.city ?? hit.address?.town ?? hit.address?.village ?? hit.display_name.split(",")[0].trim();
    setNeueStadtName(primaryName);
    setNeueStadtLat(parseFloat(hit.lat).toFixed(5));
    setNeueStadtLng(parseFloat(hit.lon).toFixed(5));
    const cc = hit.address?.country_code?.toUpperCase() ?? "DE";
    setNeueStadtCC(cc);
    setNeueStadtLandName(hit.address?.country ?? "");
    setGeoMsg({ type: "ok", text: `✓ ${hit.display_name}` });
    setShowSuggestions(false);
    setSuggestions([]);
  }

  async function searchGeo() {
    const q = neueStadtName.trim();
    if (!q) { setGeoMsg({ type: "err", text: "Bitte zuerst einen Namen eingeben." }); return; }
    setGeoLoading(true); setGeoMsg(null); setShowSuggestions(false);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=1&accept-language=de`;
      const res = await fetch(url, { headers: { "User-Agent": "FranksFotos/1.0" } });
      const data: NominatimResult[] = await res.json();
      if (!data || data.length === 0) {
        setGeoMsg({ type: "err", text: `„${q}" wurde nicht gefunden.` });
        return;
      }
      const hit = data[0];
      setNeueStadtLat(parseFloat(hit.lat).toFixed(5));
      setNeueStadtLng(parseFloat(hit.lon).toFixed(5));
      const cc = hit.address?.country_code?.toUpperCase() ?? "DE";
      setNeueStadtCC(cc);
      setNeueStadtLandName(hit.address?.country ?? "");
      setGeoMsg({ type: "ok", text: `✓ ${hit.display_name}` });
    } catch {
      setGeoMsg({ type: "err", text: "Geocoding-Fehler. Bitte Koordinaten manuell eingeben." });
    } finally { setGeoLoading(false); }
  }

  async function neueStadtAnlegenUndVerknuepfen() {
    if (!selMapId || !neueStadtName.trim()) return;
    if (!neueStadtCC) {
      setLinkFehler("Bitte zuerst den Ort geocodieren (Ländercode fehlt).");
      return;
    }
    setNeueStadtSaving(true);
    setLinkFehler(null);
    try {
      // 1. Stadt anlegen
      const cityRes = await fetch(`/api/reisen/${selMapId}/admin-cities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:        neueStadtName.trim(),
          countryCode: neueStadtCC,
          countryName: neueStadtLandName,
          lat:         neueStadtLat || null,
          lng:         neueStadtLng || null,
          visitedBy:   "user1",
        }),
      });
      if (!cityRes.ok) {
        const d = await cityRes.json() as { error?: string };
        setLinkFehler(d.error ?? "Fehler beim Anlegen der Stadt");
        return;
      }
      const cityData = await cityRes.json() as { id: number };
      const newCityId = cityData.id;

      // 2. Fotogruppe mit neuer Stadt verknüpfen
      const linkRes = await fetch(`/api/reisen/${selMapId}/fotogruppen-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType:      "city",
          entityId:        newCityId,
          fotogruppeId:    gruppe.idfgruppe,
          fotogruppeNname: gruppe.name,
        }),
      });
      if (!linkRes.ok) {
        const d = await linkRes.json() as { error?: string };
        setLinkFehler(d.error ?? "Fehler beim Verknüpfen");
        return;
      }

      // Erfolg: Zurücksetzen
      await ladenTravelLinks(selMapId, gruppe.idfgruppe);
      setNeueStadtModus(false);
      setNeueStadtName("");
      setNeueStadtLat("");
      setNeueStadtLng("");
      setNeueStadtCC("DE");
      setNeueStadtLandName("");
      setGeoMsg(null);
      setSuggestions([]);
      setEntitySuche("");
      setEntityOptionen([]);
      setKeineErgebnisse(false);
    } catch (e) { setLinkFehler(String(e)); }
    finally { setNeueStadtSaving(false); }
  }

  // ──────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-10 bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Map className="w-5 h-5 text-purple-400" />
            <div>
              <h2 className="text-white font-semibold text-base">Reisekarte verknüpfen</h2>
              <p className="text-gray-500 text-xs mt-0.5">
                Gruppe: <span className="text-gray-300">{gruppe.name}</span>
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inhalt (scrollbar) */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Karten-Auswahl */}
          {travelMaps.length > 1 && (
            <div>
              <label className="text-gray-500 text-xs uppercase tracking-wide block mb-1.5">Reisekarte</label>
              <select
                value={selMapId ?? ""}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setSelMapId(id);
                  if (id) ladenTravelLinks(id, gruppe.idfgruppe);
                  setEntitySuche("");
                  setEntityOptionen([]);
                  setSelEntity(null);
                  setKeineErgebnisse(false);
                  setNeueStadtModus(false);
                }}
                className="input-field w-full text-sm"
              >
                {travelMaps.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}
          {travelMaps.length === 0 && travelMapsLoaded && (
            <p className="text-gray-600 text-sm text-center py-4">Keine Reisekarten vorhanden.</p>
          )}
          {!travelMapsLoaded && (
            <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Lade Reisekarten…
            </div>
          )}

          {selMapId && (
            <>
              {/* Bestehende Links */}
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Aktuelle Verknüpfungen</p>
                {travelLinksLoad ? (
                  <div className="flex items-center gap-2 text-gray-500 text-xs">
                    <Loader2 className="w-3 h-3 animate-spin" /> Lade Verknüpfungen…
                  </div>
                ) : travelLinks.length > 0 ? (
                  <div className="space-y-1">
                    {travelLinks.map((l) => (
                      <div key={l.id} className="flex items-center justify-between bg-gray-800/60 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 text-xs">
                          <MapPin className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                          <span className="text-gray-400 capitalize">{l.entityType}:</span>
                          <span className="text-gray-200 font-medium">{l.entityName || `ID ${l.entityId}`}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => linkEntfernen(l.id)}
                          className="text-gray-600 hover:text-red-400 transition-colors ml-2"
                          title="Verknüpfung entfernen"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600 text-xs">Noch keine Verknüpfungen für diese Karte.</p>
                )}
              </div>

              <div className="border-t border-gray-800 pt-4">
                <p className="text-gray-500 text-xs uppercase tracking-wide mb-3">Neue Verknüpfung hinzufügen</p>

                {/* Typ-Auswahl + Suche */}
                {!neueStadtModus && (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <select
                        value={entityTyp}
                        onChange={(e) => {
                          setEntityTyp(e.target.value as "country" | "city" | "sight");
                          setEntitySuche("");
                          setEntityOptionen([]);
                          setSelEntity(null);
                          setKeineErgebnisse(false);
                        }}
                        className="input-field text-xs w-28 flex-shrink-0"
                      >
                        <option value="city">Stadt</option>
                        <option value="country">Land</option>
                        <option value="sight">Sehensw.</option>
                      </select>
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={entitySuche}
                          onChange={(e) => {
                            setEntitySuche(e.target.value);
                            setSelEntity(null);
                            if (selMapId) sucheEntities(e.target.value, selMapId, entityTyp);
                          }}
                          placeholder="Name suchen…"
                          className="input-field text-sm w-full pr-7"
                        />
                        {entitySuchLaeuft ? (
                          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 animate-spin" />
                        ) : (
                          <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                        )}
                      </div>
                    </div>

                    {/* Suchergebnisse */}
                    {entityOptionen.length > 0 && !selEntity && (
                      <div className="bg-gray-800 border border-gray-700 rounded-lg divide-y divide-gray-700 max-h-36 overflow-y-auto mb-2">
                        {entityOptionen.map((opt) => (
                          <button
                            key={`${opt.entityType}-${opt.id}`}
                            type="button"
                            onClick={() => { setSelEntity(opt); setEntitySuche(opt.name); setEntityOptionen([]); setKeineErgebnisse(false); }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                          >
                            <MapPin className="w-3 h-3 text-purple-400 flex-shrink-0" />
                            {opt.name}
                            <span className="text-gray-500 text-xs capitalize ml-auto">{opt.entityType}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Keine Ergebnisse + "Neue Stadt anlegen" für Städte */}
                    {keineErgebnisse && !selEntity && entitySuche.trim().length >= 2 && (
                      <div className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2.5 mb-2">
                        <p className="text-gray-500 text-xs mb-2">
                          Keine {entityTyp === "city" ? "Stadt" : entityTyp === "country" ? "Land" : "Sehenswürdigkeit"} „{entitySuche}" in dieser Karte gefunden.
                        </p>
                        {entityTyp === "city" && (
                          <button
                            type="button"
                            onClick={() => {
                              setNeueStadtModus(true);
                              setNeueStadtName(entitySuche);
                              setEntitySuche("");
                              setEntityOptionen([]);
                              setKeineErgebnisse(false);
                              // Geocoding wird automatisch über handleNeueStadtNameChange getriggert
                              // wenn der Nutzer den Namen im Geocoding-Panel bestätigt
                            }}
                            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            Neue Stadt „{entitySuche}" anlegen
                          </button>
                        )}
                      </div>
                    )}

                    {/* Verknüpfen-Button */}
                    {selEntity && (
                      <button
                        type="button"
                        onClick={linkHinzufuegen}
                        disabled={linkSaving}
                        className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/40 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        {linkSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                        Mit „{selEntity.name}" verknüpfen
                      </button>
                    )}
                  </>
                )}

                {/* ── Neue Stadt anlegen (Geocoding-Flow) ── */}
                {neueStadtModus && (
                  <div className="bg-blue-950/30 border border-blue-800/50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-blue-400" />
                        <span className="text-blue-300 text-sm font-medium">Neue Stadt anlegen</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setNeueStadtModus(false); setGeoMsg(null); setSuggestions([]); setNeueStadtName(""); setNeueStadtLat(""); setNeueStadtLng(""); }}
                        className="text-gray-500 hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Name mit Autocomplete */}
                    <div>
                      <label className="text-gray-400 text-xs block mb-1">Stadtname *</label>
                      <div className="relative">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={neueStadtName}
                            onChange={(e) => handleNeueStadtNameChange(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { setShowSuggestions(false); searchGeo(); }
                              if (e.key === "Escape") setShowSuggestions(false);
                            }}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                            className="input-field flex-1 text-sm"
                            placeholder="z.B. Paris (Vorschläge beim Tippen)"
                          />
                          <button
                            type="button"
                            onClick={searchGeo}
                            disabled={geoLoading}
                            title="Koordinaten über Nominatim suchen"
                            className="flex items-center gap-1 bg-sky-700 hover:bg-sky-600 disabled:bg-sky-900 text-white px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap"
                          >
                            {geoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                            Suchen
                          </button>
                        </div>

                        {/* Autocomplete-Dropdown */}
                        {showSuggestions && suggestions.length > 0 && (
                          <div className="absolute z-50 top-full left-0 right-0 bg-gray-800 border border-gray-600 rounded-lg mt-1 max-h-44 overflow-y-auto shadow-2xl">
                            {suggestions.map((hit, i) => {
                              const primary = hit.address?.city ?? hit.address?.town ?? hit.address?.village ?? hit.display_name.split(",")[0].trim();
                              const secondary = hit.display_name.split(",").slice(1).slice(0, 2).join(",").trim();
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  onMouseDown={(e) => { e.preventDefault(); pickSuggestion(hit); }}
                                  className="w-full text-left px-3 py-2 hover:bg-gray-700 border-b border-gray-700/50 last:border-0 flex flex-col gap-0.5"
                                >
                                  <span className="text-white text-sm font-medium truncate">{primary}</span>
                                  {secondary && <span className="text-gray-400 text-xs truncate">{secondary}</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Geocoding-Status */}
                    {geoMsg && (
                      <p className={`text-xs px-1 truncate ${geoMsg.type === "ok" ? "text-green-400" : "text-red-400"}`} title={geoMsg.text}>
                        {geoMsg.text}
                      </p>
                    )}

                    {/* Koordinaten (nur anzeigen, editierbar) */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-gray-400 text-xs block mb-1">Breite (lat)</label>
                        <input
                          type="text"
                          value={neueStadtLat}
                          onChange={(e) => setNeueStadtLat(e.target.value)}
                          className="input-field text-xs w-full"
                          placeholder="48.85341"
                        />
                      </div>
                      <div>
                        <label className="text-gray-400 text-xs block mb-1">Länge (lng)</label>
                        <input
                          type="text"
                          value={neueStadtLng}
                          onChange={(e) => setNeueStadtLng(e.target.value)}
                          className="input-field text-xs w-full"
                          placeholder="2.3488"
                        />
                      </div>
                    </div>

                    {/* Ländercode */}
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>Land:</span>
                      <span className="text-gray-200 font-medium">
                        {neueStadtCC}{neueStadtLandName ? ` – ${neueStadtLandName}` : ""}
                      </span>
                      <input
                        type="text"
                        value={neueStadtCC}
                        onChange={(e) => setNeueStadtCC(e.target.value.toUpperCase().slice(0, 2))}
                        className="input-field text-xs w-12 uppercase"
                        maxLength={2}
                        placeholder="DE"
                      />
                    </div>

                    {/* Aktions-Buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={neueStadtAnlegenUndVerknuepfen}
                        disabled={neueStadtSaving || !neueStadtName.trim()}
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/40 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        {neueStadtSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        Stadt anlegen & verknüpfen
                      </button>
                      <button
                        type="button"
                        onClick={() => { setNeueStadtModus(false); setGeoMsg(null); setSuggestions([]); setNeueStadtName(""); }}
                        className="text-gray-500 hover:text-gray-300 text-sm px-2 py-2 transition-colors"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {linkFehler && (
            <div className="flex items-start gap-2 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2 text-red-400 text-xs">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{linkFehler}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex justify-end flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function FotogruppenListe() {
  const [gruppen,      setGruppen]      = useState<Fotogruppe[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  // Standard: inaktive ausgeblendet
  const [inaktivAusbl, setInaktivAusbl] = useState(true);
  const [suchtext,     setSuchtext]     = useState("");
  const [aufgeklappt,  setAufgeklappt]  = useState<Set<number>>(new Set());
  const [savingIds,    setSavingIds]    = useState<Set<number>>(new Set());
  const [sortCol,         setSortCol]         = useState<SortCol>("adatum");
  const [sortDir,         setSortDir]         = useState<SortDir>("asc");
  const [fotozahlenLaden,   setFotozahlenLaden]   = useState(false);
  const [gpxZahlenLaden,    setGpxZahlenLaden]    = useState(false);
  const [reiseZahlenLaden,  setReiseZahlenLaden]  = useState(false);

  // ── Modal-State ───────────────────────────────────────────────────
  const [modalOffen,    setModalOffen]    = useState(false);
  const [editGruppe,    setEditGruppe]    = useState<Fotogruppe | null>(null); // null = Neu anlegen
  const [formData,      setFormData]      = useState<FormData>(EMPTY_FORM);
  const [formSaving,    setFormSaving]    = useState(false);
  const [formError,     setFormError]     = useState<string | null>(null);
  const [formSuccess,   setFormSuccess]   = useState<string | null>(null);

  // ── Reisekarte-Modal ──────────────────────────────────────────────
  const [reiseModalGruppe, setReiseModalGruppe] = useState<Fotogruppe | null>(null);

  // ── Löschen-State ─────────────────────────────────────────────────
  const [loeschenGruppe,  setLoeschenGruppe]  = useState<Fotogruppe | null>(null);
  const [loeschenLaeuft,  setLoeschenLaeuft]  = useState(false);
  const [loeschenFehler,  setLoeschenFehler]  = useState<string | null>(null);
  // IDs die gerade geprüft werden (Spinner am Button)
  const [pruefenIds,      setPruefenIds]      = useState<Set<number>>(new Set());

  // ── Daten laden ────────────────────────────────────────────────────
  async function laden() {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/fotodatenbank/fotogruppen-liste");
      const data = await res.json();
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Fehler beim Laden");
        return;
      }
      setGruppen(data as Fotogruppe[]);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  // ── Foto-Anzahlen lazy nachladen (nur aktive Gruppen) ─────────────
  async function ladenFotozahlen() {
    setFotozahlenLaden(true);
    try {
      const res = await fetch("/api/fotodatenbank/fotogruppen-fotozahlen");
      if (!res.ok) return;
      const map = await res.json() as Record<string, number>;
      setGruppen((prev) =>
        prev.map((g) => ({
          ...g,
          anzahlFotos: map[g.idfgruppe] ?? (g.einaktiv === "ja" ? 0 : g.anzahlFotos),
        }))
      );
    } catch {
      // Fehler ignorieren – Fotanzahlen sind optional
    } finally {
      setFotozahlenLaden(false);
    }
  }

  // ── GPX-Track-Anzahlen lazy nachladen ─────────────────────────────
  async function ladenGpxZahlen() {
    setGpxZahlenLaden(true);
    try {
      const res = await fetch("/api/fotodatenbank/fotogruppen-gpxzahlen");
      if (!res.ok) return;
      const map = await res.json() as Record<string, number>;
      setGruppen((prev) =>
        prev.map((g) => ({
          ...g,
          anzahlGpxTracks: map[String(g.idfgruppe)] ?? 0,
        }))
      );
    } catch {
      // Fehler ignorieren
    } finally {
      setGpxZahlenLaden(false);
    }
  }

  // ── Reise-Link-Anzahlen lazy nachladen ────────────────────────────
  async function ladenReiseZahlen() {
    setReiseZahlenLaden(true);
    try {
      const res = await fetch("/api/fotodatenbank/fotogruppen-reisezahlen");
      if (!res.ok) return;
      const map = await res.json() as Record<string, number>;
      setGruppen((prev) =>
        prev.map((g) => ({
          ...g,
          anzahlReiseLinks: map[String(g.idfgruppe)] ?? 0,
        }))
      );
    } catch {
      // Fehler ignorieren
    } finally {
      setReiseZahlenLaden(false);
    }
  }

  useEffect(() => {
    laden().then(() => { ladenFotozahlen(); ladenGpxZahlen(); ladenReiseZahlen(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Filter + Sortierung ───────────────────────────────────────────
  const gefiltert = gruppen.filter((g) => {
    if (inaktivAusbl && g.einaktiv === "nein") return false;
    if (suchtext.trim()) {
      const q = suchtext.toLowerCase();
      return (
        g.name.toLowerCase().includes(q) ||
        String(g.idfgruppe).includes(q) ||
        (g.beschreibung ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const sortiert = [...gefiltert].sort((a, b) => {
    let av: string | number = "";
    let bv: string | number = "";
    if (sortCol === "idfgruppe") { av = a.idfgruppe;         bv = b.idfgruppe; }
    else if (sortCol === "name") { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
    else if (sortCol === "anzahl") {
      // Aktive Gruppen: lazy geladener Wert; inaktive: DB-Wert
      av = a.anzahlFotos ?? a.anzahl;
      bv = b.anzahlFotos ?? b.anzahl;
    }
    else if (sortCol === "gpxTracks") {
      av = a.anzahlGpxTracks ?? 0;
      bv = b.anzahlGpxTracks ?? 0;
    }
    else { av = (a[sortCol] ?? "") as string; bv = (b[sortCol] ?? "") as string; }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  function toggleDetails(id: number) {
    setAufgeklappt((prev) => {
      const neu = new Set(prev);
      if (neu.has(id)) neu.delete(id); else neu.add(id);
      return neu;
    });
  }

  // ── einaktiv-Toggle (PATCH) ───────────────────────────────────────
  async function toggleEinaktiv(g: Fotogruppe) {
    const neuerWert: "ja" | "nein" = g.einaktiv === "ja" ? "nein" : "ja";

    // Optimistisches UI-Update
    setGruppen((prev) => prev.map((x) => {
      if (x.idfgruppe !== g.idfgruppe) return x;
      return {
        ...x,
        einaktiv: neuerWert,
        // Wird inaktiv → lazy-geladene Anzahl als DB-Cache übernehmen
        ...(neuerWert === "nein" ? { anzahl: x.anzahlFotos ?? x.anzahl } : {}),
        // Wird aktiv → anzahlFotos löschen damit Lazy-Reload greift
        ...(neuerWert === "ja" ? { anzahlFotos: undefined } : {}),
      };
    }));

    setSavingIds((prev) => new Set(prev).add(g.idfgruppe));
    try {
      const res = await fetch("/api/fotodatenbank/fotogruppen-liste", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idfgruppe: g.idfgruppe, einaktiv: neuerWert }),
      });
      if (!res.ok) {
        // Rollback
        setGruppen((prev) => prev.map((x) => x.idfgruppe === g.idfgruppe
          ? { ...x, einaktiv: g.einaktiv, anzahl: g.anzahl, anzahlFotos: g.anzahlFotos }
          : x
        ));
      } else if (neuerWert === "nein") {
        // Wurde inaktiv → anzahl in DB persistieren (fire-and-forget)
        fetch("/api/fotodatenbank/fotogruppen-anzahl-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idfgruppe: g.idfgruppe }),
        }).catch(() => {});
      } else {
        // Wurde aktiv → Fotozahlen für aktive Gruppen neu laden
        ladenFotozahlen();
      }
    } catch {
      setGruppen((prev) => prev.map((x) => x.idfgruppe === g.idfgruppe
        ? { ...x, einaktiv: g.einaktiv, anzahl: g.anzahl, anzahlFotos: g.anzahlFotos }
        : x
      ));
    } finally {
      setSavingIds((prev) => { const n = new Set(prev); n.delete(g.idfgruppe); return n; });
    }
  }

  // ── Löschen-Dialog öffnen (mit Vorab-Prüfung) ────────────────────
  async function loeschenDialog(g: Fotogruppe) {
    setPruefenIds((prev) => new Set(prev).add(g.idfgruppe));
    setLoeschenFehler(null);
    try {
      const res  = await fetch(`/api/fotodatenbank/fotogruppen-check?idfgruppe=${g.idfgruppe}`);
      const data = await res.json() as { anzahlFotos?: number; error?: string };
      if (!res.ok) {
        setLoeschenFehler(data.error ?? "Prüfung fehlgeschlagen");
      } else if ((data.anzahlFotos ?? 0) > 0) {
        setLoeschenFehler(
          `Löschen nicht möglich – es sind noch ${data.anzahlFotos} Foto(s) mit dieser Gruppe verknüpft.`
        );
      }
    } catch (err) {
      setLoeschenFehler(String(err));
    } finally {
      setPruefenIds((prev) => { const n = new Set(prev); n.delete(g.idfgruppe); return n; });
    }
    setLoeschenGruppe(g);
  }

  // ── Löschen ───────────────────────────────────────────────────────
  async function handleLoeschen() {
    if (!loeschenGruppe) return;
    setLoeschenLaeuft(true);
    setLoeschenFehler(null);
    try {
      const res = await fetch("/api/fotodatenbank/fotogruppen-liste", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ idfgruppe: loeschenGruppe.idfgruppe }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoeschenFehler((data as { error?: string }).error ?? "Fehler beim Löschen");
        return;
      }
      // Erfolgreich: aus lokaler Liste entfernen
      setGruppen((prev) => prev.filter((x) => x.idfgruppe !== loeschenGruppe.idfgruppe));
      setLoeschenGruppe(null);
    } catch (err) {
      setLoeschenFehler(String(err));
    } finally {
      setLoeschenLaeuft(false);
    }
  }

  // ── Modal öffnen ──────────────────────────────────────────────────
  function modalNeu() {
    setEditGruppe(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setFormSuccess(null);
    setModalOffen(true);
  }

  function modalBearbeiten(g: Fotogruppe) {
    setEditGruppe(g);
    setFormData({
      name:        g.name,
      beschreibung: g.beschreibung ?? "",
      adatum:      toInputDate(g.adatum),
      edatum:      toInputDate(g.edatum),
      einaktiv:    g.einaktiv === "ja" ? "ja" : "nein",
    });
    setFormError(null);
    setFormSuccess(null);
    setModalOffen(true);
  }

  function modalSchliessen() {
    setModalOffen(false);
    setEditGruppe(null);
  }

  function setField(key: keyof FormData, value: string) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  // ── Formular absenden (POST oder PUT) ─────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.adatum || !formData.edatum) {
      setFormError("Name, Von- und Bis-Datum sind Pflichtfelder.");
      return;
    }
    setFormSaving(true);
    setFormError(null);
    setFormSuccess(null);

    const payload = {
      ...(editGruppe ? { idfgruppe: editGruppe.idfgruppe } : {}),
      name:            formData.name.trim(),
      beschreibung:    formData.beschreibung,
      adatum:          formData.adatum,
      edatum:          formData.edatum,
      einaktiv:        formData.einaktiv,
      // eingetragen: bei Neu = heute, bei Bearbeiten = bestehenden Wert beibehalten
      eingetragen:     editGruppe ? (toInputDate(editGruppe.eingetragen) || today()) : today(),
      // Felder die nicht mehr im Formular sind: bestehende Werte beibehalten
      bartAlt:         editGruppe?.bartAlt ?? 0,
      routendatenHtml: editGruppe?.routendatenHtml ?? "",
      routendatenTk2:  editGruppe?.routendatenTk2 ?? "",
      routendatenKmz:  editGruppe?.routendatenKmz ?? "",
    };

    try {
      const res = await fetch("/api/fotodatenbank/fotogruppen-liste", {
        method:  editGruppe ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError((data as { error?: string }).error ?? "Fehler beim Speichern");
        return;
      }
      setFormSuccess(editGruppe ? "Erfolgreich gespeichert." : "Neue Fotogruppe angelegt.");
      await laden();
      ladenFotozahlen();
      setTimeout(() => { modalSchliessen(); }, 900);
    } catch (err) {
      setFormError(String(err));
    } finally {
      setFormSaving(false);
    }
  }

  const anzahlInaktiv = gruppen.filter((g) => g.einaktiv === "nein").length;

  // ── Ladezustand ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-7 h-7 text-amber-400 animate-spin mr-3" />
        <span className="text-gray-300">Lade Fotogruppen…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-xl p-6">
        <div className="flex items-start gap-3 text-red-400 mb-4">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
        <button onClick={laden} className="inline-flex items-center gap-2 text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition-colors">
          <RefreshCw className="w-4 h-4" /> Nochmal versuchen
        </button>
      </div>
    );
  }

  // ── Hauptansicht ───────────────────────────────────────────────────
  return (
    <>
    <div className="space-y-4">

      {/* ── Zurück-Link ── */}
      <div>
        <Link
          href="/fotodatenbank"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Zurück zur Fotodatenbank
        </Link>
      </div>

      {/* ── Kopfzeile mit Filter-Leiste ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">

          {/* Titel + Zähler */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <List className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <h2 className="text-white font-semibold text-sm">Alle Fotogruppen</h2>
              <p className="text-gray-500 text-xs">
                {gefiltert.length} von {gruppen.length} Einträgen
                {anzahlInaktiv > 0 && <span className="ml-1 text-gray-600">({anzahlInaktiv} inaktiv)</span>}
              </p>
            </div>
          </div>

          {/* Suchfeld */}
          <input
            type="search"
            value={suchtext}
            onChange={(e) => setSuchtext(e.target.value)}
            placeholder="Suche nach Name, ID, Beschreibung…"
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500 w-56"
          />

          {/* Filter-Toggle */}
          <button
            type="button"
            onClick={() => setInaktivAusbl((v) => !v)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              inaktivAusbl
                ? "bg-amber-500/20 border border-amber-500/50 text-amber-400"
                : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
            title={inaktivAusbl ? "Inaktive ausgeblendet – klicken zum Anzeigen" : "Klicken um inaktive auszublenden"}
          >
            {inaktivAusbl ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <Filter className="w-3.5 h-3.5" />
            <span>{inaktivAusbl ? "Inaktive ausgeblendet" : "Inaktive anzeigen"}</span>
          </button>

          {/* Neu laden */}
          <button type="button" onClick={laden} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors" title="Neu laden">
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Neue Fotogruppe */}
          <button
            type="button"
            onClick={modalNeu}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Neue Gruppe
          </button>
        </div>
      </div>

      {/* ── Tabelle ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {sortiert.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <List className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Keine Einträge gefunden.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wide">
                  <SortTh col="idfgruppe"   label="ID"          current={sortCol} dir={sortDir} onSort={handleSort} className="w-20" />
                  <SortTh col="name"        label="Name"        current={sortCol} dir={sortDir} onSort={handleSort} />
                  <SortTh col="adatum"      label="Von"         current={sortCol} dir={sortDir} onSort={handleSort} className="w-28" />
                  <SortTh col="edatum"      label="Bis"         current={sortCol} dir={sortDir} onSort={handleSort} className="w-28" />
                  <th className="text-left px-4 py-3 font-medium w-28">Aktiv</th>
                  <SortTh col="eingetragen"  label="Eingetragen" current={sortCol} dir={sortDir} onSort={handleSort} className="w-28" />
                  <SortTh col="anzahl"       label="Fotos"       current={sortCol} dir={sortDir} onSort={handleSort} className="w-20" />
                  <SortTh col="gpxTracks"    label="GPX-Tracks"  current={sortCol} dir={sortDir} onSort={handleSort} className="w-24" />
                  <th className="text-left px-4 py-3 font-medium w-20" title="Reisekarten-Verknüpfungen">
                    <span className="inline-flex items-center gap-1 uppercase tracking-wide text-gray-400">
                      <Map className="w-3 h-3" />Karte
                    </span>
                  </th>
                  <th className="text-right px-4 py-3 font-medium w-44">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {sortiert.map((g) => {
                  const istInaktiv = g.einaktiv === "nein";
                  const aufgekl    = aufgeklappt.has(g.idfgruppe);
                  const hatRouten  = g.routendatenHtml || g.routendatenTk2 || g.routendatenKmz;

                  return (
                    <Fragment key={g.idfgruppe}>
                      <tr className={`transition-colors ${istInaktiv ? "bg-gray-900/40 opacity-60" : "hover:bg-gray-800/40"}`}>

                        {/* ID */}
                        <td className="px-4 py-3 font-mono text-gray-500 text-xs">#{g.idfgruppe}</td>

                        {/* Name */}
                        <td className="px-4 py-3">
                          <span className={`font-medium ${istInaktiv ? "text-gray-500" : "text-white"}`}>{g.name}</span>
                          {g.beschreibung && (
                            <p className="text-gray-600 text-xs mt-0.5 truncate max-w-xs">{g.beschreibung}</p>
                          )}
                        </td>

                        {/* Von */}
                        <td className="px-4 py-3 text-gray-400 tabular-nums">
                          <span className="flex items-center gap-1.5">
                            <CalendarRange className="w-3 h-3 text-gray-600 flex-shrink-0" />
                            {formatDate(g.adatum)}
                          </span>
                        </td>

                        {/* Bis */}
                        <td className="px-4 py-3 text-gray-400 tabular-nums">{formatDate(g.edatum)}</td>

                        {/* Aktiv-Toggle */}
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => toggleEinaktiv(g)}
                            disabled={savingIds.has(g.idfgruppe)}
                            title={istInaktiv ? "Inaktiv – klicken um zu aktivieren" : "Aktiv – klicken um zu deaktivieren"}
                            className="flex items-center gap-2 disabled:cursor-wait"
                          >
                            <span className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 transition-colors duration-200 ${
                              savingIds.has(g.idfgruppe) ? "border-gray-600 bg-gray-700"
                              : istInaktiv ? "border-red-800 bg-red-900/50"
                              : "border-green-700 bg-green-800/60"
                            }`}>
                              <span className={`inline-block h-4 w-4 transform rounded-full shadow transition-transform duration-200 ${
                                savingIds.has(g.idfgruppe) ? "translate-x-0 bg-gray-500"
                                : istInaktiv ? "translate-x-0 bg-red-500"
                                : "translate-x-4 bg-green-400"
                              }`} />
                            </span>
                            <span className={`text-xs ${
                              savingIds.has(g.idfgruppe) ? "text-gray-500"
                              : istInaktiv ? "text-red-400/80"
                              : "text-green-400"
                            }`}>
                              {savingIds.has(g.idfgruppe)
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : istInaktiv ? "inaktiv" : "aktiv"}
                            </span>
                          </button>
                        </td>

                        {/* Eingetragen */}
                        <td className="px-4 py-3 text-gray-500 text-xs tabular-nums">{formatDate(g.eingetragen)}</td>

                        {/* Foto-Anzahl */}
                        <td className="px-4 py-3">
                          {fotozahlenLaden && g.anzahlFotos === undefined ? (
                            <Loader2 className="w-3 h-3 text-gray-600 animate-spin" />
                          ) : (g.anzahlFotos ?? 0) > 0 ? (
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${istInaktiv ? "text-gray-400" : "text-blue-400"}`}
                              title={istInaktiv ? "Gespeicherter Wert (DB-Cache)" : "Live-Wert"}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${istInaktiv ? "bg-gray-500" : "bg-blue-400"}`} />
                              {g.anzahlFotos}
                            </span>
                          ) : (
                            <span className="text-gray-600 text-xs">–</span>
                          )}
                        </td>

                        {/* GPX-Tracks Anzahl */}
                        <td className="px-4 py-3">
                          {gpxZahlenLaden && g.anzahlGpxTracks === undefined ? (
                            <Loader2 className="w-3 h-3 text-gray-600 animate-spin" />
                          ) : (g.anzahlGpxTracks ?? 0) > 0 ? (
                            <span className="inline-flex items-center gap-1 text-green-400 text-xs font-semibold tabular-nums">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                              {g.anzahlGpxTracks}
                            </span>
                          ) : (
                            <span className="text-gray-600 text-xs">–</span>
                          )}
                        </td>

                        {/* Reise-Links Anzahl */}
                        <td className="px-4 py-3">
                          {reiseZahlenLaden && g.anzahlReiseLinks === undefined ? (
                            <Loader2 className="w-3 h-3 text-gray-600 animate-spin" />
                          ) : (g.anzahlReiseLinks ?? 0) > 0 ? (
                            <button
                              type="button"
                              onClick={() => setReiseModalGruppe(g)}
                              className="inline-flex items-center gap-1 text-purple-400 text-xs font-semibold tabular-nums hover:text-purple-300 transition-colors"
                              title="Reisekarten-Verknüpfungen anzeigen"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                              {g.anzahlReiseLinks}
                            </button>
                          ) : (
                            <span className="text-gray-600 text-xs">–</span>
                          )}
                        </td>

                        {/* Aktionen */}
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => modalBearbeiten(g)}
                              className="inline-flex items-center gap-1 text-gray-500 hover:text-amber-400 transition-colors text-xs px-2 py-1 rounded hover:bg-gray-800"
                              title="Bearbeiten"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Bearbeiten
                            </button>
                            {/* Reisekarte-Button */}
                            <button
                              type="button"
                              onClick={() => setReiseModalGruppe(g)}
                              className="inline-flex items-center gap-1 text-gray-500 hover:text-purple-400 transition-colors text-xs px-2 py-1 rounded hover:bg-gray-800"
                              title="Reisekarte verknüpfen"
                            >
                              <Map className="w-3.5 h-3.5" />
                              Karte
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleDetails(g.idfgruppe)}
                              className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-300 transition-colors text-xs px-2 py-1 rounded hover:bg-gray-800"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              {aufgekl ? "Zu" : "Details"}
                            </button>
                            <button
                              type="button"
                              onClick={() => loeschenDialog(g)}
                              disabled={pruefenIds.has(g.idfgruppe)}
                              className="inline-flex items-center gap-1 text-gray-500 hover:text-red-400 disabled:opacity-50 disabled:cursor-wait transition-colors text-xs px-2 py-1 rounded hover:bg-gray-800"
                              title="Löschen"
                            >
                              {pruefenIds.has(g.idfgruppe)
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Detail-Zeile */}
                      {aufgekl && (
                        <tr className="bg-gray-800/30">
                          <td colSpan={10} className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              {g.beschreibung && (
                                <div className="md:col-span-2">
                                  <div className="text-gray-500 text-xs mb-1 uppercase tracking-wide">Beschreibung</div>
                                  <p className="text-gray-300 leading-relaxed whitespace-pre-line">{g.beschreibung}</p>
                                </div>
                              )}
                              <div className="space-y-2">
                                <div className="text-gray-500 text-xs uppercase tracking-wide mb-1">Metadaten</div>
                                <DetailZeile label="bart_alt"    value={String(g.bartAlt)} />
                                <DetailZeile label="einaktiv"    value={g.einaktiv} highlight={g.einaktiv === "nein" ? "red" : "green"} />
                                <DetailZeile label="Von"         value={formatDate(g.adatum)} />
                                <DetailZeile label="Bis"         value={formatDate(g.edatum)} />
                                <DetailZeile label="Eingetragen" value={formatDate(g.eingetragen)} />
                              </div>
                              {hatRouten && (
                                <div className="space-y-2">
                                  <div className="text-gray-500 text-xs uppercase tracking-wide mb-1">Routendaten</div>
                                  {g.routendatenHtml && <RouteLink label="HTML" href={g.routendatenHtml} />}
                                  {g.routendatenTk2  && <RouteLink label="TK2"  href={g.routendatenTk2} />}
                                  {g.routendatenKmz  && <RouteLink label="KMZ"  href={g.routendatenKmz} />}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fußzeile */}
      <div className="text-center text-gray-600 text-xs py-1">
        Tabelle: fd_fotogruppen · {gruppen.length} Einträge gesamt
      </div>
    </div>

    {/* ═══ Modal: Neu anlegen / Bearbeiten ═══════════════════════════ */}
    {modalOffen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70" onClick={modalSchliessen} />

        {/* Dialog */}
        <div className="relative z-10 bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
            <h2 className="text-white font-semibold text-base">
              {editGruppe ? `Gruppe #${editGruppe.idfgruppe} bearbeiten` : "Neue Fotogruppe anlegen"}
            </h2>
            <button type="button" onClick={modalSchliessen} className="text-gray-500 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Formular (scrollbar) */}
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              {/* Meldungen */}
              {formError && (
                <div className="flex items-start gap-2 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}
              {formSuccess && (
                <div className="bg-green-900/20 border border-green-800 rounded-lg px-4 py-3 text-green-400 text-sm">
                  {formSuccess}
                </div>
              )}

              {/* Name */}
              <FormRow label="Name *">
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setField("name", e.target.value)}
                  required
                  className="input-field"
                  placeholder="Gruppenname"
                />
              </FormRow>

              {/* Beschreibung */}
              <FormRow label="Beschreibung">
                <textarea
                  value={formData.beschreibung}
                  onChange={(e) => setField("beschreibung", e.target.value)}
                  rows={3}
                  className="input-field resize-none"
                  placeholder="Kurzbeschreibung der Fotogruppe"
                />
              </FormRow>

              {/* Von / Bis */}
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Von *">
                  <input type="date" value={formData.adatum} onChange={(e) => setField("adatum", e.target.value)} required className="input-field" />
                </FormRow>
                <FormRow label="Bis *">
                  <input type="date" value={formData.edatum} onChange={(e) => setField("edatum", e.target.value)} required className="input-field" />
                </FormRow>
              </div>

              {/* Status (einaktiv) */}
              <FormRow label="Status">
                <button
                  type="button"
                  onClick={() => setField("einaktiv", formData.einaktiv === "ja" ? "nein" : "ja")}
                  className="flex items-center gap-3"
                >
                  <span className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 transition-colors duration-200 ${
                    formData.einaktiv === "ja" ? "border-green-700 bg-green-800/60" : "border-red-800 bg-red-900/50"
                  }`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full shadow transition-transform duration-200 ${
                      formData.einaktiv === "ja" ? "translate-x-5 bg-green-400" : "translate-x-0 bg-red-500"
                    }`} />
                  </span>
                  <span className={`text-sm font-medium ${formData.einaktiv === "ja" ? "text-green-400" : "text-red-400"}`}>
                    {formData.einaktiv === "ja" ? "aktiv" : "inaktiv"}
                  </span>
                </button>
              </FormRow>

              {/* Hinweis auf Reisekarte-Modal (nur beim Bearbeiten) */}
              {editGruppe && (
                <div className="border border-purple-800/40 bg-purple-900/10 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Map className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <span className="text-purple-300 text-sm">Reisekarten-Verknüpfungen</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      modalSchliessen();
                      setReiseModalGruppe(editGruppe);
                    }}
                    className="inline-flex items-center gap-1.5 bg-purple-700 hover:bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
                  >
                    <Map className="w-3.5 h-3.5" />
                    Verwalten
                  </button>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-end gap-3 flex-shrink-0">
              <button type="button" onClick={modalSchliessen} className="text-gray-400 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors">
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={formSaving}
                className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/40 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                {formSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editGruppe ? "Speichern" : "Anlegen"}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* ═══ Modal: Reisekarte-Zuordnung ═══════════════════════════════ */}
    {reiseModalGruppe && (
      <ReisekarteLinkModal
        gruppe={reiseModalGruppe}
        onClose={() => setReiseModalGruppe(null)}
      />
    )}

    {/* ═══ Bestätigungs-Dialog: Löschen ══════════════════════════════ */}
    {loeschenGruppe && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70" onClick={() => !loeschenLaeuft && setLoeschenGruppe(null)} />
        <div className="relative z-10 bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl p-6">

          {/* Icon + Titel */}
          <div className="flex items-start gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-900/40 border border-red-800 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-base">Fotogruppe löschen?</h3>
              <p className="text-gray-400 text-sm mt-1">
                Gruppe <span className="text-white font-medium">„{loeschenGruppe.name}"</span>{" "}
                (#{loeschenGruppe.idfgruppe}) wird unwiderruflich gelöscht.
              </p>
            </div>
          </div>

          {/* Fehlermeldung (z.B. verknüpfte Fotos) */}
          {loeschenFehler && (
            <div className="flex items-start gap-2 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{loeschenFehler}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setLoeschenGruppe(null)}
              disabled={loeschenLaeuft}
              className="text-gray-400 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Abbrechen
            </button>
            {!loeschenFehler && (
              <button
                type="button"
                onClick={handleLoeschen}
                disabled={loeschenLaeuft}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-600/40 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                {loeschenLaeuft
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Trash2 className="w-4 h-4" />}
                Löschen
              </button>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// ─── Hilfskomponenten ─────────────────────────────────────────────────────────

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-gray-400 text-xs font-medium">{label}</label>
      {children}
    </div>
  );
}

function DetailZeile({ label, value, highlight }: { label: string; value: string; highlight?: "red" | "green" }) {
  const color = highlight === "red" ? "text-red-400" : highlight === "green" ? "text-green-400" : "text-gray-300";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-500 w-24 flex-shrink-0">{label}</span>
      <span className={`font-mono ${color}`}>{value || "–"}</span>
    </div>
  );
}

function SortTh({ col, label, current, dir, onSort, className = "" }: {
  col: SortCol; label: string; current: SortCol; dir: SortDir;
  onSort: (col: SortCol) => void; className?: string;
}) {
  const active = current === col;
  return (
    <th className={`text-left px-4 py-3 font-medium ${className}`}>
      <button
        type="button"
        onClick={() => onSort(col)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide transition-colors ${active ? "text-amber-400" : "text-gray-400 hover:text-white"}`}
      >
        {label}
        {active
          ? dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
          : <ChevronsUpDown className="w-3 h-3 opacity-40" />}
      </button>
    </th>
  );
}

function RouteLink({ label, href }: { label: string; href: string }) {
  const isUrl = href.startsWith("http");
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-500 w-12 flex-shrink-0">{label}</span>
      {isUrl ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 flex items-center gap-1 truncate max-w-xs">
          <ExternalLink className="w-3 h-3 flex-shrink-0" />{href}
        </a>
      ) : (
        <span className="text-gray-400 font-mono truncate max-w-xs">{href}</span>
      )}
    </div>
  );
}
