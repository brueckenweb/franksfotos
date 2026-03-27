/**
 * FranksFotos – Benutzer-Check Script
 * Ausführen mit: node scripts/check-user.mjs
 */

import { readFileSync } from "fs";
import { createConnection } from "mysql2/promise";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

async function checkUsers() {
  loadEnv();

  const conn = await createConnection({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || "3306"),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  FranksFotos – Benutzer-Check");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Alle Benutzer anzeigen
  const [rows] = await conn.execute(
    "SELECT id, email, name, is_active, is_main_admin, LEFT(password_hash, 7) as hash_prefix, LENGTH(password_hash) as hash_len FROM users"
  );

  if (rows.length === 0) {
    console.log("❌ Keine Benutzer in der Datenbank!\n");
    console.log("   Führe den Seed aus: npm run db:seed\n");
  } else {
    console.log(`   ${rows.length} Benutzer gefunden:\n`);
    for (const u of rows) {
      console.log(`   ID:          ${u.id}`);
      console.log(`   E-Mail:      ${u.email}`);
      console.log(`   Name:        ${u.name}`);
      console.log(`   Aktiv:       ${u.is_active ? "✅ Ja" : "❌ NEIN (Login gesperrt!)"}`);
      console.log(`   Hauptadmin:  ${u.is_main_admin ? "✅ Ja" : "Nein"}`);
      console.log(`   Hash-Prefix: ${u.hash_prefix}... (${u.hash_len} Zeichen)`);

      if (!u.hash_prefix.startsWith("$2")) {
        console.log(`   ⚠️  Hash sieht KEIN bcrypt-Hash aus! (muss mit '$2b$' beginnen)`);
      } else {
        console.log(`   Hash-Format: ✅ bcrypt`);
      }
      console.log("");
    }
  }

  await conn.end();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Um das Admin-Passwort zurückzusetzen:");
  console.log("  node scripts/reset-admin.mjs");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

checkUsers().catch(console.error);
