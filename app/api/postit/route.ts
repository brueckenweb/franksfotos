import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { postItNotes } from "@/lib/db/schema";
import { eq, and, asc, or } from "drizzle-orm";
import { auth } from "@/auth";

const VALID_SICHTBARKEIT = ["alle", "angemeldet", "nicht_angemeldet"] as const;
type Sichtbarkeit = (typeof VALID_SICHTBARKEIT)[number];

// ── GET /api/postit?slot=home ─────────────────────────────────────────────────
// Filtert nach sichtbarkeit:
//   Nicht eingeloggt → "alle" ODER "nicht_angemeldet"
//   Eingeloggt       → "alle" ODER "angemeldet"
export async function GET(request: NextRequest) {
  try {
    const slot = request.nextUrl.searchParams.get("slot");

    if (!slot) {
      return NextResponse.json(
        { error: "Parameter 'slot' ist erforderlich" },
        { status: 400 }
      );
    }

    let isLoggedIn = false;
    try {
      const session = await auth();
      isLoggedIn = !!(session?.user);
    } catch {
      // Fehler beim Auth-Check → als nicht eingeloggt behandeln
    }

    // Welche sichtbarkeit-Werte sind erlaubt?
    const erlaubt = isLoggedIn
      ? [eq(postItNotes.sichtbarkeit, "alle"), eq(postItNotes.sichtbarkeit, "angemeldet")]
      : [eq(postItNotes.sichtbarkeit, "alle"), eq(postItNotes.sichtbarkeit, "nicht_angemeldet")];

    const notes = await db
      .select()
      .from(postItNotes)
      .where(
        and(
          eq(postItNotes.slot, slot),
          eq(postItNotes.isActive, true),
          or(...erlaubt)
        )
      )
      .orderBy(asc(postItNotes.createdAt));

    return NextResponse.json(notes);
  } catch (error) {
    console.error("Fehler beim Abrufen der Post-Its:", error);
    return NextResponse.json(
      { error: "Fehler beim Abrufen der Post-Its" },
      { status: 500 }
    );
  }
}

// ── POST /api/postit ──────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const user = session?.user as { id?: string; isMainAdmin?: boolean } | undefined;

    if (!user?.id || !user?.isMainAdmin) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await request.json();
    const { message, color, slot, sichtbarkeit } = body;

    if (!message?.trim() || !slot?.trim()) {
      return NextResponse.json(
        { error: "Nachricht und Slot sind erforderlich" },
        { status: 400 }
      );
    }

    const validColors = ["yellow", "pink", "blue", "green", "orange"];
    const selectedColor = validColors.includes(color) ? color : "yellow";
    const selectedSichtbarkeit: Sichtbarkeit =
      VALID_SICHTBARKEIT.includes(sichtbarkeit) ? sichtbarkeit : "alle";

    const [result] = await db.insert(postItNotes).values({
      message:      message.trim(),
      color:        selectedColor,
      slot:         slot.trim(),
      isActive:     true,
      sichtbarkeit: selectedSichtbarkeit,
      createdBy:    parseInt(user.id),
    });

    return NextResponse.json({ success: true, id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Fehler beim Erstellen des Post-Its:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen des Post-Its" },
      { status: 500 }
    );
  }
}
