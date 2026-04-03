import { NextResponse } from "next/server";
import { checkBackupPermission } from "@/lib/auth/backup-auth";
import { BackupManager } from "@/lib/backup/backup-manager";

const backupManager = new BackupManager();

// GET – Backup-Liste und Status abrufen
export async function GET() {
  try {
    const authResult = await checkBackupPermission();
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const backups = await backupManager.getBackupList();
    const status = await backupManager.getBackupStatus();

    return NextResponse.json({ backups, status, success: true });
  } catch (error) {
    console.error("Fehler beim Abrufen der Backup-Daten:", error);
    return NextResponse.json(
      { error: "Fehler beim Abrufen der Backup-Daten" },
      { status: 500 }
    );
  }
}

// POST – Neues Backup starten
export async function POST() {
  try {
    const authResult = await checkBackupPermission();
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const currentStatus = await backupManager.getBackupStatus();
    if (currentStatus.isRunning) {
      return NextResponse.json(
        { error: "Es läuft bereits ein Backup-Prozess" },
        { status: 409 }
      );
    }

    // Backup asynchron starten
    backupManager.startBackup().catch(async (error: Error) => {
      console.error("Backup-Fehler:", error);
      try {
        const manager2 = new BackupManager();
        await manager2.saveStatus({
          isRunning: false,
          error: error.message || "Unbekannter Backup-Fehler",
        });
      } catch (statusError) {
        console.error(
          "Fehler beim Zurücksetzen des Backup-Status:",
          statusError
        );
      }
    });

    return NextResponse.json({
      message: "Backup-Prozess gestartet",
      success: true,
    });
  } catch (error) {
    console.error("Fehler beim Starten des Backups:", error);
    return NextResponse.json(
      { error: "Fehler beim Starten des Backups" },
      { status: 500 }
    );
  }
}
