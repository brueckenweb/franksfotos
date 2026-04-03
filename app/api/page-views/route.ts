/**
 * POST /api/page-views
 * Erfasst einen Seitenaufruf in der page_views Tabelle.
 * Wird vom Client-seitigen PageTracker aufgerufen.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pageViews } from "@/lib/db/schema";
import { auth } from "@/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path } = body as { path?: string };

    if (!path || typeof path !== "string") {
      return NextResponse.json({ ok: false, error: "Ungültiger Pfad" }, { status: 400 });
    }

    // Admin-Bereich und API-Routen nicht tracken (Doppel-Absicherung)
    if (path.startsWith("/admin") || path.startsWith("/api")) {
      return NextResponse.json({ ok: true });
    }

    // Eingeloggten Benutzer ermitteln (optional)
    const session = await auth();
    const rawId = (session?.user as { id?: string | number })?.id;
    const userId = rawId ? parseInt(String(rawId), 10) : null;

    // IP-Adresse ermitteln (Proxy-Header zuerst)
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    const userAgent = (request.headers.get("user-agent") ?? "").substring(0, 500);

    await db.insert(pageViews).values({
      path: path.substring(0, 1000),
      userId: userId && !isNaN(userId) ? userId : null,
      ipAddress: ipAddress.substring(0, 45),
      userAgent,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Stille Fehlerbehandlung – Tracking-Fehler dürfen die Seite nicht blockieren
    console.error("[PageView Tracking]", error);
    return NextResponse.json({ ok: true });
  }
}
