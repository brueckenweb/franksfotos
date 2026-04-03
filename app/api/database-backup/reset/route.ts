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

    await backupManager.forceResetBackupStatus();

    return NextResponse.json({
      message: "Backup-Status wurde erfolgreich zurückgesetzt",
      success: true,
    });
  } catch (error) {
    console.error("Fehler beim Zurücksetzen des Backup-Status:", error);
    return NextResponse.json(
      { error: "Fehler beim Zurücksetzen des Backup-Status" },
      { status: 500 }
    );
  }
}
