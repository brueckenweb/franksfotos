/**
 * FranksFotos – Gruppen-Liste
 * GET /api/groups
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const isMainAdmin = (session.user as { isMainAdmin?: boolean }).isMainAdmin ?? false;
    if (!isMainAdmin) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const result = await db
      .select({
        id: groups.id,
        name: groups.name,
        slug: groups.slug,
        description: groups.description,
      })
      .from(groups)
      .orderBy(asc(groups.sortOrder), asc(groups.name));

    return NextResponse.json({ groups: result });
  } catch (error) {
    console.error("GET /api/groups Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}
