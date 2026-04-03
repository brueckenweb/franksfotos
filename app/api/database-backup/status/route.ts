import { NextResponse } from "next/server";
import { checkBackupPermission } from "@/lib/auth/backup-auth";
import { BackupManager } from "@/lib/backup/backup-manager";

const backupManager = new BackupManager();

export async function GET() {
  try {
    const authResult = await checkBackupPermission();
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const status = await backupManager.getBackupStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error("Fehler beim Abrufen des Backup-Status:", error);
    return NextResponse.json(
      { error: "Fehler beim Abrufen des Backup-Status" },
      { status: 500 }
    );
  }
}
