import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    // Validierung
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

    // Prüfen, ob E-Mail bereits existiert
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

    // Passwort hashen
    const passwordHash = await bcrypt.hash(password, 12);

    // Neuen Benutzer erstellen
    await db
      .insert(users)
      .values({
        email,
        passwordHash,
        name,
        isActive: true,
        isMainAdmin: false,
      });

    // Neuen Benutzer abrufen
    const [newUser] = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return NextResponse.json(
      { message: "Registrierung erfolgreich!", user: newUser },
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