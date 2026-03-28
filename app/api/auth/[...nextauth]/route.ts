/**
 * FranksFotos – NextAuth.js v5 Route Handler
 * Stellt alle Auth-Endpunkte bereit:
 *   GET/POST /api/auth/signin
 *   GET/POST /api/auth/signout
 *   GET      /api/auth/session
 *   GET      /api/auth/csrf
 *   GET      /api/auth/providers
 */

import { handlers } from "@/auth";

export const { GET, POST } = handlers;
