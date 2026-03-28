/**
 * FranksFotos – User by ID
 * GET    /api/users/[id]
 * PUT    /api/users/[id]
 * DELETE /api/users/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, userGroups, groups } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import bcrypt from "bcryptjs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const { id } = await params;
    const userId = parseInt(id);
    const currentUserId = parseInt((session.user as { id: string }).id);

    // User darf sich selbst sehen; für andere braucht man Rechte
    const userPermissions = (session.user as { permissions?: string[]; isMainAdmin?: boolean }).permissions ?? [];
    const isMainAdmin = (session.user as { isMainAdmin?: boolean }).isMainAdmin ?? false;

    if (userId !== currentUserId && !isMainAdmin && !hasPermission(userPermissions, PERMISSIONS.MANAGE_USERS)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const userResult = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatar: users.avatar,
        isActive: users.isActive,
        isMainAdmin: users.isMainAdmin,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userResult[0]) {
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
    }

    const userGroups2 = await db
      .select({ groupSlug: groups.slug, groupName: groups.name, groupId: groups.id })
      .from(userGroups)
      .innerJoin(groups, eq(userGroups.groupId, groups.id))
      .where(eq(userGroups.userId, userId));

    return NextResponse.json({ user: userResult[0], groups: userGroups2 });
  } catch (error) {
    console.error("GET /api/users/[id] Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const { id } = await params;
    const userId = parseInt(id);
    const currentUserId = parseInt((session.user as { id: string }).id);

    const userPermissions = (session.user as { permissions?: string[]; isMainAdmin?: boolean }).permissions ?? [];
    const isMainAdmin = (session.user as { isMainAdmin?: boolean }).isMainAdmin ?? false;

    if (userId !== currentUserId && !isMainAdmin && !hasPermission(userPermissions, PERMISSIONS.MANAGE_USERS)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, password, isActive, groupSlugs } = body;

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) updateData.passwordHash = await bcrypt.hash(password, 12);
    if (isActive !== undefined) updateData.isActive = isActive;

    if (Object.keys(updateData).length > 0) {
      await db.update(users).set(updateData).where(eq(users.id, userId));
    }

    // Gruppen aktualisieren (nur Admin darf das)
    if (groupSlugs !== undefined && (isMainAdmin || hasPermission(userPermissions, PERMISSIONS.MANAGE_USERS))) {
      await db.delete(userGroups).where(eq(userGroups.userId, userId));

      if (Array.isArray(groupSlugs) && groupSlugs.length > 0) {
        for (const groupSlug of groupSlugs) {
          const groupResult = await db
            .select({ id: groups.id })
            .from(groups)
            .where(eq(groups.slug, groupSlug))
            .limit(1);
          if (groupResult[0]) {
            await db
              .insert(userGroups)
              .values({ userId, groupId: groupResult[0].id });
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/users/[id] Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const userPermissions = (session.user as { permissions?: string[]; isMainAdmin?: boolean }).permissions ?? [];
    const isMainAdmin = (session.user as { isMainAdmin?: boolean }).isMainAdmin ?? false;

    if (!isMainAdmin && !hasPermission(userPermissions, PERMISSIONS.MANAGE_USERS)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id);
    const currentUserId = parseInt((session.user as { id: string }).id);

    if (userId === currentUserId) {
      return NextResponse.json({ error: "Du kannst dich nicht selbst löschen" }, { status: 400 });
    }

    await db.delete(users).where(eq(users.id, userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/users/[id] Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}
