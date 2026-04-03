import { NextRequest, NextResponse } from "next/server";
import { checkBackupPermission } from "@/lib/auth/backup-auth";
import { BackupManager } from "@/lib/backup/backup-manager";
import { createReadStream } from "fs";

const backupManager = new BackupManager();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await checkBackupPermission();
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const resolvedParams = await params;
    const backupId = resolvedParams.id;

    if (!backupId) {
      return NextResponse.json({ error: "Backup-ID fehlt" }, { status: 400 });
    }

    const backupFile = await backupManager.getBackupFile(backupId);
    if (!backupFile) {
      return NextResponse.json(
        { error: "Backup nicht gefunden" },
        { status: 404 }
      );
    }

    const fileStream = createReadStream(backupFile.filePath);

    return new NextResponse(fileStream as any, {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${backupFile.filename}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Fehler beim Download:", error);
    return NextResponse.json(
      { error: "Fehler beim Download der Backup-Datei" },
      { status: 500 }
    );
  }
}
