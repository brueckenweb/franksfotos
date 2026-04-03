import { auth } from "@/auth";

export async function checkBackupPermission(): Promise<{
  authorized: boolean;
  user?: { id: number; name: string };
  error?: string;
}> {
  try {
    const session = await auth();

    if (!session?.user) {
      return { authorized: false, error: "Nicht authentifiziert – keine gültige Session" };
    }

    if (!(session.user as any).isMainAdmin) {
      return {
        authorized: false,
        error: "Keine Berechtigung für Backup-Funktionen (nur Haupt-Admin)",
      };
    }

    return {
      authorized: true,
      user: {
        id: Number((session.user as any).id),
        name: session.user.name ?? "Admin",
      },
    };
  } catch (error) {
    console.error("Fehler bei der Backup-Berechtigungsprüfung:", error);
    return {
      authorized: false,
      error:
        "Fehler bei der Berechtigungsprüfung: " +
        (error instanceof Error ? error.message : "Unbekannter Fehler"),
    };
  }
}
