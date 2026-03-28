/**
 * NextAuth.js v5 – Typen-Erweiterung für FranksFotos
 * Fügt benutzerdefinierte Felder zur Session und zum JWT hinzu
 */

import type { DefaultSession, DefaultUser } from "next-auth";
import type { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isMainAdmin: boolean;
      groups: string[];
      permissions: string[];
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    isMainAdmin?: boolean;
    groups?: string[];
    permissions?: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    isMainAdmin?: boolean;
    groups?: string[];
    permissions?: string[];
  }
}
