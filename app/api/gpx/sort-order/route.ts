/**
 * API: GPX-Track Reihenfolge speichern
 * PUT /api/gpx/sort-order → Array von { id, sortOrder } in der Datenbank speichern
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fdGpx } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  try {
    const body = await request.json();

    if (!Array.isArray(body) || body.length === 0) {
      return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
    }

    // Alle Updates parallel ausführen
    await Promise.all(
      body.map(({ id, sortOrder }: { id: number; sortOrder: number }) =>
        db.update(fdGpx).set({ sortOrder }).where(eq(fdGpx.id, id))
      )
    );

    return NextResponse.json({ success: true, updated: body.length });
  } catch (err) {
    console.error("[GPX sort-order PUT]", err);
    return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 });
  }
}
