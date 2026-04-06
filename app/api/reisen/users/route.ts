/**
 * GET /api/reisen/users  – Alle aktiven User (für Partner-Auswahl)
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  try {
    const allUsers = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.isActive, true));

    return NextResponse.json(allUsers);
  } catch (error) {
    console.error("GET /api/reisen/users:", error);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
