/**
 * FranksFotos – Next.js Proxy (Middleware)
 * Läuft im Edge Runtime – darf KEINE Node.js-Module verwenden!
 * Verwendet die leichte edge-kompatible Auth-Konfiguration.
 */

import NextAuth from "next-auth";
import { edgeAuthConfig } from "@/lib/auth/edge-config";

const { auth } = NextAuth(edgeAuthConfig);

export default auth;

export const config = {
  matcher: [
    /*
     * Auf alle Routen anwenden außer:
     * - _next/static (statische Dateien)
     * - _next/image (Bildoptimierung)
     * - favicon.ico
     * - public Ordner
     * - /api/upload (große Datei-Uploads – Auth wird in der Route selbst geprüft)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api/upload).*)",
  ],
};
