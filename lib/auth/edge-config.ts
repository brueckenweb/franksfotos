/**
 * FranksFotos – Edge-kompatible NextAuth-Konfiguration
 * WICHTIG: Diese Datei darf KEINE Node.js-Module importieren (kein mysql2, bcryptjs etc.)
 * Sie wird im Edge Runtime (middleware.ts) verwendet.
 */

import type { NextAuthConfig } from "next-auth";

export const edgeAuthConfig: NextAuthConfig = {
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

      if (isAdminPage && !isLoggedIn) {
        return false; // Redirect zu /login erfolgt automatisch durch NextAuth
      }

      return true;
    },
  },
  providers: [], // Keine Provider hier – keine DB-Imports!
};
