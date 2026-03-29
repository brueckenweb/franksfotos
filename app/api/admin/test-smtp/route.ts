import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/auth/permissions";
import nodemailer from "nodemailer";

export async function GET() {
  // Nur für Admins
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
  }
  const isMainAdmin = !!(session.user as { isMainAdmin?: boolean }).isMainAdmin;
  const userPermissions = (session.user as { permissions?: string[] }).permissions ?? [];
  if (!isAdmin(userPermissions, isMainAdmin)) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const config = {
    host: process.env.EMAIL_HOST || "(nicht gesetzt)",
    port: Number(process.env.EMAIL_PORT) || 587,
    user: process.env.EMAIL_USER || "(nicht gesetzt)",
    passSet: !!(process.env.EMAIL_PASS),
    from: process.env.EMAIL_FROM || "(nicht gesetzt)",
    adminEmail: process.env.ADMIN_EMAIL || "(nicht gesetzt)",
  };

  // Versuche Verbindung zu verifizieren
  const results: Record<string, unknown> = { config };

  // Test 1: Standard (AUTH LOGIN)
  try {
    const transporter1 = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: false,
      authMethod: "LOGIN",
      auth: {
        user: process.env.EMAIL_USER || "",
        pass: process.env.EMAIL_PASS || "",
      },
      tls: { rejectUnauthorized: false },
    } as Parameters<typeof nodemailer.createTransport>[0]);

    await transporter1.verify();
    results["test_login_587"] = "✅ AUTH LOGIN Port 587 erfolgreich";
  } catch (e) {
    results["test_login_587"] = `❌ AUTH LOGIN Port 587: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Test 2: Port 465 (SSL)
  try {
    const transporter2 = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER || "",
        pass: process.env.EMAIL_PASS || "",
      },
      tls: { rejectUnauthorized: false },
    } as Parameters<typeof nodemailer.createTransport>[0]);

    await transporter2.verify();
    results["test_ssl_465"] = "✅ SSL Port 465 erfolgreich";
  } catch (e) {
    results["test_ssl_465"] = `❌ SSL Port 465: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Test 3: AUTH PLAIN Port 587
  try {
    const transporter3 = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: false,
      authMethod: "PLAIN",
      auth: {
        user: process.env.EMAIL_USER || "",
        pass: process.env.EMAIL_PASS || "",
      },
      tls: { rejectUnauthorized: false },
    } as Parameters<typeof nodemailer.createTransport>[0]);

    await transporter3.verify();
    results["test_plain_587"] = "✅ AUTH PLAIN Port 587 erfolgreich";
  } catch (e) {
    results["test_plain_587"] = `❌ AUTH PLAIN Port 587: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json(results, { status: 200 });
}
