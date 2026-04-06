/**
 * FranksFotos – Individuelle User-Permissions
 * GET /api/users/[id]/permissions  → Aktuelle Overrides + effektive Gruppenrechte
 * PUT /api/users/[id]/permissions  → Overrides speichern
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  users,
  userGroups,
  groups,
  userPermissions,
  groupPermissions,
  permissions,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user)
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const isMainAdmin =
      (session.user as { isMainAdmin?: boolean }).isMainAdmin ?? false;
    const sessionPerms =
      (session.user as { permissions?: string[] }).permissions ?? [];

    if (!isMainAdmin && !hasPermission(sessionPerms, PERMISSIONS.MANAGE_USERS)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id);

    // Benutzer laden (kurze Prüfung)
    const userRow = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!userRow[0])
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });

    // Gruppen des Users
    const userGroupRows = await db
      .select({ groupId: groups.id, groupSlug: groups.slug })
      .from(userGroups)
      .innerJoin(groups, eq(userGroups.groupId, groups.id))
      .where(eq(userGroups.userId, userId));

    // Gruppenrechte (effektive Baseline)
    const groupIds = userGroupRows.map((g) => g.groupId);
    let groupPermNames: string[] = [];
    if (groupIds.length > 0) {
      const gpRows = await db
        .select({ permName: permissions.name })
        .from(groupPermissions)
        .innerJoin(permissions, eq(groupPermissions.permissionId, permissions.id))
        .where(inArray(groupPermissions.groupId, groupIds));
      groupPermNames = gpRows.map((r) => r.permName);
    }

    // Individuelle User-Overrides
    const userPermRows = await db
      .select({
        permName: permissions.name,
        isGranted: userPermissions.isGranted,
      })
      .from(userPermissions)
      .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
      .where(eq(userPermissions.userId, userId));

    const overrides: Record<string, boolean> = {};
    for (const row of userPermRows) {
      overrides[row.permName] = row.isGranted;
    }

    return NextResponse.json({
      groupPermissions: groupPermNames,
      overrides, // { "upload_photos": true/false, ... }
    });
  } catch (error) {
    console.error("GET /api/users/[id]/permissions Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}

// ── PUT ──────────────────────────────────────────────────────────────────────
// Body: { overrides: Record<string, boolean | null> }
//   null  → Override entfernen (Gruppenrecht gilt wieder)
//   true  → individuell gewähren
//   false → individuell entziehen
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user)
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const isMainAdmin =
      (session.user as { isMainAdmin?: boolean }).isMainAdmin ?? false;
    const sessionPerms =
      (session.user as { permissions?: string[] }).permissions ?? [];
    const currentAdminId = parseInt((session.user as { id: string }).id);

    if (!isMainAdmin && !hasPermission(sessionPerms, PERMISSIONS.MANAGE_PERMISSIONS)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id);

    const body = await request.json();
    const overrides: Record<string, boolean | null> = body.overrides ?? {};

    // Alle Permission-Namen aus DB laden (Mapping Name → ID)
    const allPerms = await db
      .select({ id: permissions.id, name: permissions.name })
      .from(permissions);

    const permMap = new Map(allPerms.map((p) => [p.name, p.id]));

    // Alle bestehenden Overrides für diesen User löschen
    await db
      .delete(userPermissions)
      .where(eq(userPermissions.userId, userId));

    // Neue Overrides einfügen (null-Einträge = "Erben", werden nicht gespeichert)
    const inserts: Array<{
      userId: number;
      permissionId: number;
      isGranted: boolean;
      grantedBy: number;
    }> = [];

    for (const [permName, value] of Object.entries(overrides)) {
      if (value === null) continue; // kein Override
      const permId = permMap.get(permName);
      if (!permId) continue;
      inserts.push({
        userId,
        permissionId: permId,
        isGranted: value,
        grantedBy: currentAdminId,
      });
    }

    if (inserts.length > 0) {
      await db.insert(userPermissions).values(inserts);
    }

    return NextResponse.json({ success: true, saved: inserts.length });
  } catch (error) {
    console.error("PUT /api/users/[id]/permissions Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}
