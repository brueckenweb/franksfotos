/**
 * API-Route: fd_fotodatenbank – Liste, Suche, Bearbeiten, Löschen
 *
 * GET    /api/fotodatenbank/datenbank?q=&seite=&limit=&sort=&dir=
 * PUT    /api/fotodatenbank/datenbank   { bnummer, ...felder }
 * DELETE /api/fotodatenbank/datenbank   { bnummer }
 *
 * Nur für isMainAdmin zugänglich.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fdFotodatenbank, fdFotogruppenverkn, fdFotogruppen } from "@/lib/db/schema";
import { or, like, eq, desc, asc, sql } from "drizzle-orm";
import type { AnyMySqlColumn } from "drizzle-orm/mysql-core";

// ── GET: Liste mit Suche + Pagination ─────────────────────────────────────────

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q      = (searchParams.get("q") ?? "").trim();
  const seite  = Math.max(1, parseInt(searchParams.get("seite") ?? "1", 10));
  const limit  = Math.min(200, Math.max(10, parseInt(searchParams.get("limit") ?? "50", 10)));
  const sort   = searchParams.get("sort") ?? "bnummer";
  const dir    = searchParams.get("dir")  === "asc" ? "asc" : "desc";
  const offset = (seite - 1) * limit;

  try {
    // Sortierung – erlaubte Spalten
    const SORT_COLS: Record<string, AnyMySqlColumn> = {
      bnummer:       fdFotodatenbank.bnummer,
      aufnahmedatum: fdFotodatenbank.aufnahmedatum,
      land:          fdFotodatenbank.land,
      ort:           fdFotodatenbank.ort,
      titel:         fdFotodatenbank.titel,
      fotograf:      fdFotodatenbank.fotograf,
      eingetragen:   fdFotodatenbank.eingetragen,
    };
    const sortCol = SORT_COLS[sort] ?? fdFotodatenbank.bnummer;
    const orderBy = dir === "asc" ? asc(sortCol) : desc(sortCol);

    // Such-Bedingung (wird zweimal verwendet)
    const suchBedingung = q
      ? or(
          like(fdFotodatenbank.land,     `%${q}%`),
          like(fdFotodatenbank.ort,      `%${q}%`),
          like(fdFotodatenbank.titel,    `%${q}%`),
          like(fdFotodatenbank.fotograf, `%${q}%`),
          like(fdFotodatenbank.kamera,   `%${q}%`),
          like(fdFotodatenbank.bart,     `%${q}%`),
          like(fdFotodatenbank.bas,      `%${q}%`),
          like(fdFotodatenbank.bdatum,   `%${q}%`),
          sql`CAST(${fdFotodatenbank.bnummer} AS CHAR) LIKE ${`%${q}%`}`,
        )
      : undefined;

    // Parallel: Count + Daten
    const [countResult, rows] = await Promise.all([
      db
        .select({ total: sql<number>`COUNT(*)` })
        .from(fdFotodatenbank)
        .where(suchBedingung),
      db
        .select({
          bnummer:          fdFotodatenbank.bnummer,
          land:             fdFotodatenbank.land,
          ort:              fdFotodatenbank.ort,
          titel:            fdFotodatenbank.titel,
          bdatum:           fdFotodatenbank.bdatum,
          aufnahmedatum:    fdFotodatenbank.aufnahmedatum,
          aufnahmezeit:     fdFotodatenbank.aufnahmezeit,
          bnegativnr:       fdFotodatenbank.bnegativnr,
          bart:             fdFotodatenbank.bart,
          pfad:             fdFotodatenbank.pfad,
          kamera:           fdFotodatenbank.kamera,
          blende:           fdFotodatenbank.blende,
          belichtungsdauer: fdFotodatenbank.belichtungsdauer,
          brennweite:       fdFotodatenbank.brennweite,
          iso:              fdFotodatenbank.iso,
          fotograf:         fdFotodatenbank.fotograf,
          bas:              fdFotodatenbank.bas,
          eingetragen:      fdFotodatenbank.eingetragen,
          gpsB:             fdFotodatenbank.gpsB,
          gpsL:             fdFotodatenbank.gpsL,
          gpsH:             fdFotodatenbank.gpsH,
        })
        .from(fdFotodatenbank)
        .where(suchBedingung)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
    ]);

    const total  = Number(countResult[0]?.total ?? 0);
    const seiten = Math.ceil(total / limit);

    // Fotogruppen für diese Seite nachladen
    const bnummern = rows.map((r) => r.bnummer);
    const gruppenMap: Record<number, Array<{ idfgruppe: number; name: string }>> = {};

    if (bnummern.length > 0) {
      const verkn = await db
        .select({
          bnummer:   fdFotogruppenverkn.bnummer,
          idfgruppe: fdFotogruppenverkn.idfgruppe,
          name:      fdFotogruppen.name,
        })
        .from(fdFotogruppenverkn)
        .leftJoin(fdFotogruppen, eq(fdFotogruppenverkn.idfgruppe, fdFotogruppen.idfgruppe))
        .where(
          sql`${fdFotogruppenverkn.bnummer} IN (${sql.join(
            bnummern.map((n) => sql`${n}`),
            sql`,`
          )})`
        );

      for (const v of verkn) {
        if (!gruppenMap[v.bnummer]) gruppenMap[v.bnummer] = [];
        gruppenMap[v.bnummer].push({ idfgruppe: v.idfgruppe, name: v.name ?? "" });
      }
    }

    const result = rows.map((r) => ({
      ...r,
      fotogruppen: gruppenMap[r.bnummer] ?? [],
    }));

    return NextResponse.json({ rows: result, total, seite, seiten, limit });
  } catch (err) {
    console.error("Datenbank-GET Fehler:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── PUT: Eintrag bearbeiten ────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }

  const bnummer = Number(body.bnummer);
  if (!bnummer || isNaN(bnummer)) {
    return NextResponse.json({ error: "Ungültige bnummer" }, { status: 400 });
  }

  const g = (k: string) => String(body[k] ?? "");

  const aufnahmedatum = g("aufnahmedatum");
  const isValidDate   = /^\d{4}-\d{2}-\d{2}$/.test(aufnahmedatum);
  const parsedDatum   = isValidDate ? new Date(aufnahmedatum + "T00:00:00") : new Date();

  const eingetragen   = g("eingetragen");
  const isValidEinget = /^\d{4}-\d{2}-\d{2}$/.test(eingetragen);
  const parsedEinget  = isValidEinget ? new Date(eingetragen + "T00:00:00") : new Date();

  const aufnahmezeit = g("aufnahmezeit");
  const isValidZeit  = /^\d{2}:\d{2}:\d{2}$/.test(aufnahmezeit);

  try {
    await db
      .update(fdFotodatenbank)
      .set({
        land:             g("land"),
        ort:              g("ort"),
        titel:            g("titel"),
        bdatum:           g("bdatum"),
        aufnahmedatum:    parsedDatum,
        aufnahmezeit:     isValidZeit ? aufnahmezeit : "00:00:00",
        bnegativnr:       g("bnegativnr"),
        bart:             g("bart").substring(0, 3),
        pfad:             g("pfad"),
        kamera:           g("kamera"),
        blende:           g("blende"),
        belichtungsdauer: g("belichtungsdauer"),
        brennweite:       g("brennweite"),
        iso:              g("iso"),
        fotograf:         g("fotograf"),
        bas:              g("bas") || "0",
        gpsB:             g("gpsB"),
        gpsL:             g("gpsL"),
        gpsH:             g("gpsH"),
        eingetragen:      parsedEinget,
      })
      .where(eq(fdFotodatenbank.bnummer, bnummer));

    return NextResponse.json({ success: true, bnummer });
  } catch (err) {
    console.error("Datenbank-PUT Fehler:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── DELETE: Eintrag löschen ───────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }

  const bnummer = Number(body.bnummer);
  if (!bnummer || isNaN(bnummer)) {
    return NextResponse.json({ error: "Ungültige bnummer" }, { status: 400 });
  }

  try {
    // Verknüpfungen werden per ON DELETE CASCADE automatisch mitgelöscht
    await db.delete(fdFotodatenbank).where(eq(fdFotodatenbank.bnummer, bnummer));
    return NextResponse.json({ success: true, bnummer });
  } catch (err) {
    console.error("Datenbank-DELETE Fehler:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
