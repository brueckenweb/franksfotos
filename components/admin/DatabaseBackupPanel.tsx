"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Database,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
  Trash2,
  RefreshCw,
  Play,
} from "lucide-react";

interface BackupInfo {
  id: string;
  filename: string;
  created_at: string;
  size: number;
  status: "completed" | "failed" | "running";
  tables_count?: number;
}

interface BackupStatus {
  isRunning: boolean;
  progress?: number;
  currentTable?: string;
  error?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DatabaseBackupPanel() {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [status, setStatus] = useState<BackupStatus>({ isRunning: false });
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/database-backup");
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups ?? []);
        setStatus(data.status ?? { isRunning: false });
      }
    } catch (err) {
      console.error("Fehler beim Laden der Backup-Daten:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/database-backup/status");
      if (res.ok) {
        const s: BackupStatus = await res.json();
        setStatus(s);
        if (!s.isRunning) {
          // Backup fertig → Liste neu laden
          await loadData();
        }
      }
    } catch {
      // ignorieren
    }
  }, [loadData]);

  // Initial laden
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Polling während Backup läuft
  useEffect(() => {
    if (!status.isRunning) return;
    const interval = setInterval(pollStatus, 2000);
    return () => clearInterval(interval);
  }, [status.isRunning, pollStatus]);

  const startBackup = async () => {
    setIsStarting(true);
    setActionMsg(null);
    try {
      const res = await fetch("/api/database-backup", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setActionMsg({ type: "success", text: data.message });
        setStatus({ isRunning: true, progress: 0, currentTable: "Initialisierung..." });
      } else {
        setActionMsg({ type: "error", text: data.error ?? "Unbekannter Fehler" });
      }
    } catch {
      setActionMsg({ type: "error", text: "Netzwerkfehler beim Starten des Backups" });
    } finally {
      setIsStarting(false);
    }
  };

  const handleCleanup = async () => {
    if (!confirm("Alle Backups außer dem neuesten löschen?")) return;
    setIsCleaning(true);
    setActionMsg(null);
    try {
      const res = await fetch("/api/database-backup/cleanup", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setActionMsg({
          type: "success",
          text: `${data.message} (${data.deletedCount} gelöscht)`,
        });
        await loadData();
      } else {
        setActionMsg({ type: "error", text: data.error ?? "Fehler beim Cleanup" });
      }
    } catch {
      setActionMsg({ type: "error", text: "Netzwerkfehler beim Cleanup" });
    } finally {
      setIsCleaning(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Backup-Status zurücksetzen? Nur verwenden wenn ein Backup hängt.")) return;
    setIsResetting(true);
    setActionMsg(null);
    try {
      const res = await fetch("/api/database-backup/reset", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setActionMsg({ type: "success", text: data.message });
        await loadData();
      } else {
        setActionMsg({ type: "error", text: data.error ?? "Fehler beim Reset" });
      }
    } catch {
      setActionMsg({ type: "error", text: "Netzwerkfehler beim Reset" });
    } finally {
      setIsResetting(false);
    }
  };

  const handleDownload = (backupId: string) => {
    window.location.href = `/api/database-backup/${backupId}/download`;
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      {/* Header */}
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Database className="w-5 h-5 text-cyan-400" />
        Datenbank-Backup
      </h2>

      {/* Feedback-Meldung */}
      {actionMsg && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-lg px-4 py-3 text-sm ${
            actionMsg.type === "success"
              ? "bg-green-500/10 border border-green-500/30 text-green-400"
              : "bg-red-500/10 border border-red-500/30 text-red-400"
          }`}
        >
          {actionMsg.type === "success" ? (
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <span>{actionMsg.text}</span>
        </div>
      )}

      {/* Status-Anzeige während Backup läuft */}
      {status.isRunning && (
        <div className="mb-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 text-cyan-400 text-sm font-medium mb-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Backup läuft…
          </div>
          {status.currentTable && (
            <p className="text-cyan-300 text-xs mb-2">{status.currentTable}</p>
          )}
          {status.progress !== undefined && (
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-cyan-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.round(status.progress)}%` }}
              />
            </div>
          )}
          {status.progress !== undefined && (
            <p className="text-cyan-400 text-xs mt-1 text-right">
              {Math.round(status.progress)} %
            </p>
          )}
        </div>
      )}

      {/* Fehlermeldung aus Status */}
      {status.error && !status.isRunning && (
        <div className="mb-4 flex items-start gap-2 rounded-lg px-4 py-3 text-sm bg-red-500/10 border border-red-500/30 text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Letzter Fehler: {status.error}</span>
        </div>
      )}

      {/* Aktions-Buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={startBackup}
          disabled={status.isRunning || isStarting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isStarting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          Backup starten
        </button>

        <button
          onClick={() => loadData()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Aktualisieren
        </button>

        {backups.length > 1 && (
          <button
            onClick={handleCleanup}
            disabled={isCleaning || status.isRunning}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-700 hover:bg-orange-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCleaning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Alte löschen (nur neuestes behalten)
          </button>
        )}

        {status.isRunning && (
          <button
            onClick={handleReset}
            disabled={isResetting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isResetting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            Status zurücksetzen
          </button>
        )}
      </div>

      {/* Backup-Liste */}
      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Lade Backup-Liste…
        </div>
      ) : backups.length === 0 ? (
        <div className="text-gray-500 text-sm text-center py-6 border border-dashed border-gray-700 rounded-lg">
          Noch keine Backups vorhanden. Klicken Sie auf „Backup starten".
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-gray-400 text-xs mb-1">
            {backups.length} Backup{backups.length !== 1 ? "s" : ""} vorhanden
          </p>
          {backups.map((backup, idx) => (
            <div
              key={backup.id}
              className={`flex items-center justify-between rounded-lg px-4 py-3 border ${
                idx === 0
                  ? "bg-cyan-500/5 border-cyan-500/20"
                  : "bg-gray-800 border-gray-700"
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {idx === 0 && (
                    <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full">
                      Neuestes
                    </span>
                  )}
                  <p className="text-gray-300 text-sm font-mono truncate">
                    {backup.filename}
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-4 mt-0.5 text-xs text-gray-500">
                  <span>📅 {formatDate(backup.created_at)}</span>
                  <span>💾 {formatBytes(backup.size)}</span>
                  {backup.tables_count !== undefined && (
                    <span>🗄️ {backup.tables_count} Tabellen</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDownload(backup.id)}
                className="ml-4 shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white text-xs font-medium transition-colors"
                title="Backup herunterladen"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
