/**
 * GET /api/admin/page-views-stats
 * Liefert Zugriffsstatistiken für das Admin-Dashboard.
 * Nur für isMainAdmin zugänglich.
 *
 * Query-Parameter:
 *   days=30  → Zeitraum in Tagen (default: 30)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pageViews, users } from "@/lib/db/schema";
import { auth } from "@/auth";
import { count, countDistinct, desc, max, eq, gte, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const isMainAdmin = (session?.user as { isMainAdmin?: boolean })?.isMainAdmin;

    if (!session?.user || !isMainAdmin) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = Math.min(Math.max(parseInt(searchParams.get("days") ?? "30", 10), 1), 365);

    const since = new Date();
    since.setDate(since.getDate() - days);

    // ── Gesamt-Statistiken (All-Time) ───────────────────────────────────────
    const [{ totalViews }] = await db
      .select({ totalViews: count() })
      .from(pageViews);

    const [{ uniqueVisitors }] = await db
      .select({ uniqueVisitors: countDistinct(pageViews.ipAddress) })
      .from(pageViews);

    // ── Statistiken im gewählten Zeitraum ───────────────────────────────────
    const [{ periodViews }] = await db
      .select({ periodViews: count() })
      .from(pageViews)
      .where(gte(pageViews.createdAt, since));

    const [{ periodVisitors }] = await db
      .select({ periodVisitors: countDistinct(pageViews.ipAddress) })
      .from(pageViews)
      .where(gte(pageViews.createdAt, since));

    // ── Benutzer-Besuche (All-Time, eingeloggte User) ───────────────────────
    const userVisits = await db
      .select({
        userId:    users.id,
        name:      users.name,
        email:     users.email,
        visits:    count(pageViews.id),
        lastVisit: max(pageViews.createdAt),
      })
      .from(pageViews)
      .innerJoin(users, eq(pageViews.userId, users.id))
      .groupBy(users.id, users.name, users.email)
      .orderBy(desc(count(pageViews.id)))
      .limit(50);

    // ── Top-Seiten im gewählten Zeitraum ────────────────────────────────────
    const topPages = await db
      .select({
        path:           pageViews.path,
        views:          count(),
        uniqueVisitors: countDistinct(pageViews.ipAddress),
      })
      .from(pageViews)
      .where(gte(pageViews.createdAt, since))
      .groupBy(pageViews.path)
      .orderBy(desc(count()))
      .limit(15);

    // ── Letzte Einzelaufrufe ─────────────────────────────────────────────────
    const recentVisits = await db
      .select({
        id:        pageViews.id,
        path:      pageViews.path,
        ipAddress: pageViews.ipAddress,
        userName:  users.name,
        userEmail: users.email,
        createdAt: pageViews.createdAt,
      })
      .from(pageViews)
      .leftJoin(users, eq(pageViews.userId, users.id))
      .orderBy(desc(pageViews.createdAt))
      .limit(25);

    // ── Tägl. Aufrufe der letzten 30 Tage (für Mini-Chart) ─────────────────
    const dailyStats = await db
      .select({
        day:   sql<string>`DATE(${pageViews.createdAt})`,
        views: count(),
      })
      .from(pageViews)
      .where(gte(pageViews.createdAt, since))
      .groupBy(sql`DATE(${pageViews.createdAt})`)
      .orderBy(sql`DATE(${pageViews.createdAt})`);

    return NextResponse.json({
      totalViews,
      uniqueVisitors,
      periodViews,
      periodVisitors,
      days,
      userVisits,
      topPages,
      recentVisits,
      dailyStats,
    });
  } catch (error) {
    console.error("[PageViewsStats]", error);
    return NextResponse.json(
      { error: "Statistiken konnten nicht geladen werden" },
      { status: 500 }
    );
  }
}
