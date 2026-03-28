/**
 * FranksFotos – Gruppen-Berechtigungen API
 * PUT /api/groups/[id]/permissions  – Berechtigungen einer Gruppe aktualisieren
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { groupPermissions, permissions, groups } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

type Props = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Props) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const isMainAdmin =
      (session.user as { isMainAdmin?: boolean }).isMainAdmin ?? false;
    if (!isMainAdmin) {
      return NextResponse.json({ error: "Nur Hauptadmins können Berechtigungen ändern" }, { status: 403 });
    }

    const { id } = await params;
    const groupId = parseInt(id);

    if (isNaN(groupId)) {
      return NextResponse.json({ error: "Ungültige Gruppen-ID" }, { status: 400 });
    }

    // Gruppe existiert und ist nicht Admin?
    const group = await db
      .select({ id: groups.id, slug: groups.slug })
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1);

    if (group.length === 0) {
      return NextResponse.json({ error: "Gruppe nicht gefunden" }, { status: 404 });
    }

    if (group[0].slug === "admin") {
      return NextResponse.json(
        { error: "Die Admin-Gruppe hat automatisch alle Rechte" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { permissionNames } = body as { permissionNames: string[] };

    if (!Array.isArray(permissionNames)) {
      return NextResponse.json({ error: "permissionNames muss ein Array sein" }, { status: 400 });
    }

    // Alle bestehenden Berechtigungen dieser Gruppe löschen
    await db.delete(groupPermissions).where(eq(groupPermissions.groupId, groupId));

    // Neue Berechtigungen einfügen
    if (permissionNames.length > 0) {
      const permRows = await db
        .select({ id: permissions.id, name: permissions.name })
        .from(permissions)
        .where(inArray(permissions.name, permissionNames));

      if (permRows.length > 0) {
        await db.insert(groupPermissions).values(
          permRows.map((p) => ({ groupId, permissionId: p.id }))
        );
      }
    }

    return NextResponse.json({ success: true, updated: permissionNames.length });
  } catch (error) {
    console.error("PUT /api/groups/[id]/permissions Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}
