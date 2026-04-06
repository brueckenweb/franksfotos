"use client";

/**
 * FotodatenbankBrowser
 * Zeigt alle Einträge aus fd_fotodatenbank mit:
 *  - Volltextsuche + Pagination
 *  - Thumbnails (via lokaler Server localhost:4567)
 *  - Bearbeiten-Modal (alle Felder + Fotogruppen-Zuordnung)
 *  - Dateien-Modal (alle Dateien zu einer B-Nummer)
 *  - Galerie-Übertragen-Dialog
 */

import { useState, useEffect, useCallback, useRef } from "react";
import AlbumTreeSelect from "@/app/admin/alben/AlbumTreeSelect";
import {
  Search, RefreshCw, Loader2, AlertCircle, ChevronLeft, ChevronRight,
  Pencil, Trash2, Image as ImageIcon, FolderOpen, Upload, X, Save,
  CheckCircle2, ChevronUp, ChevronDown, ChevronsUpDown, Wifi, WifiOff,
  Camera, Lock, Users, Tag,
} from "lucide-react";

// ─── Typen ────────────────────────────────────────────────────────────────────

interface FdEintrag {
  bnummer:          number;
  land:             string;
  ort:              string;
  titel:            string;
  bdatum:           string;
  aufnahmedatum:    string | null;
  aufnahmezeit:     string;
  bnegativnr:       string;
  bart:             string;
  pfad:             string;
  kamera:           string;
  blende:           string;
  belichtungsdauer: string;
  brennweite:       string;
  iso:              string;
  fotograf:         string;
  bas:              string;
  eingetragen:      string | null;
  gpsB:             string;
  gpsL:             string;
  gpsH:             string;
  fotogruppen:      Array<{ idfgruppe: number; name: string }>;
}

interface Fotogruppe  { idfgruppe: number; name: string; }
interface AlbumOption { id: number; name: string; slug: string; parentId: number | null; }
interface GroupOption { id: number; name: string; }
interface TagOption   { id: number; name: string; groupName?: string; }

interface DateiInfo {
  name: string; ext: string; sizeHuman: string; isJpg: boolean;
}

type SortCol = "bnummer" | "aufnahmedatum" | "land" | "ort" | "titel" | "fotograf" | "eingetragen";

const LOCAL_SERVER = "http://localhost:4567";

function isoToInput(raw: string | null | undefined): string {
  if (!raw) return "";
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function FotodatenbankBrowser() {
  // ── Daten ──
  const [rows,       setRows]       = useState<FdEintrag[]>([]);
  const [total,      setTotal]      = useState(0);
  const [seiten,     setSeiten]     = useState(1);
  const [loading,    setLoading]    = useState(false);
  const [fehler,     setFehler]     = useState<string | null>(null);

  // ── Such/Filter/Sort ──
  const [suchtext,   setSuchtext]   = useState("");
  const [suchtextTmp,setSuchtextTmp]= useState("");
  const [seite,      setSeite]      = useState(1);
  const [limit]                     = useState(50);
  const [sortCol,    setSortCol]    = useState<SortCol>("bnummer");
  const [sortDir,    setSortDir]    = useState<"asc" | "desc">("desc");

  // ── Lokaler Server ──
  const [localOk,    setLocalOk]    = useState<boolean | null>(null);

  // ── Modals ──
  const [editEntry,  setEditEntry]  = useState<FdEintrag | null>(null);
  const [editForm,   setEditForm]   = useState<Partial<FdEintrag>>({});
  const [editGruppen,setEditGruppen]= useState<number[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError,  setEditError]  = useState<string | null>(null);
  const [editSuccess,setEditSuccess]= useState<string | null>(null);

  const [dateienEntry,setDateienEntry]= useState<FdEintrag | null>(null);
  const [dateienList, setDateienList] = useState<DateiInfo[]>([]);
  const [dateienLoad, setDateienLoad] = useState(false);
  const [dateienError,setDateienError]= useState<string | null>(null);

  const [galerieEntry,   setGalerieEntry]    = useState<FdEintrag | null>(null);
  const [galerieAlbumId, setGalerieAlbumId]  = useState("");
  const [galerieBeschr,  setGalerieBeschr]   = useState("");
  const [galeriePrivat,  setGaleriePrivat]   = useState(false);
  const [galerieGruppen, setGalerieGruppen]  = useState<number[]>([]);
  const [galerieTags,    setGalerieTags]     = useState<number[]>([]);
  const [galerieLoading, setGalerieLoading]  = useState(false);
  const [galerieError,   setGalerieError]    = useState<string | null>(null);
  const [galerieSuccess, setGalerieSuccess]  = useState<string | null>(null);

  const [loeschenEntry,  setLoeschenEntry]   = useState<FdEintrag | null>(null);
  const [loeschenLaeuft, setLoeschenLaeuft]  = useState(false);
  const [loeschenFehler, setLoeschenFehler]  = useState<string | null>(null);

  // ── Lookup-Daten ──
  const [fotogruppen, setFotogruppen] = useState<Fotogruppe[]>([]);
  const [galAlben,    setGalAlben]    = useState<AlbumOption[]>([]);
  const [galGruppen,  setGalGruppen]  = useState<GroupOption[]>([]);
  const [allTags,     setAllTags]     = useState<TagOption[]>([]);

  const suchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Lokalen Server prüfen ─────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${LOCAL_SERVER}/status`).then((r) => setLocalOk(r.ok)).catch(() => setLocalOk(false));
  }, []);

  // ── Lookup-Daten laden ────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/fotodatenbank/fotogruppen").then((r) => r.json()).then((d) => setFotogruppen(Array.isArray(d) ? d : [])).catch(() => {});
    Promise.all([
      fetch("/api/albums").then((r) => r.json()).catch(() => ({ albums: [] })),
      fetch("/api/groups").then((r) => r.json()).catch(() => ({ groups: [] })),
      fetch("/api/tags").then((r) => r.json()).catch(() => []),
    ]).then(([a, g, t]) => {
      const alben = a.albums ?? [];
      setGalAlben(alben);
      setGalGruppen(g.groups ?? []);
      setAllTags(Array.isArray(t) ? t : []);
      if (alben.length > 0) setGalerieAlbumId(String([...alben].sort((x: AlbumOption, y: AlbumOption) => y.id - x.id)[0].id));
    });
  }, []);

  // ── Daten laden ───────────────────────────────────────────────────────────
  const laden = useCallback(async (opts?: { s?: string; pg?: number; sc?: SortCol; sd?: "asc" | "desc" }) => {
    setLoading(true);
    setFehler(null);
    const q   = opts?.s  ?? suchtext;
    const pg  = opts?.pg ?? seite;
    const sc  = opts?.sc ?? sortCol;
    const sd  = opts?.sd ?? sortDir;
    try {
      const params = new URLSearchParams({ q, seite: String(pg), limit: String(limit), sort: sc, dir: sd });
      const res  = await fetch(`/api/fotodatenbank/datenbank?${params}`);
      const data = await res.json();
      if (!res.ok) { setFehler((data as { error?: string }).error ?? "Fehler"); return; }
      setRows(data.rows);
      setTotal(data.total);
      setSeiten(data.seiten);
    } catch (e) {
      setFehler(String(e));
    } finally {
      setLoading(false);
    }
  }, [suchtext, seite, sortCol, sortDir, limit]);

  useEffect(() => { laden(); }, [laden]);

  // ── Suche mit Debounce ────────────────────────────────────────────────────
  function handleSuche(val: string) {
    setSuchtextTmp(val);
    if (suchDebounce.current) clearTimeout(suchDebounce.current);
    suchDebounce.current = setTimeout(() => {
      setSuchtext(val);
      setSeite(1);
      laden({ s: val, pg: 1 });
    }, 400);
  }

  function handleSort(col: SortCol) {
    const nd = sortCol === col ? (sortDir === "asc" ? "desc" : "asc") : "desc";
    setSortCol(col);
    setSortDir(nd);
    setSeite(1);
    laden({ sc: col, sd: nd, pg: 1 });
  }

  function handleSeite(p: number) {
    setSeite(p);
    laden({ pg: p });
  }

  // ── Bearbeiten-Modal öffnen ────────────────────────────────────────────────
  function openEdit(e: FdEintrag) {
    setEditEntry(e);
    setEditForm({ ...e });
    setEditGruppen(e.fotogruppen.map((g) => g.idfgruppe));
    setEditError(null);
    setEditSuccess(null);
  }

  function closeEdit() { setEditEntry(null); }

  function setEF<K extends keyof FdEintrag>(k: K, v: FdEintrag[K]) {
    setEditForm((p) => ({ ...p, [k]: v }));
  }

  async function handleEditSave() {
    if (!editEntry) return;
    setEditSaving(true);
    setEditError(null);
    setEditSuccess(null);
    try {
      // 1. Felder speichern
      const res = await fetch("/api/fotodatenbank/datenbank", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...editForm, bnummer: editEntry.bnummer }),
      });
      const data = await res.json();
      if (!res.ok) { setEditError((data as { error?: string }).error ?? "Fehler"); return; }

      // 2. Fotogruppen speichern
      const grRes = await fetch(`/api/fotodatenbank/datenbank/${editEntry.bnummer}/fotogruppen`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ idfgruppenIds: editGruppen }),
      });
      if (!grRes.ok) { const d = await grRes.json(); setEditError(d.error ?? "Fehler beim Speichern der Fotogruppen"); return; }

      setEditSuccess("Erfolgreich gespeichert.");
      await laden();
      setTimeout(() => closeEdit(), 900);
    } catch (e) {
      setEditError(String(e));
    } finally {
      setEditSaving(false);
    }
  }

  // ── Dateien-Modal ──────────────────────────────────────────────────────────
  async function openDateien(e: FdEintrag) {
    setDateienEntry(e);
    setDateienList([]);
    setDateienError(null);
    setDateienLoad(true);
    try {
      const res  = await fetch(`${LOCAL_SERVER}/files?bnummer=${e.bnummer}&pfad=${encodeURIComponent(e.pfad)}`);
      const data = await res.json();
      if (!res.ok) { setDateienError(data.error ?? "Fehler"); return; }
      setDateienList(data.files ?? []);
    } catch (err) {
      setDateienError(String(err));
    } finally {
      setDateienLoad(false);
    }
  }

  // ── Löschen ────────────────────────────────────────────────────────────────
  async function handleLoeschen() {
    if (!loeschenEntry) return;
    setLoeschenLaeuft(true);
    setLoeschenFehler(null);
    try {
      const res = await fetch("/api/fotodatenbank/datenbank", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ bnummer: loeschenEntry.bnummer }),
      });
      const data = await res.json();
      if (!res.ok) { setLoeschenFehler((data as { error?: string }).error ?? "Fehler"); return; }
      setLoeschenEntry(null);
      await laden();
    } catch (e) {
      setLoeschenFehler(String(e));
    } finally {
      setLoeschenLaeuft(false);
    }
  }

  // ── Galerie übertragen ─────────────────────────────────────────────────────
  async function handleGalerieUebertragen() {
    if (!galerieEntry) return;
    setGalerieLoading(true);
    setGalerieError(null);
    setGalerieSuccess(null);
    try {
      // 1. Lokalen Server: JPG vorbereiten
      const prepRes = await fetch(`${LOCAL_SERVER}/prepare-galerie`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ bnummer: galerieEntry.bnummer, pfad: galerieEntry.pfad }),
      });
      const prepData = await prepRes.json() as { galerieJpgBase64?: string; error?: string };
      if (!prepRes.ok || !prepData.galerieJpgBase64) {
        setGalerieError(prepData.error ?? "Lokaler Server: Fehler beim Erstellen des Galerie-JPGs");
        return;
      }

      // 2. Upload
      const upRes = await fetch("/api/fotodatenbank/galerie-uebertragen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          bnummer:          galerieEntry.bnummer,
          galerieJpgBase64: prepData.galerieJpgBase64,
          albumId:          galerieAlbumId ? Number(galerieAlbumId) : null,
          beschreibung:     galerieBeschr  || null,
          privat:           galeriePrivat,
          gruppenIds:       galerieGruppen,
          tagIds:           galerieTags,
        }),
      });
      const upData = await upRes.json() as { photoId?: number; error?: string };
      if (!upRes.ok) { setGalerieError(upData.error ?? "Upload fehlgeschlagen"); return; }
      setGalerieSuccess(`✓ Foto B${galerieEntry.bnummer} als Galerie-Foto #${upData.photoId} übertragen`);
      setTimeout(() => setGalerieEntry(null), 2000);
    } catch (e) {
      setGalerieError(String(e));
    } finally {
      setGalerieLoading(false);
    }
  }

  // ── Hilfsfunktionen ────────────────────────────────────────────────────────
  function thumbnailUrl(e: FdEintrag) {
    return `${LOCAL_SERVER}/thumbnail?bnummer=${e.bnummer}&pfad=${encodeURIComponent(e.pfad)}`;
  }

  function formatDatum(raw: string | null | undefined): string {
    if (!raw) return "–";
    const m = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : raw;
  }

  function SortTh({ col, label, className = "" }: { col: SortCol; label: string; className?: string }) {
    const active = sortCol === col;
    return (
      <th className={`text-left px-3 py-2.5 font-medium text-xs uppercase tracking-wide ${className}`}>
        <button type="button" onClick={() => handleSort(col)}
          className={`inline-flex items-center gap-1 transition-colors ${active ? "text-amber-400" : "text-gray-400 hover:text-white"}`}>
          {label}
          {active ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ChevronsUpDown className="w-3 h-3 opacity-40" />}
        </button>
      </th>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
    <div className="space-y-4">

      {/* ── Kopfzeile ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">

          {/* Titel */}
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-semibold text-sm flex items-center gap-2">
              <Search className="w-4 h-4 text-amber-400" />
              Fotodatenbank
              {total > 0 && <span className="text-gray-500 font-normal text-xs">{total.toLocaleString("de-DE")} Einträge</span>}
            </h2>
          </div>

          {/* Lokaler Server Status */}
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            localOk === null ? "bg-gray-800 text-gray-500" :
            localOk ? "bg-green-900/40 text-green-400 border border-green-800" :
            "bg-gray-800 text-gray-500 border border-gray-700"
          }`}>
            {localOk === null ? <Loader2 className="w-3 h-3 animate-spin" /> :
             localOk ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {localOk === null ? "Prüfe…" : localOk ? "Lokaler Server verbunden" : "Kein lokaler Server"}
          </div>

          {/* Suche */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
            <input
              type="search"
              value={suchtextTmp}
              onChange={(e) => handleSuche(e.target.value)}
              placeholder="Suche…"
              className="bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500 w-52"
            />
          </div>

          {/* Neu laden */}
          <button type="button" onClick={() => laden()} title="Neu laden"
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Fehler ── */}
      {fehler && (
        <div className="flex items-start gap-3 bg-red-900/20 border border-red-800 rounded-xl p-4 text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{fehler}</span>
        </div>
      )}

      {/* ── Tabelle ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 text-amber-400 animate-spin mr-3" />
            <span className="text-gray-400">Lade…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-gray-500 text-sm">
            <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
            {suchtext ? "Keine Einträge für diese Suche gefunden." : "Keine Einträge vorhanden."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="w-16 px-3 py-2.5 text-left text-xs text-gray-500 font-medium uppercase tracking-wide">Bild</th>
                  <SortTh col="bnummer"       label="B-Nr."     className="w-24" />
                  <SortTh col="aufnahmedatum" label="Datum"     className="w-28" />
                  <SortTh col="land"          label="Land"      className="w-28" />
                  <SortTh col="ort"           label="Ort" />
                  <SortTh col="titel"         label="Titel" />
                  <SortTh col="fotograf"      label="Fotograf"  className="w-32" />
                  <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-medium uppercase tracking-wide w-40">Fotogruppen</th>
                  <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-medium uppercase tracking-wide w-36">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {rows.map((e) => (
                  <tr key={e.bnummer} className="hover:bg-gray-800/30 transition-colors">

                    {/* Thumbnail */}
                    <td className="px-3 py-2">
                      {localOk ? (
                        <img
                          src={thumbnailUrl(e)}
                          alt={`B${e.bnummer}`}
                          className="w-12 h-10 object-cover rounded bg-gray-800"
                          onError={(ev) => { (ev.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="w-12 h-10 rounded bg-gray-800 flex items-center justify-center">
                          <Camera className="w-4 h-4 text-gray-600" />
                        </div>
                      )}
                    </td>

                    {/* B-Nr. */}
                    <td className="px-3 py-2">
                      <span className="font-mono text-amber-400 text-xs font-semibold">B{e.bnummer}</span>
                      {e.bas && e.bas !== "0" && (
                        <div className="text-gray-600 text-xs">BAS {e.bas}</div>
                      )}
                    </td>

                    {/* Datum */}
                    <td className="px-3 py-2 text-gray-400 text-xs tabular-nums">
                      {formatDatum(e.aufnahmedatum?.toString())}
                    </td>

                    {/* Land */}
                    <td className="px-3 py-2 text-gray-300 text-xs">{e.land || "–"}</td>

                    {/* Ort */}
                    <td className="px-3 py-2 text-gray-300 text-xs max-w-[150px]">
                      <span className="truncate block">{e.ort || "–"}</span>
                    </td>

                    {/* Titel */}
                    <td className="px-3 py-2 text-gray-200 text-xs max-w-[180px]">
                      <span className="truncate block">{e.titel || "–"}</span>
                    </td>

                    {/* Fotograf */}
                    <td className="px-3 py-2 text-gray-400 text-xs max-w-[120px]">
                      <span className="truncate block">{e.fotograf || "–"}</span>
                    </td>

                    {/* Fotogruppen */}
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {e.fotogruppen.length === 0 ? (
                          <span className="text-gray-600 text-xs">–</span>
                        ) : (
                          e.fotogruppen.map((g) => (
                            <span key={g.idfgruppe} className="inline-block bg-amber-900/30 text-amber-400 text-xs px-1.5 py-0.5 rounded border border-amber-800/50 truncate max-w-[120px]" title={g.name}>
                              {g.name}
                            </span>
                          ))
                        )}
                      </div>
                    </td>

                    {/* Aktionen */}
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-0.5">
                        <button type="button" onClick={() => openEdit(e)} title="Bearbeiten"
                          className="p-1.5 rounded text-gray-500 hover:text-amber-400 hover:bg-gray-800 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {localOk && (
                          <button type="button" onClick={() => openDateien(e)} title="Dateien anzeigen"
                            className="p-1.5 rounded text-gray-500 hover:text-blue-400 hover:bg-gray-800 transition-colors">
                            <FolderOpen className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {localOk && (
                          <button type="button" onClick={() => { setGalerieEntry(e); setGalerieError(null); setGalerieSuccess(null); }} title="Zur Galerie übertragen"
                            className="p-1.5 rounded text-gray-500 hover:text-green-400 hover:bg-gray-800 transition-colors">
                            <Upload className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button type="button" onClick={() => { setLoeschenEntry(e); setLoeschenFehler(null); }} title="Löschen"
                          className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* ── Pagination ── */}
      {seiten > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 text-xs">
            Seite {seite} von {seiten} · {total.toLocaleString("de-DE")} Einträge
          </span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => handleSeite(seite - 1)} disabled={seite <= 1}
              className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(7, seiten) }, (_, i) => {
              const p = seiten <= 7 ? i + 1 : seite <= 4 ? i + 1 : seite >= seiten - 3 ? seiten - 6 + i : seite - 3 + i;
              return (
                <button key={p} type="button" onClick={() => handleSeite(p)}
                  className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                    p === seite ? "bg-amber-500 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
                  }`}>
                  {p}
                </button>
              );
            })}
            <button type="button" onClick={() => handleSeite(seite + 1)} disabled={seite >= seiten}
              className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>

    {/* ══════════════════════════════════════════════════════════════════════
        Modal: Bearbeiten
    ══════════════════════════════════════════════════════════════════════ */}
    {editEntry && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/75" onClick={closeEdit} />
        <div className="relative z-10 bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
            <h2 className="text-white font-semibold">
              B{editEntry.bnummer} bearbeiten
              <span className="ml-2 text-gray-500 font-normal text-sm">{editEntry.pfad}/B{editEntry.bnummer}.jpg</span>
            </h2>
            <button type="button" onClick={closeEdit} className="text-gray-500 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {editError   && <div className="flex items-start gap-2 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{editError}</span></div>}
            {editSuccess && <div className="bg-green-900/20 border border-green-800 rounded-lg px-4 py-3 text-green-400 text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{editSuccess}</div>}

            {/* Thumbnail */}
            {localOk && (
              <div className="flex gap-4 items-start">
                <img src={thumbnailUrl(editEntry)} alt="" className="w-32 h-28 object-cover rounded-lg bg-gray-800 flex-shrink-0"
                  onError={(ev) => { (ev.target as HTMLImageElement).style.display = "none"; }} />
                <div className="text-xs text-gray-500 leading-relaxed pt-1">
                  <div className="text-gray-400 font-medium mb-1">B{editEntry.bnummer}</div>
                  {editEntry.kamera && <div>📷 {editEntry.kamera}</div>}
                  {editEntry.blende && <div>{editEntry.blende}</div>}
                  {editEntry.belichtungsdauer && <div>{editEntry.belichtungsdauer}</div>}
                  {editEntry.iso && <div>ISO {editEntry.iso}</div>}
                  {editEntry.brennweite && <div>{editEntry.brennweite}</div>}
                </div>
              </div>
            )}

            {/* Formularfelder */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FRow label="Land">
                <input type="text" value={String(editForm.land ?? "")} onChange={(e) => setEF("land", e.target.value)} className="input-field" />
              </FRow>
              <FRow label="Ort">
                <input type="text" value={String(editForm.ort ?? "")} onChange={(e) => setEF("ort", e.target.value)} className="input-field" />
              </FRow>
              <FRow label="Titel" className="md:col-span-2">
                <input type="text" value={String(editForm.titel ?? "")} onChange={(e) => setEF("titel", e.target.value)} className="input-field" />
              </FRow>
              <FRow label="Datum (TT.MM.JJJJ)">
                <input type="text" value={String(editForm.bdatum ?? "")} onChange={(e) => setEF("bdatum", e.target.value)} className="input-field" placeholder="TT.MM.JJJJ" />
              </FRow>
              <FRow label="Aufnahmedatum">
                <input type="date" value={isoToInput(editForm.aufnahmedatum?.toString())} onChange={(e) => setEF("aufnahmedatum", e.target.value)} className="input-field" />
              </FRow>
              <FRow label="Aufnahmezeit">
                <input type="time" step="1" value={String(editForm.aufnahmezeit ?? "")} onChange={(e) => setEF("aufnahmezeit", e.target.value + ":00")} className="input-field" />
              </FRow>
              <FRow label="Fotograf">
                <input type="text" value={String(editForm.fotograf ?? "")} onChange={(e) => setEF("fotograf", e.target.value)} className="input-field" />
              </FRow>
              <FRow label="Negativnr.">
                <input type="text" value={String(editForm.bnegativnr ?? "")} onChange={(e) => setEF("bnegativnr", e.target.value)} className="input-field" />
              </FRow>
              <FRow label="Bildart (bart)">
                <input type="text" maxLength={3} value={String(editForm.bart ?? "")} onChange={(e) => setEF("bart", e.target.value)} className="input-field" />
              </FRow>
              <FRow label="Pfad">
                <input type="text" value={String(editForm.pfad ?? "")} onChange={(e) => setEF("pfad", e.target.value)} className="input-field" />
              </FRow>
              <FRow label="BAS-Nummer">
                <input type="text" value={String(editForm.bas ?? "")} onChange={(e) => setEF("bas", e.target.value)} className="input-field" placeholder="0 = keine" />
              </FRow>
              <FRow label="Kamera">
                <input type="text" value={String(editForm.kamera ?? "")} onChange={(e) => setEF("kamera", e.target.value)} className="input-field" />
              </FRow>
              <FRow label="Blende">
                <input type="text" value={String(editForm.blende ?? "")} onChange={(e) => setEF("blende", e.target.value)} className="input-field" />
              </FRow>
              <FRow label="Belichtung">
                <input type="text" value={String(editForm.belichtungsdauer ?? "")} onChange={(e) => setEF("belichtungsdauer", e.target.value)} className="input-field" />
              </FRow>
              <FRow label="Brennweite">
                <input type="text" value={String(editForm.brennweite ?? "")} onChange={(e) => setEF("brennweite", e.target.value)} className="input-field" />
              </FRow>
              <FRow label="ISO">
                <input type="text" value={String(editForm.iso ?? "")} onChange={(e) => setEF("iso", e.target.value)} className="input-field" />
              </FRow>
              <FRow label="GPS Breite">
                <input type="text" value={String(editForm.gpsB ?? "")} onChange={(e) => setEF("gpsB", e.target.value)} className="input-field" />
              </FRow>
              <FRow label="GPS Länge">
                <input type="text" value={String(editForm.gpsL ?? "")} onChange={(e) => setEF("gpsL", e.target.value)} className="input-field" />
              </FRow>
            </div>

            {/* Fotogruppen */}
            <div>
              <label className="text-gray-400 text-xs font-medium mb-2 block">Fotogruppen</label>
              <div className="flex flex-wrap gap-2">
                {fotogruppen.map((g) => {
                  const aktiv = editGruppen.includes(g.idfgruppe);
                  return (
                    <button key={g.idfgruppe} type="button"
                      onClick={() => setEditGruppen((prev) => aktiv ? prev.filter((id) => id !== g.idfgruppe) : [...prev, g.idfgruppe])}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                        aktiv
                          ? "bg-amber-500/20 border-amber-500/60 text-amber-300"
                          : "bg-gray-800 border-gray-700 text-gray-400 hover:border-amber-500/40 hover:text-gray-200"
                      }`}>
                      {g.name}
                    </button>
                  );
                })}
              </div>
              {fotogruppen.length === 0 && <p className="text-gray-600 text-xs">Keine aktiven Fotogruppen gefunden.</p>}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-end gap-3 flex-shrink-0">
            <button type="button" onClick={closeEdit} className="text-gray-400 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors">Abbrechen</button>
            <button type="button" onClick={handleEditSave} disabled={editSaving}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/40 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors">
              {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Speichern
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ══════════════════════════════════════════════════════════════════════
        Modal: Dateien anzeigen
    ══════════════════════════════════════════════════════════════════════ */}
    {dateienEntry && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/75" onClick={() => setDateienEntry(null)} />
        <div className="relative z-10 bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">

          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-blue-400" />
              Dateien: B{dateienEntry.bnummer}
              <span className="text-gray-500 font-normal text-sm">({dateienEntry.pfad})</span>
            </h2>
            <button type="button" onClick={() => setDateienEntry(null)} className="text-gray-500 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            {/* Thumbnail groß */}
            <div className="mb-4 flex justify-center">
              <img src={thumbnailUrl(dateienEntry)} alt="" className="max-h-48 rounded-lg bg-gray-800 object-contain"
                onError={(ev) => { (ev.target as HTMLImageElement).style.display = "none"; }} />
            </div>

            {dateienLoad ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Lade Dateiliste…
              </div>
            ) : dateienError ? (
              <div className="flex items-start gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{dateienError}
              </div>
            ) : dateienList.length === 0 ? (
              <p className="text-gray-500 text-sm text-center">Keine Dateien gefunden.</p>
            ) : (
              <div className="space-y-2">
                {dateienList.map((f) => (
                  <div key={f.name} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-8 text-center text-xs font-mono font-bold uppercase rounded px-1 py-0.5 ${
                        f.isJpg ? "bg-green-900/40 text-green-400" :
                        ["cr3","cr2","hif","raf","nef","arw","dng"].includes(f.ext) ? "bg-purple-900/40 text-purple-400" :
                        "bg-gray-700 text-gray-400"
                      }`}>{f.ext.toUpperCase()}</span>
                      <span className="text-gray-200 text-sm font-mono">{f.name}</span>
                    </div>
                    <span className="text-gray-500 text-xs tabular-nums">{f.sizeHuman}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* ══════════════════════════════════════════════════════════════════════
        Modal: Galerie übertragen
    ══════════════════════════════════════════════════════════════════════ */}
    {galerieEntry && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/75" onClick={() => !galerieLoading && setGalerieEntry(null)} />
        <div className="relative z-10 bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Upload className="w-4 h-4 text-green-400" />
              B{galerieEntry.bnummer} zur Fotogalerie übertragen
            </h2>
            <button type="button" onClick={() => setGalerieEntry(null)} disabled={galerieLoading} className="text-gray-500 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {galerieError   && <div className="flex items-start gap-2 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{galerieError}</span></div>}
            {galerieSuccess && <div className="bg-green-900/20 border border-green-800 rounded-lg px-4 py-3 text-green-400 text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{galerieSuccess}</div>}

            {/* Vorschau + Infos */}
            <div className="flex gap-4 items-start">
              <img src={thumbnailUrl(galerieEntry)} alt="" className="w-28 h-24 object-cover rounded-lg bg-gray-800 flex-shrink-0"
                onError={(ev) => { (ev.target as HTMLImageElement).style.display = "none"; }} />
              <div className="text-xs text-gray-400 leading-relaxed">
                <div className="text-white font-medium text-sm mb-1">B{galerieEntry.bnummer} – {galerieEntry.titel || "Kein Titel"}</div>
                <div>{galerieEntry.land} {galerieEntry.ort}</div>
                <div>{formatDatum(galerieEntry.aufnahmedatum?.toString())}</div>
                {galerieEntry.fotograf && <div>Fotograf: {galerieEntry.fotograf}</div>}
              </div>
            </div>

            {/* Album */}
            <FRow label="Album">
              <AlbumTreeSelect
                albums={galAlben}
                value={galerieAlbumId}
                onChange={(val) => setGalerieAlbumId(val)}
              />
            </FRow>

            {/* Beschreibung */}
            <FRow label="Beschreibung">
              <textarea value={galerieBeschr} onChange={(e) => setGalerieBeschr(e.target.value)}
                rows={2} className="input-field resize-none" placeholder="Optional" />
            </FRow>

            {/* Privat */}
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setGaleriePrivat((p) => !p)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 transition-colors ${galeriePrivat ? "border-red-700 bg-red-800/60" : "border-gray-600 bg-gray-700"}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full shadow transition-transform ${galeriePrivat ? "translate-x-5 bg-red-400" : "translate-x-0 bg-gray-400"}`} />
              </button>
              <div className="flex items-center gap-1.5 text-sm">
                <Lock className="w-3.5 h-3.5 text-gray-500" />
                <span className={galeriePrivat ? "text-red-300" : "text-gray-400"}>
                  {galeriePrivat ? "Privat" : "Öffentlich"}
                </span>
              </div>
            </div>

            {/* Gruppen */}
            {galGruppen.length > 0 && (
              <FRow label={<span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />Sichtbare Gruppen</span>}>
                <div className="flex flex-wrap gap-2">
                  {galGruppen.map((g) => {
                    const aktiv = galerieGruppen.includes(g.id);
                    return (
                      <button key={g.id} type="button"
                        onClick={() => setGalerieGruppen((p) => aktiv ? p.filter((id) => id !== g.id) : [...p, g.id])}
                        className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                          aktiv ? "bg-blue-900/30 border-blue-700 text-blue-300" : "bg-gray-800 border-gray-700 text-gray-400 hover:border-blue-700/50"
                        }`}>
                        {g.name}
                      </button>
                    );
                  })}
                </div>
              </FRow>
            )}

            {/* Tags */}
            {allTags.length > 0 && (
              <FRow label={<span className="flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" />Tags</span>}>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {allTags.map((t) => {
                    const aktiv = galerieTags.includes(t.id);
                    return (
                      <button key={t.id} type="button"
                        onClick={() => setGalerieTags((p) => aktiv ? p.filter((id) => id !== t.id) : [...p, t.id])}
                        className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                          aktiv ? "bg-purple-900/30 border-purple-700 text-purple-300" : "bg-gray-800 border-gray-700 text-gray-400 hover:border-purple-700/50"
                        }`}>
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </FRow>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-end gap-3 flex-shrink-0">
            <button type="button" onClick={() => setGalerieEntry(null)} disabled={galerieLoading} className="text-gray-400 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors">Abbrechen</button>
            <button type="button" onClick={handleGalerieUebertragen} disabled={galerieLoading}
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-600/40 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors">
              {galerieLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Zur Galerie übertragen
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ══════════════════════════════════════════════════════════════════════
        Modal: Löschen bestätigen
    ══════════════════════════════════════════════════════════════════════ */}
    {loeschenEntry && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/75" onClick={() => !loeschenLaeuft && setLoeschenEntry(null)} />
        <div className="relative z-10 bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-900/40 border border-red-800 flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Eintrag löschen?</h3>
              <p className="text-gray-400 text-sm mt-1">
                <span className="text-white font-medium">B{loeschenEntry.bnummer}</span>
                {loeschenEntry.titel && ` – ${loeschenEntry.titel}`} wird unwiderruflich aus der Fotodatenbank gelöscht.
                Die Datei auf F:/ bleibt erhalten.
              </p>
            </div>
          </div>
          {loeschenFehler && (
            <div className="flex items-start gap-2 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{loeschenFehler}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setLoeschenEntry(null)} disabled={loeschenLaeuft}
              className="text-gray-400 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors">Abbrechen</button>
            <button type="button" onClick={handleLoeschen} disabled={loeschenLaeuft}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-600/40 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors">
              {loeschenLaeuft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Löschen
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// ─── Hilfskomponenten ──────────────────────────────────────────────────────────

function FRow({ label, children, className = "" }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-gray-400 text-xs font-medium">{label}</label>
      {children}
    </div>
  );
}
