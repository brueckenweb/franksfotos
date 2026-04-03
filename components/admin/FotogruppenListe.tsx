"use client";

/**
 * Fotogruppen-Liste mit CRUD-Formular
 * Tabelle aller fd_fotogruppen-Einträge, filterbar + sortierbar.
 * Modal zum Anlegen / Bearbeiten.
 */

import { useState, useEffect, Fragment } from "react";
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
} from "lucide-react";

// ─── Typen ────────────────────────────────────────────────────────────────────

type SortCol = "idfgruppe" | "name" | "adatum" | "edatum" | "eingetragen" | "anzahl";
type SortDir = "asc" | "desc";

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
}

interface FormData {
  name:        string;
  beschreibung: string;
  adatum:      string; // YYYY-MM-DD
  edatum:      string;
  einaktiv:    "ja" | "nein";
}

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
  const [fotozahlenLaden, setFotozahlenLaden] = useState(false);

  // ── Modal-State ───────────────────────────────────────────────────
  const [modalOffen,    setModalOffen]    = useState(false);
  const [editGruppe,    setEditGruppe]    = useState<Fotogruppe | null>(null); // null = Neu anlegen
  const [formData,      setFormData]      = useState<FormData>(EMPTY_FORM);
  const [formSaving,    setFormSaving]    = useState(false);
  const [formError,     setFormError]     = useState<string | null>(null);
  const [formSuccess,   setFormSuccess]   = useState<string | null>(null);

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

  useEffect(() => {
    laden().then(() => ladenFotozahlen());
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
                  <th className="text-right px-4 py-3 font-medium w-36">Aktionen</th>
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

                        {/* Foto-Anzahl:
                            Aktive Gruppen  → lazy geladen (anzahlFotos), mit Spinner
                            Inaktive Gruppen → DB-Cache (anzahl), sofort verfügbar */}
                        <td className="px-4 py-3">
                          {istInaktiv ? (
                            // ── Inaktiv: gespeicherter DB-Wert ──
                            g.anzahl > 0 ? (
                              <span className="inline-flex items-center gap-1 text-gray-400 text-xs font-semibold tabular-nums" title="Gespeicherter Wert (DB-Cache)">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-500 flex-shrink-0" />
                                {g.anzahl}
                              </span>
                            ) : (
                              <span className="text-gray-600 text-xs">–</span>
                            )
                          ) : fotozahlenLaden && g.anzahlFotos === undefined ? (
                            // ── Aktiv: noch am Laden ──
                            <Loader2 className="w-3 h-3 text-gray-600 animate-spin" />
                          ) : (g.anzahlFotos ?? 0) > 0 ? (
                            // ── Aktiv: lazy geladen ──
                            <span className="inline-flex items-center gap-1 text-blue-400 text-xs font-semibold tabular-nums">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                              {g.anzahlFotos}
                            </span>
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
                          <td colSpan={8} className="px-6 py-4">
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
      {/* ═══ Bestätigungs-Dialog: Löschen ══════════════════════════ */}
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
