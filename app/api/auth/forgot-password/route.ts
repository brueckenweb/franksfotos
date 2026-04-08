import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, passwordResetTokens } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { randomBytes } from "crypto";
import { sendPasswordResetEmail } from "@/lib/emails/emailService";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "E-Mail-Adresse fehlt." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Benutzer suchen (kein Fehler zurückgeben, wenn nicht gefunden – Sicherheit!)
    const [user] = await db
      .select({ id: users.id, name: users.name, email: users.email, isActive: users.isActive })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    // Immer gleiche Antwort senden – verhindert User-Enumeration
    const successResponse = NextResponse.json({
      message: "Falls ein Konto mit dieser E-Mail-Adresse existiert, erhältst du in Kürze eine E-Mail mit einem Reset-Link.",
    });

    if (!user || !user.isActive) {
      return successResponse;
    }

    // Alten, noch gültigen Token löschen (max. 1 gleichzeitig)
    await db
      .delete(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.userId, user.id),
          gt(passwordResetTokens.expiresAt, new Date())
        )
      );

    // Neuen Token generieren (64 Bytes = 128 hex Zeichen)
    const token = randomBytes(64).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 Stunde gültig

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token,
      expiresAt,
    });

    // Reset-E-Mail senden
    const baseUrl = process.env.NEXTAUTH_URL || "https://www.frank-sellke.de";
    const resetUrl = `${baseUrl}/passwort-zuruecksetzen?token=${token}`;

    await sendPasswordResetEmail(user.name, user.email, resetUrl);

    return successResponse;
  } catch (error) {
    console.error("[ForgotPassword] Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler." }, { status: 500 });
  }
}
