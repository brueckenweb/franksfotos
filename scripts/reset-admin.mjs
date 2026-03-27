/**
 * FranksFotos – Admin-Passwort zurücksetzen
 * Ausführen mit: node scripts/reset-admin.mjs
 *
 * Setzt das Passwort des Hauptadmins auf einen neuen Wert.
 * Das neue Passwort wird als Argument übergeben:
 *   node scripts/reset-admin.mjs MeinNeuesPasswort123
 */

import { readFileSync } from "fs";
import { createConnection } from "mysql2/promise";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash, randomBytes } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Einfaches bcrypt-Äquivalent via Node.js crypto ist nicht verfügbar –
// wir nutzen das bereits installierte bcryptjs-Paket
async function hashPassword(password) {
  // Dynamischer Import für ESM-Kompatibilität
  const { default: bcrypt } = await import("../node_modules/bcryptjs/dist/bcrypt.js");
  return bcrypt.hash(password, 12);
}

function loadEnv() {
  const envPath = resolve(__dirname, "../.env.local");
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

async function resetAdmin() {
  loadEnv();

  // Neues Passwort aus Argument oder zufällig generieren
  const newPassword = process.argv[2] || null;

  if (!newPassword) {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  FranksFotos – Admin-Passwort zurücksetzen");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");
    console.log("  Verwendung:");
    console.log("    node scripts/reset-admin.mjs MeinNeuesPasswort");
    console.log("");
    console.log("  Beispiel:");
    console.log("    node scripts/reset-admin.mjs Admin1234!");
    console.log("");
    process.exit(0);
  }

  if (newPassword.length < 6) {
    console.error("❌ Passwort muss mindestens 6 Zeichen lang sein!");
    process.exit(1);
  }

  const conn = await createConnection({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || "3306"),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  FranksFotos – Admin-Passwort zurücksetzen");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Hauptadmin suchen
  const [admins] = await conn.execute(
    "SELECT id, email, name FROM users WHERE is_main_admin = 1 LIMIT 1"
  );

  if (admins.length === 0) {
    console.error("❌ Kein Hauptadmin in der Datenbank gefunden!");
    await conn.end();
    process.exit(1);
  }

  const admin = admins[0];
  console.log(`   Admin gefunden: ${admin.name} (${admin.email})\n`);
  console.log("   🔄 Hashing neues Passwort (bcrypt, cost=12)...");

  const { default: bcrypt } = await import("bcryptjs");
  const hash = await bcrypt.hash(newPassword, 12);

  await conn.execute(
    "UPDATE users SET password_hash = ? WHERE id = ?",
    [hash, admin.id]
  );

  console.log("   ✅ Passwort erfolgreich aktualisiert!\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`   E-Mail:   ${admin.email}`);
  console.log(`   Passwort: ${newPassword}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log("   → Starte den Dev-Server neu und melde dich an!");

  await conn.end();
}

resetAdmin().catch(console.error);
