import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { postItNotes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

// ── Hilfsfunktion: Admin-Check ────────────────────────────────────────────────
async function requireAdmin() {
  const session = await auth();
  const user = session?.user as { id?: string; isMainAdmin?: boolean } | undefined;
  if (!user?.id || !user?.isMainAdmin) return null;
  return user;
}

// ── PATCH /api/postit/[id] ────────────────────────────────────────────────────
// Aktualisiert ein Post-It (Nachricht, Farbe, Slot, isActive). Nur Admin.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;
    const postItId = parseInt(id);
    if (isNaN(postItId)) {
      return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
    }

    // Existiert das Post-It?
    const [existing] = await db
      .select()
      .from(postItNotes)
      .where(eq(postItNotes.id, postItId));

    if (!existing) {
      return NextResponse.json({ error: "Post-It nicht gefunden" }, { status: 404 });
    }

    const body = await request.json();
    const { message, color, slot, isActive } = body;

    const updateData: Partial<typeof postItNotes.$inferInsert> = {};

    if (message !== undefined) updateData.message = message.trim();
    if (slot !== undefined)    updateData.slot    = slot.trim();
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (color !== undefined) {
      const validColors = ["yellow", "pink", "blue", "green", "orange"];
      updateData.color = validColors.includes(color) ? color : existing.color;
    }

    await db
      .update(postItNotes)
      .set(updateData)
      .where(eq(postItNotes.id, postItId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fehler beim Aktualisieren des Post-Its:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Post-Its" },
      { status: 500 }
    );
  }
}

// ── DELETE /api/postit/[id] ───────────────────────────────────────────────────
// Löscht ein Post-It endgültig. Nur Admin.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;
    const postItId = parseInt(id);
    if (isNaN(postItId)) {
      return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(postItNotes)
      .where(eq(postItNotes.id, postItId));

    if (!existing) {
      return NextResponse.json({ error: "Post-It nicht gefunden" }, { status: 404 });
    }

    await db.delete(postItNotes).where(eq(postItNotes.id, postItId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fehler beim Löschen des Post-Its:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen des Post-Its" },
      { status: 500 }
    );
  }
}
