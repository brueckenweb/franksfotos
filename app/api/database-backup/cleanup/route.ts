import { NextResponse } from "next/server";
import { checkBackupPermission } from "@/lib/auth/backup-auth";
import { BackupManager } from "@/lib/backup/backup-manager";

const backupManager = new BackupManager();

export async function POST() {
  try {
    const authResult = await checkBackupPermission();
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const deletedCount = await backupManager.cleanupOldBackupsKeepNewest();

    return NextResponse.json({
      message: "Alte Backups erfolgreich gelöscht",
      deletedCount,
      success: true,
    });
  } catch (error) {
    console.error("Fehler beim Cleanup der Backups:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen der alten Backups" },
      { status: 500 }
    );
  }
}
