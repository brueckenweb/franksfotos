/**
 * FranksFotos – NextAuth.js v5 Konfiguration
 * Credentials-basierte Authentifizierung mit eigenem User-Management
 */

import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users, userGroups, groups, userPermissions, groupPermissions, permissions } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

export const authConfig: NextAuthConfig = {
  // Pflicht bei Betrieb hinter einem Reverse-Proxy (Apache, Nginx, etc.)
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAdminPage = nextUrl.pathname.startsWith("/admin");

      if (isAdminPage) {
        if (!isLoggedIn) return false;
        // Admin-Check erfolgt in der Middleware
        return true;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isMainAdmin = (user as { isMainAdmin?: boolean }).isMainAdmin;
        token.groups = (user as { groups?: string[] }).groups;
        token.permissions = (user as { permissions?: string[] }).permissions;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.isMainAdmin = token.isMainAdmin as boolean;
        session.user.groups = token.groups as string[];
        session.user.permissions = token.permissions as string[];
      }
      return session;
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // User aus der Datenbank laden
          const userResult = await db
            .select()
            .from(users)
            .where(eq(users.email, credentials.email as string))
            .limit(1);

          const user = userResult[0];
          if (!user || !user.isActive) return null;

          // Passwort prüfen
          const passwordValid = await bcrypt.compare(
            credentials.password as string,
            user.passwordHash
          );
          if (!passwordValid) return null;

          // Gruppen laden
          const userGroupResult = await db
            .select({ groupSlug: groups.slug })
            .from(userGroups)
            .innerJoin(groups, eq(userGroups.groupId, groups.id))
            .where(eq(userGroups.userId, user.id));

          const userGroupSlugs = userGroupResult.map((g) => g.groupSlug);

          // Gruppenrechte laden
          const groupIds = await db
            .select({ id: groups.id })
            .from(groups)
            .where(inArray(groups.slug, userGroupSlugs.length > 0 ? userGroupSlugs : ["__none__"]));

          const groupPermResult = await db
            .select({ permName: permissions.name })
            .from(groupPermissions)
            .innerJoin(permissions, eq(groupPermissions.permissionId, permissions.id))
            .where(
              inArray(
                groupPermissions.groupId,
                groupIds.map((g) => g.id).length > 0
                  ? groupIds.map((g) => g.id)
                  : [-1]
              )
            );

          const groupPerms = new Set(groupPermResult.map((p) => p.permName));

          // Individuelle User-Rechte laden (Overrides)
          const userPermResult = await db
            .select({
              permName: permissions.name,
              isGranted: userPermissions.isGranted,
            })
            .from(userPermissions)
            .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
            .where(eq(userPermissions.userId, user.id));

          // Rechte zusammenführen: Individuelle Overrides haben Vorrang
          for (const up of userPermResult) {
            if (up.isGranted) {
              groupPerms.add(up.permName);
            } else {
              groupPerms.delete(up.permName);
            }
          }

          // Hauptadmin hat alle Rechte
          const finalPermissions = user.isMainAdmin
            ? ["*"]
            : Array.from(groupPerms);

          return {
            id: String(user.id),
            email: user.email,
            name: user.name,
            image: user.avatar,
            isMainAdmin: user.isMainAdmin,
            groups: userGroupSlugs,
            permissions: finalPermissions,
          };
        } catch (error) {
          // Detaillierte Fehlerausgabe für die Entwicklung
          if (error instanceof Error) {
            const cause = (error as { cause?: { code?: string; sqlMessage?: string } }).cause;
            if (cause?.code === "ER_ACCESS_DENIED_ERROR") {
              console.error(
                "❌ Auth-Fehler: Datenbankzugriff verweigert!\n" +
                "   Der DB-Benutzer hat keine Verbindungsrechte von dieser IP.\n" +
                "   Lösung: GRANT ALL PRIVILEGES ON franksellke.* TO 'fotodatenbank'@'%' IDENTIFIED BY '...';\n" +
                "   Details:", cause.sqlMessage
              );
            } else {
              console.error("❌ Auth-Fehler:", error.message, cause ?? "");
            }
          } else {
            console.error("❌ Auth-Fehler (unbekannt):", error);
          }
          return null;
        }
      },
    }),
  ],
};
