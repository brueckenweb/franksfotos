import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, passwordResetTokens } from "@/lib/db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Ungültiger Token." }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Das Passwort muss mindestens 8 Zeichen lang sein." },
        { status: 400 }
      );
    }

    // Token in der Datenbank suchen (muss gültig + ungenutzt sein)
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          gt(passwordResetTokens.expiresAt, new Date()),
          isNull(passwordResetTokens.usedAt)
        )
      )
      .limit(1);

    if (!resetToken) {
      return NextResponse.json(
        { error: "Der Reset-Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an." },
        { status: 400 }
      );
    }

    // Neues Passwort hashen
    const passwordHash = await bcrypt.hash(password, 12);

    // Passwort aktualisieren
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, resetToken.userId));

    // Token als benutzt markieren
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, resetToken.id));

    return NextResponse.json({ message: "Passwort erfolgreich geändert. Du kannst dich jetzt anmelden." });
  } catch (error) {
    console.error("[ResetPassword] Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler." }, { status: 500 });
  }
}
