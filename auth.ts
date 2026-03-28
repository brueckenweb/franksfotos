/**
 * FranksFotos – NextAuth.js v5 Instanz
 * Kombiniert Edge-Config (für proxy.ts) mit vollem Auth-Config (für Server-Komponenten)
 */

import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/config";

// Vollständige Auth-Instanz (mit DB, bcrypt) – nur für Server-Komponenten & API-Routen
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
