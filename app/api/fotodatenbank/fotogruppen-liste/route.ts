/**
 * API-Route: Fotogruppen CRUD
 * GET   /api/fotodatenbank/fotogruppen-liste  → alle Gruppen laden
 * POST  /api/fotodatenbank/fotogruppen-liste  → neue Gruppe anlegen
 * PUT   /api/fotodatenbank/fotogruppen-liste  → bestehende Gruppe bearbeiten
 * PATCH /api/fotodatenbank/fotogruppen-liste  → einaktiv-Feld umschalten
 * Nur für isMainAdmin zugänglich
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fdFotogruppen } from "@/lib/db/schema";
import { asc, eq, count } from "drizzle-orm";
import { fdFotogruppenverkn } from "@/lib/db/schema";

// ── Auth-Hilfsfunktion ────────────────────────────────────────────────────────

async function checkAdmin() {
  const session = await auth();
  return !!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin;
}

// ── GET: alle Fotogruppen laden ───────────────────────────────────────────────

export async function GET() {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  try {
    const gruppen = await db
      .select()
      .from(fdFotogruppen)
      .orderBy(asc(fdFotogruppen.adatum));
    return NextResponse.json(gruppen);
  } catch (error) {
    console.error("Fotogruppen-Liste-Fehler:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// ── POST: neue Fotogruppe anlegen ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  try {
    const body = (await req.json()) as {
      name: string;
      beschreibung: string;
      adatum: string;
      edatum: string;
      einaktiv: "ja" | "nein";
      bartAlt: number;
      routendatenHtml: string;
      routendatenTk2: string;
      routendatenKmz: string;
      eingetragen: string;
    };

    if (!body.name?.trim() || !body.adatum || !body.edatum || !body.eingetragen) {
      return NextResponse.json({ error: "Pflichtfelder fehlen" }, { status: 400 });
    }

    const result = await db.insert(fdFotogruppen).values({
      name:            body.name.trim(),
      beschreibung:    body.beschreibung ?? "",
      adatum:          new Date(body.adatum),
      edatum:          new Date(body.edatum),
      einaktiv:        body.einaktiv ?? "nein",
      bartAlt:         body.bartAlt ?? 0,
      routendatenHtml: body.routendatenHtml ?? "",
      routendatenTk2:  body.routendatenTk2 ?? "",
      routendatenKmz:  body.routendatenKmz ?? "",
      eingetragen:     new Date(body.eingetragen),
    });

    return NextResponse.json({ ok: true, idfgruppe: Number((result as { insertId?: unknown }).insertId ?? 0) }, { status: 201 });
  } catch (error) {
    console.error("Fotogruppen-Create-Fehler:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// ── PUT: bestehende Fotogruppe bearbeiten ─────────────────────────────────────

export async function PUT(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  try {
    const body = (await req.json()) as {
      idfgruppe: number;
      name: string;
      beschreibung: string;
      adatum: string;
      edatum: string;
      einaktiv: "ja" | "nein";
      bartAlt: number;
      routendatenHtml: string;
      routendatenTk2: string;
      routendatenKmz: string;
      eingetragen: string;
    };

    if (!body.idfgruppe || !body.name?.trim() || !body.adatum || !body.edatum) {
      return NextResponse.json({ error: "Pflichtfelder fehlen" }, { status: 400 });
    }

    await db
      .update(fdFotogruppen)
      .set({
        name:            body.name.trim(),
        beschreibung:    body.beschreibung ?? "",
        adatum:          new Date(body.adatum),
        edatum:          new Date(body.edatum),
        einaktiv:        body.einaktiv ?? "nein",
        bartAlt:         body.bartAlt ?? 0,
        routendatenHtml: body.routendatenHtml ?? "",
        routendatenTk2:  body.routendatenTk2 ?? "",
        routendatenKmz:  body.routendatenKmz ?? "",
        eingetragen:     new Date(body.eingetragen),
      })
      .where(eq(fdFotogruppen.idfgruppe, body.idfgruppe));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Fotogruppen-Update-Fehler:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// ── DELETE: Fotogruppe löschen (nur wenn keine Verknüpfungen) ─────────────────

export async function DELETE(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  try {
    const { idfgruppe } = (await req.json()) as { idfgruppe: number };

    if (!idfgruppe) {
      return NextResponse.json({ error: "Keine ID angegeben" }, { status: 400 });
    }

    // Verknüpfte Fotos prüfen
    const [{ anzahl }] = await db
      .select({ anzahl: count() })
      .from(fdFotogruppenverkn)
      .where(eq(fdFotogruppenverkn.idfgruppe, idfgruppe));

    if (anzahl > 0) {
      return NextResponse.json(
        { error: `Löschen nicht möglich – es sind noch ${anzahl} Foto(s) mit dieser Gruppe verknüpft.` },
        { status: 409 }
      );
    }

    await db.delete(fdFotogruppen).where(eq(fdFotogruppen.idfgruppe, idfgruppe));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Fotogruppen-Delete-Fehler:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// ── PATCH: einaktiv-Feld einer Gruppe umschalten ──────────────────────────────

export async function PATCH(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  try {
    const { idfgruppe, einaktiv } = (await req.json()) as {
      idfgruppe: number;
      einaktiv: "ja" | "nein";
    };

    if (!idfgruppe || !["ja", "nein"].includes(einaktiv)) {
      return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
    }

    await db
      .update(fdFotogruppen)
      .set({ einaktiv })
      .where(eq(fdFotogruppen.idfgruppe, idfgruppe));

    return NextResponse.json({ ok: true, idfgruppe, einaktiv });
  } catch (error) {
    console.error("Fotogruppen-Patch-Fehler:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
