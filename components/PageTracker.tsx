"use client";

/**
 * PageTracker – unsichtbare Client-Komponente
 * Registriert jeden Seitenaufruf via POST /api/page-views.
 * Admin- und API-Pfade werden serverseitig herausgefiltert.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function PageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Admin-Bereich und API-Routen nicht tracken
    if (pathname.startsWith("/admin") || pathname.startsWith("/api")) return;

    fetch("/api/page-views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
    }).catch(() => {
      // Stille Fehlerbehandlung – Tracking darf die UX nicht stören
    });
  }, [pathname]);

  return null;
}
