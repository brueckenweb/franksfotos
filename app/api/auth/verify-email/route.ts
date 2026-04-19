import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, emailVerificationTokens } from "@/lib/db/schema";
import { eq, and, isNull, gt } from "drizzle-orm";
import { sendWelcomeEmailToUser } from "@/lib/emails/emailService";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Kein Token angegeben." },
        { status: 400 }
      );
    }

    // ── Token in der Datenbank suchen ─────────────────────────────────────
    const [tokenRecord] = await db
      .select()
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.token, token),
          isNull(emailVerificationTokens.usedAt),          // noch nicht verwendet
          gt(emailVerificationTokens.expiresAt, new Date()) // noch nicht abgelaufen
        )
      )
      .limit(1);

    if (!tokenRecord) {
      return NextResponse.json(
        { error: "Der Bestätigungslink ist ungültig oder bereits abgelaufen." },
        { status: 400 }
      );
    }

    // ── User aktivieren ───────────────────────────────────────────────────
    const [user] = await db
      .select({ id: users.id, name: users.name, email: users.email, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, tokenRecord.userId))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: "Benutzer nicht gefunden." },
        { status: 404 }
      );
    }

    // Wenn Account bereits aktiv ist, trotzdem Token als verbraucht markieren
    if (!user.isActive) {
      await db
        .update(users)
        .set({ isActive: true })
        .where(eq(users.id, user.id));
    }

    // ── Token als verbraucht markieren ────────────────────────────────────
    await db
      .update(emailVerificationTokens)
      .set({ usedAt: new Date() })
      .where(eq(emailVerificationTokens.id, tokenRecord.id));

    // ── Willkommensmail senden (nur bei erstmaliger Aktivierung) ──────────
    if (!user.isActive) {
      sendWelcomeEmailToUser(user.name, user.email);
    }

    console.log(`[VerifyEmail] Account aktiviert für: ${user.email}`);

    return NextResponse.json(
      { message: "E-Mail-Adresse erfolgreich bestätigt. Du kannst dich jetzt anmelden.", name: user.name },
      { status: 200 }
    );
  } catch (error) {
    console.error("[VerifyEmail] Fehler:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
