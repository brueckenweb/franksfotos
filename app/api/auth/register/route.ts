import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { users, emailVerificationTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  sendNewUserNotificationToAdmin,
  sendEmailVerificationEmail,
} from "@/lib/emails/emailService";

// Mindestzeit in Millisekunden, die das Formular sichtbar gewesen sein muss (Bot-Schutz)
const MIN_FORM_TIME_MS = 3000;

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, website, formLoadedAt } = await request.json();

    // ── Bot-Schutz 1: Honeypot-Feld ──────────────────────────────────────
    // Das Feld „website" ist im Formular versteckt – echte User füllen es nie aus.
    if (website && website.trim() !== "") {
      // Stumm ablehnen: Bots sollen keinen Unterschied merken
      console.warn("[Register] Bot-Verdacht (Honeypot gesetzt):", email);
      return NextResponse.json(
        { message: "Registrierung erfolgreich!", user: { id: 0, email, name } },
        { status: 201 }
      );
    }

    // ── Bot-Schutz 2: Zeitbasierte Prüfung ───────────────────────────────
    // Formular muss mindestens MIN_FORM_TIME_MS angezeigt worden sein.
    if (formLoadedAt) {
      const elapsed = Date.now() - Number(formLoadedAt);
      if (elapsed < MIN_FORM_TIME_MS) {
        console.warn("[Register] Bot-Verdacht (zu schnell abgeschickt):", elapsed, "ms");
        return NextResponse.json(
          { error: "Bitte füllen Sie das Formular vollständig aus." },
          { status: 400 }
        );
      }
    }

    // ── Validierung ───────────────────────────────────────────────────────
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "E-Mail, Passwort und Name sind erforderlich." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Passwort muss mindestens 6 Zeichen lang sein." },
        { status: 400 }
      );
    }

    // ── Prüfen, ob E-Mail bereits existiert ──────────────────────────────
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: "Diese E-Mail-Adresse ist bereits registriert." },
        { status: 400 }
      );
    }

    // ── Passwort hashen ───────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash(password, 12);

    // ── Neuen Benutzer erstellen (isActive = false bis E-Mail bestätigt) ──
    await db
      .insert(users)
      .values({
        email,
        passwordHash,
        name,
        isActive: false,   // ← Account bleibt inaktiv bis E-Mail bestätigt!
        isMainAdmin: false,
      });

    // ── Neuen Benutzer abrufen ────────────────────────────────────────────
    const [newUser] = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    // ── Verifikations-Token generieren (24h gültig) ───────────────────────
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24 Stunden

    await db.insert(emailVerificationTokens).values({
      userId: newUser.id,
      token,
      expiresAt,
    });

    // ── Verifikationsmail senden ──────────────────────────────────────────
    // AUTH_URL = NextAuth v5, NEXTAUTH_URL = NextAuth v4 (als Fallback), dann Produktions-URL
    const baseUrl =
      process.env.AUTH_URL ||
      process.env.NEXTAUTH_URL ||
      "https://www.frank-sellke.de";
    const verificationUrl = `${baseUrl}/verify-email?token=${token}`;

    sendEmailVerificationEmail(name, email, verificationUrl);
    sendNewUserNotificationToAdmin(name, email);

    return NextResponse.json(
      { message: "Registrierung erfolgreich! Bitte prüfe dein Postfach.", user: { id: newUser.id, email: newUser.email, name: newUser.name } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registrierungsfehler:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
