import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { postItNotes } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { auth } from "@/auth";

// ── GET /api/admin/postits ────────────────────────────────────────────────────
// Gibt ALLE Post-Its zurück (auch inaktive). Nur für isMainAdmin.
export async function GET() {
  try {
    const session = await auth();
    const user = session?.user as { isMainAdmin?: boolean } | undefined;

    if (!user?.isMainAdmin) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const notes = await db
      .select()
      .from(postItNotes)
      .orderBy(desc(postItNotes.createdAt));

    return NextResponse.json(notes);
  } catch (error) {
    console.error("Fehler beim Laden der Post-Its:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Post-Its" },
      { status: 500 }
    );
  }
}
