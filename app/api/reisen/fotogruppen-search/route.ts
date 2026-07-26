/**
 * GET /api/reisen/fotogruppen-search?q=...
 * Sucht Fotogruppen aus fd_fotogruppen (alle, auch inaktive)
 * Nur für isMainAdmin zugänglich.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fdFotogruppen } from "@/lib/db/schema";
import { like, or, asc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(session?.user as { isMainAdmin?: boolean })?.isMainAdmin) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  try {
    const gruppen = await db
      .select({
        idfgruppe: fdFotogruppen.idfgruppe,
        name: fdFotogruppen.name,
        einaktiv: fdFotogruppen.einaktiv,
        adatum: fdFotogruppen.adatum,
        edatum: fdFotogruppen.edatum,
      })
      .from(fdFotogruppen)
      .where(
        q.length >= 2
          ? or(
              like(fdFotogruppen.name, `%${q}%`),
              like(fdFotogruppen.beschreibung, `%${q}%`),
            )
          : undefined
      )
      .orderBy(asc(fdFotogruppen.name))
      .limit(30);

    return NextResponse.json(gruppen);
  } catch (error) {
    console.error("fotogruppen-search:", error);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
