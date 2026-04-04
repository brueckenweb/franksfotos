"use client";

/**
 * Fotodatenbank-Eingabe-Formular
 * Liest Bilder client-seitig aus dem lokalen zuverarbeiten-Ordner
 * (File System Access API), zeigt EXIF-Daten + Karte, trägt in DB ein.
 * Dateien werden per multipart-Upload an den Server gesendet.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import AlbumTreeSelect from "@/app/admin/alben/AlbumTreeSelect";
import {
  RefreshCw,
  RotateCcw,
  Save,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Camera,
  Video,
  List,
  Lock,
  Users,
  Tag,
  X,
  ChevronDown,
  FolderOpen,
  Trash2,
} from "lucide-react";

const FotodatenbankMap = dynamic(
  () => import("./FotodatenbankMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[600px] bg-gray-800 rounded-lg animate-pulse flex items-center justify-center">
        <MapPin className="w-8 h-8 text-gray-600" />
      </div>
    ),
  }
);

// ─── Typen ────────────────────────────────────────────────────────────────────

interface ExifData {
  aufnahmedatum: string;
  aufnahmezeit:  string;
  blende:        string;
  belichtung:    string;
  brennweite:    string;
  iso:           string;
  kamera:        string;
  gpsBreite:     number;
  gpsLaenge:     number;
  gpsHoehe:      number;
  gpsRichtung:   number;
  bdatum:        string;
}

interface ScanData {
  bnummer:         number;
  baseName:        string;
  bildTyp:         "foto" | "video";
  files:           string[];
  fileMap:         Record<string, string>;
  exif:            ExifData;
  letzterEintrag:  { land: string; ort: string; fotograf: string; titel: string | null } | null;
  letzteIdfgruppe: number | null;
  geoLand:         string;
  geoOrt:          string;
}

interface Fotogruppe  { idfgruppe: number; name: string; }
interface AlbumOption { id: number; name: string; slug: string; parentId: number | null; }
interface GroupOption { id: number; name: string; description: string | null; }
interface TagOption   { id: number; name: string; slug: string; groupName?: string; groupColor?: string; }

interface FormState {
  land:            string;
  ort:             string;
  titel:           string;
  bdatum:          string;
  bnegativnr:      string;
  bart:            string;
  pfad:            string;
  fotograf:        string;
  idfgruppe:       string;
  bas:             string;
  bastitel:        string;
  basreihenfolge:  string;
  basfgruppe:      string;
  gpsbreite:       number;
  gpslaenge:       number;
  gpshoehe:        number;
}

// ─── EXIF-Hilfsfunktionen (früher im Server-Route, jetzt client-seitig) ───────

function formatBdatum(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${d}.${m}.${date.getFullYear()}`;
}

function formatIsoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function normalizeBaseName(filename: string): string {
  const extIdx = filename.lastIndexOf(".");
  const base   = extIdx >= 0 ? filename.slice(0, extIdx) : filename;
  for (const p of ["IMG_", "MVI_", "DSC"]) {
    if (base.startsWith(p)) return base.slice(p.length);
  }
  return base;
}

function calcNewpath(bnummer: number): string {
  return Math.floor(bnummer / 10000) + "bilder";
}

const EMPTY_EXIF: ExifData = {
  aufnahmedatum: "", aufnahmezeit: "",
  blende: "", belichtung: "", brennweite: "", iso: "", kamera: "",
  gpsBreite: 0, gpsLaenge: 0, gpsHoehe: 0, gpsRichtung: -1, bdatum: "",
};

// URL des lokalen Prozessors (läuft auf dem PC des Benutzers)
const LOCAL_SERVER = "http://localhost:4567";

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function FotodatenbankEingabe() {
  // ── Lokaler Server State ──
  const [localServerStatus, setLocalServerStatus] = useState<"checking" | "ok" | "error">("checking");
  const [anzahlZuVerarbeiten, setAnzahlZuVerarbeiten] = useState(0);
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null);

  // ── UI State ──
  const [scanData,    setScanData]    = useState<ScanData | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [leer,        setLeer]        = useState(false);
  const [scanError,   setScanError]   = useState<string | null>(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg,  setSuccessMsg]  = useState<string | null>(null);
  const [fotogruppen, setFotogruppen] = useState<Fotogruppe[]>([]);
  const [stats, setStats] = useState<{
    anzahlFotos: number; anzahlBas: number; anzahlZuVerarbeiten: number;
  } | null>(null);

  const [deleting,    setDeleting]    = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [basUebernehmen, setBasUebernehmen] = useState(false);
  const basUebernehmenRef = useRef(false);

  // ── Fotogalerie State ──
  const [galAlben,            setGalAlben]            = useState<AlbumOption[]>([]);
  const [galGruppen,          setGalGruppen]          = useState<GroupOption[]>([]);
  const [allTags,             setAllTags]             = useState<TagOption[]>([]);
  const [galerieUebernehmen,  setGalerieUebernehmen]  = useState(false);
  const [galerieAlbumId,      setGalerieAlbumId]      = useState("");
  const [galerieBeschreibung, setGalerieBeschreibung] = useState("");
  const [galeriePrivat,       setGaleriePrivat]       = useState(false);
  const [galerieGruppenIds,   setGalerieGruppenIds]   = useState<number[]>([]);
  const [galerieTags,         setGalerieTags]         = useState<TagOption[]>([]);
  const [expandedTagGroups,   setExpandedTagGroups]   = useState<Set<string>>(new Set());

  const [form, setForm] = useState<FormState>({
    land: "", ort: "", titel: "", bdatum: "",
    bnegativnr: "digital", bart: "", pfad: "", fotograf: "",
    idfgruppe: "", bas: "", bastitel: "",
    basreihenfolge: "5", basfgruppe: "Sonstige",
    gpsbreite: 0, gpslaenge: 0, gpshoehe: 0,
  });

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── Nächstes Bild via lokalen Server scannen ──────────────────────────────
  const scanNaechstesBild = useCallback(async () => {
    setLoading(true);
    setScanError(null);
    setSubmitError(null);
    setSuccessMsg(null);
    setLeer(false);
    setScanData(null);
    setPreviewUrl(null);

    try {
      // 1. Lokaler Server: Ordner scannen + EXIF
      const localRes = await fetch(`${LOCAL_SERVER}/scan`);
      if (!localRes.ok) {
        const err = await localRes.json().catch(() => ({ error: "Scan fehlgeschlagen" }));
        setScanError((err as { error?: string }).error ?? "Scan fehlgeschlagen");
        return;
      }
      const localData = await localRes.json() as {
        leer?:               boolean;
        baseName:            string;
        bildTyp:             "foto" | "video";
        files:               string[];
        exif:                ExifData;
        previewBase64:       string | null;
        videoFile:           string | null;
        anzahlZuVerarbeiten: number;
      };

      if (localData.leer) {
        setLeer(true);
        setAnzahlZuVerarbeiten(0);
        return;
      }

      setAnzahlZuVerarbeiten(localData.anzahlZuVerarbeiten);
      if (localData.previewBase64) setPreviewUrl(localData.previewBase64);

      // 2. Remote-Server: bnummer + Geocoding
      const params = new URLSearchParams();
      if (localData.exif.gpsBreite !== 0) params.set("lat", String(localData.exif.gpsBreite));
      if (localData.exif.gpsLaenge !== 0) params.set("lon", String(localData.exif.gpsLaenge));

      const serverRes = await fetch(`/api/fotodatenbank/scan?${params}`);
      if (!serverRes.ok) {
        const errData = await serverRes.json().catch(() => ({}));
        setScanError((errData as { error?: string }).error ?? "Fehler beim Laden der DB-Daten");
        return;
      }
      const serverData = await serverRes.json() as {
        bnummer:         number;
        letzterEintrag:  { land: string; ort: string; fotograf: string; titel: string | null } | null;
        letzteIdfgruppe: number | null;
        geoLand:         string;
        geoOrt:          string;
      };

      // 3. ScanData zusammenstellen
      const fileMapDisplay: Record<string, string> = {};
      for (const f of localData.files) {
        const extIdx = f.lastIndexOf(".");
        const ext    = extIdx >= 0 ? f.slice(extIdx + 1).toLowerCase() : "";
        fileMapDisplay[ext] = f;
      }

      setScanData({
        bnummer:         serverData.bnummer,
        baseName:        localData.baseName,
        bildTyp:         localData.bildTyp,
        files:           localData.files,
        fileMap:         fileMapDisplay,
        exif:            localData.exif,
        letzterEintrag:  serverData.letzterEintrag,
        letzteIdfgruppe: serverData.letzteIdfgruppe,
        geoLand:         serverData.geoLand,
        geoOrt:          serverData.geoOrt,
      });

      setForm((prev) => ({
        ...prev,
        titel:          serverData.letzterEintrag?.titel ?? "",
        bas:            basUebernehmenRef.current ? prev.bas : "",
        bastitel:       "",
        basreihenfolge: "5",
        basfgruppe:     "Sonstige",
        bdatum:         localData.exif.bdatum || prev.bdatum,
        bnegativnr:     localData.bildTyp === "video" ? "Video" : "digital",
        pfad:           calcNewpath(serverData.bnummer),
        gpsbreite:      localData.exif.gpsBreite,
        gpslaenge:      localData.exif.gpsLaenge,
        gpshoehe:       localData.exif.gpsHoehe,
        land:     serverData.geoLand || serverData.letzterEintrag?.land  || prev.land,
        ort:      serverData.geoOrt  || serverData.letzterEintrag?.ort   || prev.ort,
        fotograf: serverData.letzterEintrag?.fotograf ?? prev.fotograf,
        idfgruppe: String(serverData.letzteIdfgruppe ?? prev.idfgruppe ?? ""),
      }));
    } catch (err) {
      setScanError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Lokalen Server beim Start prüfen ─────────────────────────────────────
  async function checkLocalServer() {
    setLocalServerStatus("checking");
    try {
      const res = await fetch(`${LOCAL_SERVER}/status`);
      setLocalServerStatus(res.ok ? "ok" : "error");
    } catch {
      setLocalServerStatus("error");
    }
  }

  // ── Beim Start: Server prüfen; wenn ok: scannen ──────────────────────────
  useEffect(() => {
    checkLocalServer();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (localServerStatus === "ok") scanNaechstesBild();
  }, [localServerStatus, scanNaechstesBild]);

  // ── Fotogruppen + Alben + Tags beim Start laden ───────────────────────────
  useEffect(() => {
    fetch("/api/fotodatenbank/fotogruppen")
      .then((r) => r.json())
      .catch(() => [])
      .then((gruppen) =>
        setFotogruppen(Array.isArray(gruppen) ? (gruppen as Fotogruppe[]) : [])
      );

    Promise.all([
      fetch("/api/albums").then((r) => r.json()).catch(() => ({ albums: [] })),
      fetch("/api/groups").then((r) => r.json()).catch(() => ({ groups: [] })),
      fetch("/api/tags").then((r) => r.json()).catch(() => []),
    ]).then(([albumsData, groupsData, tagsData]) => {
      const alben: AlbumOption[] = albumsData.albums ?? [];
      setGalAlben(alben);
      setGalGruppen(groupsData.groups ?? []);
      setAllTags(Array.isArray(tagsData) ? (tagsData as TagOption[]) : []);
      if (alben.length > 0) {
        const newest = [...alben].sort((a, b) => b.id - a.id)[0];
        setGalerieAlbumId(String(newest.id));
      }
    });
  }, []);

  // ── Statistiken laden wenn idfgruppe oder anzahlZuVerarbeiten sich ändert ──
  useEffect(() => {
    const params = new URLSearchParams();
    if (form.idfgruppe) params.set("idfgruppe", form.idfgruppe);
    params.set("anzahlZuVerarbeiten", String(anzahlZuVerarbeiten));
    fetch(`/api/fotodatenbank/stats?${params}`)
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => setStats(null));
  }, [form.idfgruppe, anzahlZuVerarbeiten]);

  // ── Formular abschicken ───────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!scanData) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const fd = new FormData();

      // Metadaten
      fd.append("bnummer",        String(scanData.bnummer));
      fd.append("land",           form.land);
      fd.append("ort",            form.ort);
      fd.append("titel",          form.titel);
      fd.append("bdatum",         form.bdatum);
      fd.append("aufnahmedatum",  scanData.exif.aufnahmedatum);
      fd.append("aufnahmezeit",   scanData.exif.aufnahmezeit);
      fd.append("bnegativnr",     form.bnegativnr);
      fd.append("bart",           form.bart);
      fd.append("pfad",           form.pfad);
      fd.append("kamera",         scanData.exif.kamera);
      fd.append("blende",         scanData.exif.blende);
      fd.append("belichtung",     scanData.exif.belichtung);
      fd.append("brennweite",     scanData.exif.brennweite);
      fd.append("iso",            scanData.exif.iso);
      fd.append("fotograf",       form.fotograf);
      fd.append("bas",            form.bas);
      fd.append("basfgruppe",     form.basfgruppe);
      fd.append("idfgruppe",      form.idfgruppe);
      fd.append("gpsbreite",      String(form.gpsbreite));
      fd.append("gpslaenge",      String(form.gpslaenge));
      fd.append("gpshoehe",       String(form.gpshoehe));
      fd.append("bastitel",       form.bastitel);
      fd.append("basreihenfolge", form.basreihenfolge);
      fd.append("galerieUebernehmen",  String(galerieUebernehmen));
      fd.append("galerieAlbumId",      galerieAlbumId);
      fd.append("galerieBeschreibung", galerieBeschreibung);
      fd.append("galeriePrivat",       String(galeriePrivat));
      fd.append("galerieGruppenIds",   JSON.stringify(galerieGruppenIds));
      fd.append("galerieTagIds",       JSON.stringify(galerieTags.map((t) => t.id)));

      // Schritt 1: Lokaler Server verarbeitet Dateien + erstellt kleine JPGs
      const generateBas     = !!(form.bas && form.bas !== "0");
      const generateGalerie = galerieUebernehmen;

      const processRes = await fetch(`${LOCAL_SERVER}/process`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          bnummer:         scanData.bnummer,
          pfad:            form.pfad,
          baseName:        scanData.baseName,
          generateBas,
          generateGalerie,
        }),
      });

      if (!processRes.ok) {
        const err = await processRes.json().catch(() => ({ error: "Lokale Verarbeitung fehlgeschlagen" }));
        setSubmitError((err as { error?: string }).error ?? "Lokale Verarbeitung fehlgeschlagen");
        return;
      }

      const processData = await processRes.json() as {
        moved:            string[];
        errors:           string[];
        basJpgBase64:     string | null;
        galerieJpgBase64: string | null;
      };

      if (processData.errors.length > 0) {
        console.warn("[eintragen] Lokale Fehler:", processData.errors);
      }

      // Kleine JPGs an FormData hängen
      if (processData.basJpgBase64)     fd.append("basJpgBase64",     processData.basJpgBase64);
      if (processData.galerieJpgBase64) fd.append("galerieJpgBase64", processData.galerieJpgBase64);

      // Schritt 2: Remote-Server – DB-Eintrag + BAS/Galerie-Upload
      const res = await fetch("/api/fotodatenbank/eintragen", {
        method: "POST",
        body:   fd,
      });

      const rawText = await res.text();
      let result: Record<string, unknown> = {};
      try {
        result = JSON.parse(rawText);
      } catch {
        setSubmitError(`HTTP ${res.status} – ${res.statusText || "Unbekannter Fehler"}`);
        return;
      }
      if (!res.ok) {
        const errMsg  = String(result.error  ?? "Fehler beim Eintragen");
        const details = result.details ? ` – ${result.details}` : "";
        setSubmitError(`${errMsg}${details}`);
        return;
      }

      const galerieInfo = result.galeriePhotoId
        ? ` · 🖼 Galerie #${result.galeriePhotoId}`
        : result.galerieError
        ? ` · ⚠ Galerie: ${result.galerieError}`
        : "";
      setSuccessMsg(
        `✓ Foto B${result.bnummer} eingetragen${galerieInfo} → ${result.pfad}/B${result.bnummer}.jpg`
      );
      setTimeout(() => scanNaechstesBild(), 1800);
    } catch (err) {
      setSubmitError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Foto in "gelöscht"-Ordner verschieben ────────────────────────────────
  async function handleFotoLoeschen() {
    if (!scanData) return;
    if (!window.confirm(`Foto "${scanData.baseName}" wirklich in den Ordner "gelöscht" verschieben?`)) return;

    setDeleting(true);
    setDeleteError(null);
    setSubmitError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`${LOCAL_SERVER}/delete`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ baseName: scanData.baseName }),
      });

      const data = await res.json() as {
        moved?:          string[];
        errors?:         string[];
        geloeschtOrdner?: string;
        error?:          string;
      };

      if (!res.ok) {
        setDeleteError(data.error ?? "Fehler beim Verschieben");
        return;
      }

      if (data.errors && data.errors.length > 0) {
        setDeleteError(`Teilweise Fehler: ${data.errors.join(", ")}`);
        return;
      }

      setSuccessMsg(
        `🗑 ${data.moved?.length ?? 0} Datei(en) nach "gelöscht" verschoben → ${data.geloeschtOrdner ?? ""}`
      );
      setTimeout(() => scanNaechstesBild(), 1800);
    } catch (err) {
      setDeleteError(String(err));
    } finally {
      setDeleting(false);
    }
  }

  // ── Hilfsberechnungen für die Vorschau ────────────────────────────────────
  const isVideo  = scanData?.bildTyp === "video";
  const mp4File  = scanData?.fileMap["mp4"] ?? scanData?.fileMap["mov"] ?? null;
  const hasGps   = form.gpsbreite !== 0 || form.gpslaenge !== 0;

  // ─────────────────────────────────────────────────────────────────────────
  // UI: Lokalen Server prüfen
  if (localServerStatus === "checking") {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin mr-3" />
        <span className="text-gray-300">Verbinde mit lokalem Prozessor…</span>
      </div>
    );
  }

  if (localServerStatus === "error") {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center max-w-lg mx-auto">
        <div className="w-14 h-14 rounded-full bg-red-900/30 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">
          Lokaler Prozessor nicht erreichbar
        </h2>
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          Bitte starte den lokalen Fotodatenbank-Prozessor auf deinem PC:
        </p>
        <div className="bg-gray-800 rounded-lg p-4 text-left text-xs text-amber-300 font-mono mb-4">
          <div className="text-gray-500 mb-1"># Desktop-Verknüpfung doppelklicken:</div>
          <div>start-fotodatenbank.vbs</div>
          <div className="text-gray-500 mt-2 mb-1"># Oder im Terminal:</div>
          <div>node scripts/local-fotodatenbank.mjs</div>
        </div>
        <p className="text-gray-500 text-xs mb-6">
          Der Server läuft dann auf{" "}
          <code className="text-amber-400">http://localhost:4567</code>
        </p>
        <button
          onClick={checkLocalServer}
          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
          Erneut verbinden
        </button>
      </div>
    );
  }

  // UI: Lade-Zustand
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin mr-3" />
        <span className="text-gray-300">Scanne Eingangsordner…</span>
      </div>
    );
  }

  // UI: Leerer Ordner
  if (leer) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
        <ImageIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">
          Keine Dateien vorhanden
        </h2>
        <p className="text-gray-400 mb-6 text-sm leading-relaxed">
          Der gewählte Ordner{" "}
          <code className="text-amber-400 bg-gray-800 px-1.5 py-0.5 rounded text-xs">
            zuverarbeiten
          </code>{" "}
          ist leer.
          <br />
          Bitte Fotos in den Ordner kopieren.
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={scanNaechstesBild}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Erneut scannen
          </button>
          <button
            onClick={checkLocalServer}
            className="inline-flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Server neu prüfen
          </button>
        </div>
      </div>
    );
  }

  // UI: Scan-Fehler
  if (scanError && !scanData) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-xl p-6">
        <div className="flex items-start gap-3 text-red-400 mb-4">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{scanError}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={scanNaechstesBild}
            className="inline-flex items-center gap-2 text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Nochmal versuchen
          </button>
          <button
            onClick={checkLocalServer}
            className="inline-flex items-center gap-2 text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Server neu prüfen
          </button>
        </div>
      </div>
    );
  }

  // ── Hauptformular ──────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Meldungen */}
      {successMsg && (
        <div className="flex items-center gap-3 bg-green-900/20 border border-green-800 rounded-lg px-4 py-3 text-green-400 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {submitError && (
        <div className="flex items-center gap-3 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{submitError}</span>
        </div>
      )}
      {deleteError && (
        <div className="flex items-center gap-3 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>Löschen: {deleteError}</span>
        </div>
      )}

      {/* 3 Spalten: Foto | BAS | GPS */}
      <div className="grid grid-cols-1 xl:grid-cols-[600px_0.5fr_1fr] gap-5">

        {/* ── Spalte 1: Vorschau + Felder ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">

          {/* Vorschau */}
          {isVideo ? (
            <div className="flex items-center gap-3 bg-gray-800 rounded-lg p-4">
              <Video className="w-8 h-8 text-blue-400 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-white font-medium text-sm">Video-Datei</div>
                <div className="text-gray-400 text-xs truncate">{mp4File}</div>
                {previewUrl && (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 text-xs hover:text-amber-300"
                  >
                    Video öffnen ↗
                  </a>
                )}
              </div>
            </div>
          ) : previewUrl ? (
            <div>
              <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Vorschau"
                  className="w-full max-h-[450px] object-contain rounded-lg bg-gray-800"
                />
              </a>
              <div className="text-gray-500 text-xs mt-1 text-center">
                {scanData?.baseName}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 bg-gray-800 rounded-lg">
              <Camera className="w-10 h-10 text-gray-600" />
            </div>
          )}

          {/* EXIF-Info */}
          {scanData &&
            (scanData.exif.kamera || scanData.exif.blende ||
              scanData.exif.iso || scanData.exif.aufnahmedatum) && (
              <div className="bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
                {scanData.exif.aufnahmedatum && (
                  <span>
                    🕐 {scanData.exif.bdatum}
                    {scanData.exif.aufnahmezeit && ` ${scanData.exif.aufnahmezeit}`}
                  </span>
                )}
                {scanData.exif.kamera     && <span>📷 {scanData.exif.kamera}</span>}
                {scanData.exif.blende     && <span>{scanData.exif.blende}</span>}
                {scanData.exif.belichtung && <span>{scanData.exif.belichtung}</span>}
                {scanData.exif.brennweite && <span>{scanData.exif.brennweite}</span>}
                {scanData.exif.iso        && <span>ISO {scanData.exif.iso}</span>}
              </div>
            )}

          {/* Formularfelder */}
          <div className="space-y-2.5">
            <Row label="Fotonummer">
              <input
                type="text"
                value={
                  scanData?.bnummer != null
                    ? scanData.bnummer.toLocaleString("de-DE")
                    : "–"
                }
                readOnly
                className="input-field bg-gray-700 text-gray-400 cursor-not-allowed"
              />
            </Row>
            <Row label="Land">
              <input type="text" value={form.land}
                onChange={(e) => setField("land", e.target.value)}
                className="input-field" />
            </Row>
            <Row label="Stadt/Ort">
              <input type="text" value={form.ort}
                onChange={(e) => setField("ort", e.target.value)}
                className="input-field" />
            </Row>
            <Row label="Bildtitel">
              <input type="text" value={form.titel}
                onChange={(e) => setField("titel", e.target.value)}
                className="input-field" />
            </Row>
            <Row label="Datum">
              <input type="text" value={form.bdatum}
                onChange={(e) => setField("bdatum", e.target.value)}
                placeholder="TT.MM.JJJJ"
                className="input-field" />
            </Row>
            <Row label="Negativ / Pfad">
              <div className="flex gap-2 flex-1">
                <input type="text" value={form.bnegativnr}
                  onChange={(e) => setField("bnegativnr", e.target.value)}
                  className="input-field flex-1" placeholder="Negativnr" />
                <input type="text" value={form.pfad}
                  onChange={(e) => setField("pfad", e.target.value)}
                  className="input-field flex-1" placeholder="Pfad" />
              </div>
            </Row>
            <Row label="Fotograf">
              <input type="text" value={form.fotograf}
                onChange={(e) => setField("fotograf", e.target.value)}
                className="input-field" />
            </Row>
            <Row label="Fotogruppe">
              <select value={form.idfgruppe}
                onChange={(e) => setField("idfgruppe", e.target.value)}
                className="input-field">
                <option value="">– keine –</option>
                {fotogruppen.map((g) => (
                  <option key={g.idfgruppe} value={String(g.idfgruppe)}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Row>
          </div>
        </div>

        {/* ── Spalte 2: BAS + Aktions-Panel ── */}
        <div className="flex flex-col gap-5">

          {/* BAS */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-white font-medium text-sm mb-4 flex items-center gap-2">
              🌉 BAS – Brückendatenbank
              <span className="text-gray-500 font-normal text-xs">(optional)</span>
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs mb-1.5 block">BAS-Nummer</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={form.bas}
                    onChange={(e) => {
                      setField("bas", e.target.value);
                      if (!e.target.value) {
                        basUebernehmenRef.current = false;
                        setBasUebernehmen(false);
                      }
                    }}
                    placeholder="z.B. 115907"
                    className={`input-field flex-1 transition-colors ${
                      form.bas ? "bg-red-900/60 border-red-700 text-red-200" : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!form.bas && !basUebernehmen) return;
                      const next = !basUebernehmen;
                      basUebernehmenRef.current = next;
                      setBasUebernehmen(next);
                    }}
                    title={
                      !form.bas && !basUebernehmen
                        ? "Erst eine BAS-Nummer eingeben"
                        : basUebernehmen
                        ? "BAS-Nummer wird übernommen – klicken zum Deaktivieren"
                        : "BAS-Nummer wird NICHT übernommen – klicken zum Aktivieren"
                    }
                    className={`flex-shrink-0 w-10 h-6 rounded-full relative transition-colors focus:outline-none ${
                      basUebernehmen
                        ? "bg-red-600"
                        : form.bas
                        ? "bg-green-600"
                        : "bg-gray-600 cursor-not-allowed opacity-50"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        basUebernehmen ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1.5 block">Reihenfolge</label>
                <input type="text" value={form.basreihenfolge}
                  onChange={(e) => setField("basreihenfolge", e.target.value)}
                  className="input-field" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1.5 block">Bildtitel (BAS)</label>
                <input type="text" value={form.bastitel}
                  onChange={(e) => setField("bastitel", e.target.value)}
                  className="input-field" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1.5 block">BAS-Fotogruppe</label>
                <div className="flex gap-1">
                  <input type="text" value={form.basfgruppe}
                    onChange={(e) => setField("basfgruppe", e.target.value)}
                    className="input-field flex-1" />
                  <select
                    onChange={(e) => {
                      if (e.target.value) setField("basfgruppe", e.target.value);
                      e.target.value = "";
                    }}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-1 text-white text-sm focus:outline-none focus:border-amber-500 cursor-pointer"
                    title="Gruppe wählen"
                  >
                    <option value="">▼</option>
                    <option value="Sonstige">Sonstige</option>
                    <option value="Titelbild">Titelbild</option>
                  </select>
                </div>
              </div>
              {form.land && (
                <div className="pt-2">
                  <a
                    href={`https://www.brueckenweb.de/de/club/new/newbridge?land=${encodeURIComponent(form.land)}&gpsW=${form.gpsbreite}&gpsL=${form.gpslaenge}&stadt=${encodeURIComponent(form.ort)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-amber-400 text-xs hover:text-amber-300"
                  >
                    ↗ Neue Brücke anlegen (brueckenweb.de)
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Aktions-Panel */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <button
              type="submit"
              disabled={submitting || !scanData}
              className="w-full inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/40 text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Eintragen
            </button>
          </div>

          {/* Fotogalerie-Panel */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="text-white font-medium text-sm mb-3 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-blue-400" />
              Fotogalerie
            </h3>
            <div className="flex rounded-lg overflow-hidden border border-gray-700 mb-4">
              <button type="button" onClick={() => setGalerieUebernehmen(false)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${
                  !galerieUebernehmen
                    ? "bg-red-700 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                }`}>
                <span className="text-sm leading-none">✗</span>
                Nicht übernehmen
              </button>
              <div className="w-px bg-gray-700" />
              <button type="button" onClick={() => setGalerieUebernehmen(true)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${
                  galerieUebernehmen
                    ? "bg-green-700 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                }`}>
                <span className="text-sm leading-none">✓</span>
                In Galerie
              </button>
            </div>

            {galerieUebernehmen && (
              <div className="space-y-3">
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 block">Album</label>
                  <AlbumTreeSelect albums={galAlben} value={galerieAlbumId}
                    onChange={setGalerieAlbumId} noSelectionLabel="— kein Album —" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 block">Beschreibung</label>
                  <textarea value={galerieBeschreibung}
                    onChange={(e) => setGalerieBeschreibung(e.target.value)}
                    rows={2} placeholder="Optionale Beschreibung…"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 resize-none placeholder-gray-600" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={galeriePrivat}
                    onChange={(e) => setGaleriePrivat(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-amber-500 flex-shrink-0" />
                  <span className="flex items-center gap-1.5 text-gray-300 text-xs">
                    <Lock className="w-3 h-3 text-amber-400 flex-shrink-0" />
                    Privat (eingeschränkte Sichtbarkeit)
                  </span>
                </label>

                {galGruppen.length > 0 && (
                  <div>
                    <p className="text-gray-500 text-xs mb-1.5 flex items-center gap-1">
                      <Users className="w-3 h-3 flex-shrink-0" />
                      Sichtbar für Gruppen
                      {!galeriePrivat && (
                        <span className="text-gray-600"> (nur relevant bei „Privat")</span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {galGruppen.map((g) => {
                        const active = galerieGruppenIds.includes(g.id);
                        return (
                          <button key={g.id} type="button" title={g.description ?? g.name}
                            onClick={() =>
                              setGalerieGruppenIds((prev) =>
                                active ? prev.filter((id) => id !== g.id) : [...prev, g.id]
                              )
                            }
                            className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                              active
                                ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                                : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                            }`}>
                            {g.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {allTags.length > 0 && (() => {
                  const tagsByGroup = allTags.reduce<Record<string, TagOption[]>>((acc, tag) => {
                    const key = tag.groupName ?? "Ohne Gruppe";
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(tag);
                    return acc;
                  }, {});
                  const entries    = Object.entries(tagsByGroup);
                  const assignedIds = new Set(galerieTags.map((t) => t.id));
                  return (
                    <div>
                      <p className="text-gray-500 text-xs mb-1.5 flex items-center gap-1">
                        <Tag className="w-3 h-3 flex-shrink-0" />
                        Tags
                        {galerieTags.length > 0 && (
                          <span className="ml-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full px-1.5 py-0.5 font-normal">
                            {galerieTags.length} ausgewählt
                          </span>
                        )}
                      </p>
                      <div className="border border-gray-700 rounded-lg overflow-hidden">
                        {entries.map(([groupName, groupTags], idx) => {
                          const isOpen = expandedTagGroups.has(groupName);
                          const selectedCount = groupTags.filter((t) => assignedIds.has(t.id)).length;
                          const groupColor = groupTags[0]?.groupColor;
                          return (
                            <div key={groupName}
                              className={idx < entries.length - 1 ? "border-b border-gray-700" : ""}>
                              <button type="button"
                                onClick={() =>
                                  setExpandedTagGroups((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(groupName)) next.delete(groupName);
                                    else next.add(groupName);
                                    return next;
                                  })
                                }
                                className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-800/60 transition-colors text-left">
                                <span className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                                  {groupColor && (
                                    <span className="w-2 h-2 rounded-full flex-shrink-0 inline-block"
                                      style={{ backgroundColor: groupColor }} />
                                  )}
                                  {groupName}
                                </span>
                                <div className="flex items-center gap-2">
                                  {selectedCount > 0 && (
                                    <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full px-1.5 py-0.5">
                                      {selectedCount}
                                    </span>
                                  )}
                                  <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} />
                                </div>
                              </button>
                              {isOpen && (
                                <div className="px-3 py-2.5 flex flex-wrap gap-1.5 bg-gray-800/40 border-t border-gray-700">
                                  {groupTags.map((tag) => {
                                    const active = assignedIds.has(tag.id);
                                    return (
                                      <button key={tag.id} type="button"
                                        onClick={() =>
                                          active
                                            ? setGalerieTags((prev) => prev.filter((t) => t.id !== tag.id))
                                            : setGalerieTags((prev) => [...prev, tag])
                                        }
                                        className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors border ${
                                          active
                                            ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                                            : "bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300"
                                        }`}>
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
                      {galerieTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {galerieTags.map((t) => (
                            <span key={t.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                              style={{ backgroundColor: t.groupColor ?? "#6b7280" }}>
                              {t.groupName && <span className="opacity-75">{t.groupName}:</span>}
                              {t.name}
                              <button type="button"
                                onClick={() =>
                                  setGalerieTags((prev) => prev.filter((x) => x.id !== t.id))
                                }
                                className="ml-0.5 opacity-75 hover:opacity-100 transition-opacity">
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* ── Spalte 3: GPS-Karte ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-amber-400" />
            <span className="text-white font-medium text-sm">GPS-Position</span>
            <div className="ml-auto flex items-center gap-2 text-xs">
              {scanData && (scanData.exif.gpsBreite !== 0 || scanData.exif.gpsLaenge !== 0) && (
                <button type="button"
                  onClick={() => {
                    setField("gpsbreite", scanData.exif.gpsBreite);
                    setField("gpslaenge", scanData.exif.gpsLaenge);
                    setField("gpshoehe",  scanData.exif.gpsHoehe);
                  }}
                  className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors"
                  title="GPS-Koordinaten aus EXIF wiederherstellen">
                  <RotateCcw className="w-3 h-3" />
                  EXIF
                </button>
              )}
              {hasGps ? (
                <span className="text-green-400">
                  {form.gpsbreite.toFixed(5)}, {form.gpslaenge.toFixed(5)}
                </span>
              ) : (
                <span className="text-gray-500">Keine GPS-Daten</span>
              )}
            </div>
          </div>
          <FotodatenbankMap
            lat={form.gpsbreite}
            lng={form.gpslaenge}
            richtung={scanData?.exif.gpsRichtung ?? -1}
            onPositionChange={(lat, lng) => {
              setField("gpsbreite", lat);
              setField("gpslaenge", lng);
            }}
            onBrueckeSelect={(bas, name) => {
              setField("bas", bas);
              if (!form.bastitel) setField("bastitel", name);
            }}
          />
          <div className="grid grid-cols-3 gap-2 mt-3">
            {(
              [
                ["gpsbreite", "Breite"],
                ["gpslaenge", "Länge"],
                ["gpshoehe",  "Höhe (m)"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <div className="text-gray-500 text-xs mb-1">{label}</div>
                <input
                  type="number" step="any" value={form[key]}
                  onChange={(e) => setField(key, parseFloat(e.target.value) || 0)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Aktionsleiste ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex items-center justify-between gap-6">
        <div className="flex items-center gap-6 flex-wrap min-w-0">
          {scanData && scanData.files.length > 0 && (
            <span className="text-gray-500 text-xs truncate">
              <span className="text-gray-400">Dateien: </span>
              {scanData.files.slice(0, 5).join(", ")}
              {scanData.files.length > 5 && ` +${scanData.files.length - 5} weitere`}
            </span>
          )}
          {stats && (
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-amber-400 font-bold text-lg leading-none">
                  {stats.anzahlZuVerarbeiten}
                </div>
                <div className="text-gray-500 text-xs mt-0.5">noch zu bearbeiten</div>
              </div>
              {form.idfgruppe && (
                <>
                  <div className="w-px h-8 bg-gray-800" />
                  <div className="text-center">
                    <div className="text-blue-400 font-bold text-lg leading-none">
                      {stats.anzahlFotos}
                    </div>
                    <div className="text-gray-500 text-xs mt-0.5">Fotos in Gruppe</div>
                  </div>
                  <div className="w-px h-8 bg-gray-800" />
                  <div className="text-center">
                    <div className="text-green-400 font-bold text-lg leading-none">
                      {stats.anzahlBas}
                    </div>
                    <div className="text-gray-500 text-xs mt-0.5">Brücken in Gruppe</div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={scanNaechstesBild}
            title="Nächstes Bild neu scannen"
            className="inline-flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-2.5 rounded-lg text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleFotoLoeschen}
            disabled={deleting || !scanData}
            title="Aktuelles Foto in den Ordner 'gelöscht' verschieben (kein DB-Eintrag)"
            className="inline-flex items-center gap-2 bg-red-800 hover:bg-red-700 disabled:bg-red-800/40 text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors"
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Foto löschen
          </button>
          <Link
            href="/fotodatenbank/fotogruppen"
            className="inline-flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors"
          >
            <List className="w-4 h-4" />
            Fotogruppen
          </Link>
        </div>
      </div>
    </form>
  );
}

// ─── Hilfkomponente: Beschriftete Formularzeile ───────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 items-start gap-3">
      <label className="text-gray-400 text-sm pt-2 leading-none">{label}</label>
      <div className="col-span-2 flex">{children}</div>
    </div>
  );
}
