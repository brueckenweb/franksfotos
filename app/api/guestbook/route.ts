import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { guestbookEntries, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";

// GET /api/guestbook – alle Einträge (neueste zuerst)
export async function GET() {
  try {
    const entries = await db
      .select({
        id:        guestbookEntries.id,
        message:   guestbookEntries.message,
        createdAt: guestbookEntries.createdAt,
        userName:  users.name,
        userId:    users.id,
      })
      .from(guestbookEntries)
      .innerJoin(users, eq(guestbookEntries.userId, users.id))
      .orderBy(desc(guestbookEntries.createdAt))
      .limit(100);

    return NextResponse.json(entries);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/guestbook – neuen Eintrag anlegen (nur für eingeloggte User)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  try {
    const body = await req.json() as { message?: string };
    const message = (body.message ?? "").trim();
    if (!message || message.length < 2) {
      return NextResponse.json({ error: "Nachricht zu kurz" }, { status: 400 });
    }
    if (message.length > 1000) {
      return NextResponse.json({ error: "Nachricht zu lang (max. 1000 Zeichen)" }, { status: 400 });
    }

    const rawId = (session.user as { id?: string | number }).id;
    const userId = rawId ? Number(rawId) : null;
    if (!userId) return NextResponse.json({ error: "User-ID fehlt" }, { status: 400 });

    await db.insert(guestbookEntries).values({ userId, message });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
