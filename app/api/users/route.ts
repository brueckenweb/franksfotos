/**
 * FranksFotos – Users API
 * GET  /api/users – Alle Benutzer
 * POST /api/users – Neuen Benutzer anlegen
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, userGroups, groups } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import bcrypt from "bcryptjs";

export async function GET(request: NextRequest) {
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

    const allUsers = await db
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
      .orderBy(desc(users.createdAt));

    // Gruppen für jeden User laden
    const usersWithGroups = await Promise.all(
      allUsers.map(async (user) => {
        const userGroupResult = await db
          .select({ groupSlug: groups.slug, groupName: groups.name })
          .from(userGroups)
          .innerJoin(groups, eq(userGroups.groupId, groups.id))
          .where(eq(userGroups.userId, user.id));
        return { ...user, groups: userGroupResult };
      })
    );

    return NextResponse.json({ users: usersWithGroups });
  } catch (error) {
    console.error("GET /api/users Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { email, name, password, groupSlugs, isActive } = body;

    if (!email || !name || !password) {
      return NextResponse.json(
        { error: "E-Mail, Name und Passwort sind erforderlich" },
        { status: 400 }
      );
    }

    // Prüfen ob E-Mail bereits vergeben
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing[0]) {
      return NextResponse.json({ error: "E-Mail ist bereits vergeben" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [inserted] = await db
      .insert(users)
      .values({
        email,
        name,
        passwordHash,
        isActive: isActive ?? true,
        isMainAdmin: false,
      })
      .$returningId();

    const userId = inserted.id;

    // Gruppen zuweisen
    if (groupSlugs && Array.isArray(groupSlugs) && groupSlugs.length > 0) {
      for (const groupSlug of groupSlugs) {
        const groupResult = await db
          .select({ id: groups.id })
          .from(groups)
          .where(eq(groups.slug, groupSlug))
          .limit(1);
        if (groupResult[0]) {
          await db
            .insert(userGroups)
            .values({ userId, groupId: groupResult[0].id })
            .onDuplicateKeyUpdate({ set: { userId, groupId: groupResult[0].id } });
        }
      }
    }

    return NextResponse.json({ success: true, userId });
  } catch (error) {
    console.error("POST /api/users Fehler:", error);
    return NextResponse.json({ error: "Interner Server-Fehler" }, { status: 500 });
  }
}
