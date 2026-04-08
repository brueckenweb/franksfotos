import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { postItNotes } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { auth } from "@/auth";

// ── GET /api/postit?slot=home ─────────────────────────────────────────────────
// Gibt alle aktiven Post-Its für einen bestimmten Slot zurück.
// Öffentlich zugänglich (kein Login erforderlich).
export async function GET(request: NextRequest) {
  try {
    const slot = request.nextUrl.searchParams.get("slot");

    if (!slot) {
      return NextResponse.json(
        { error: "Parameter 'slot' ist erforderlich" },
        { status: 400 }
      );
    }

    const notes = await db
      .select()
      .from(postItNotes)
      .where(
        and(
          eq(postItNotes.slot, slot),
          eq(postItNotes.isActive, true)
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
// Erstellt ein neues Post-It. Nur für isMainAdmin.
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const user = session?.user as { id?: string; isMainAdmin?: boolean } | undefined;

    if (!user?.id || !user?.isMainAdmin) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { message, color, slot } = body;

    if (!message?.trim() || !slot?.trim()) {
      return NextResponse.json(
        { error: "Nachricht und Slot sind erforderlich" },
        { status: 400 }
      );
    }

    const validColors = ["yellow", "pink", "blue", "green", "orange"];
    const selectedColor = validColors.includes(color) ? color : "yellow";

    const [result] = await db.insert(postItNotes).values({
      message:   message.trim(),
      color:     selectedColor,
      slot:      slot.trim(),
      isActive:  true,
      createdBy: parseInt(user.id),
    });

    return NextResponse.json(
      { success: true, id: result.insertId },
      { status: 201 }
    );
  } catch (error) {
    console.error("Fehler beim Erstellen des Post-Its:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen des Post-Its" },
      { status: 500 }
    );
  }
}
