import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/auth/permissions";
import { sendBroadcastEmail } from "@/lib/emails/emailService";

export async function POST(request: NextRequest) {
  // Authentifizierung & Admin-Check
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
  }

  const isMainAdmin = !!(session.user as { isMainAdmin?: boolean }).isMainAdmin;
  const userPermissions = (session.user as { permissions?: string[] }).permissions ?? [];

  if (!isAdmin(userPermissions, isMainAdmin)) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  try {
    const { subject, htmlContent } = await request.json();

    if (!subject || !htmlContent) {
      return NextResponse.json(
        { error: "Betreff und Inhalt sind erforderlich." },
        { status: 400 }
      );
    }

    // Alle aktiven Nutzer laden
    const allUsers = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.isActive, true));

    if (allUsers.length === 0) {
      return NextResponse.json(
        { error: "Keine aktiven Nutzer gefunden." },
        { status: 400 }
      );
    }

    // Broadcast-Email versenden
    const result = await sendBroadcastEmail(subject, htmlContent, allUsers);

    return NextResponse.json({
      message: `E-Mail erfolgreich versendet.`,
      sent: result.sent,
      failed: result.failed,
      total: allUsers.length,
      errors: result.errors,
    });
  } catch (error) {
    console.error("[API] Fehler beim Versenden der Broadcast-Email:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
