/**
 * FranksFotos – Datenbankverbindungs-Test
 * Ausführen mit: node scripts/test-db.mjs
 */

import { readFileSync } from "fs";
import { createConnection } from "mysql2/promise";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// .env.local manuell laden (ohne dotenv-Paket)
function loadEnv() {
  const envPath = resolve(__dirname, "../.env.local");
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      // Anführungszeichen entfernen
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
    console.log("✅ .env.local geladen\n");
  } catch {
    console.error("❌ .env.local nicht gefunden!\n");
    process.exit(1);
  }
}

async function testConnection() {
  loadEnv();

  const host = process.env.DATABASE_HOST;
  const port = parseInt(process.env.DATABASE_PORT || "3306");
  const user = process.env.DATABASE_USER;
  const password = process.env.DATABASE_PASSWORD;
  const database = process.env.DATABASE_NAME;

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  FranksFotos – Datenbankverbindungs-Test");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Host:     ${host}`);
  console.log(`  Port:     ${port}`);
  console.log(`  Benutzer: ${user}`);
  console.log(`  Datenbank: ${database}`);
  console.log(`  Passwort: ${"*".repeat((password || "").length)}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  let conn;
  try {
    console.log("🔄 Verbinde zur Datenbank...");
    conn = await createConnection({ host, port, user, password, database, connectTimeout: 10000 });

    // Ping
    await conn.ping();
    console.log("✅ Verbindung erfolgreich!\n");

    // Server-Version
    const [[versionRow]] = await conn.execute("SELECT VERSION() as v");
    console.log(`   Server-Version: ${versionRow.v}`);

    // Aktuelle DB
    const [[dbRow]] = await conn.execute("SELECT DATABASE() as d");
    console.log(`   Aktive DB:      ${dbRow.d}`);

    // Tabellen auflisten
    const [tables] = await conn.execute("SHOW TABLES");
    console.log(`\n   Tabellen in '${database}' (${tables.length} gefunden):`);
    for (const row of tables) {
      const tableName = Object.values(row)[0];
      console.log(`     • ${tableName}`);
    }

    // Users-Tabelle prüfen
    try {
      const [[countRow]] = await conn.execute("SELECT COUNT(*) as c FROM users");
      console.log(`\n   Benutzer in 'users': ${countRow.c}`);
      if (countRow.c === 0) {
        console.log("   ⚠️  Keine Benutzer vorhanden – führe zuerst den Seed aus!");
      }
    } catch {
      console.log("\n   ⚠️  Tabelle 'users' existiert noch nicht – führe 'npm run db:push' aus!");
    }

    console.log("\n✅ Test abgeschlossen – Datenbank ist erreichbar!\n");

  } catch (err) {
    console.error("\n❌ Verbindungsfehler!\n");

    if (err.code === "ER_ACCESS_DENIED_ERROR") {
      console.error("   → ZUGRIFF VERWEIGERT (falscher Benutzer/Passwort oder IP nicht erlaubt)");
      console.error(`   → Fehlermeldung: ${err.sqlMessage}`);
      console.error("\n   Lösung: Im Hosting-Panel 'Remote MySQL' aktivieren oder:");
      console.error(`   GRANT ALL ON ${database}.* TO '${user}'@'%' IDENTIFIED BY '...';\n`);

    } else if (err.code === "ETIMEDOUT" || err.code === "ECONNREFUSED") {
      console.error(`   → NETZWERKFEHLER (${err.code}): ${host}:${port} nicht erreichbar`);
      console.error("\n   Mögliche Ursachen:");
      console.error("   1. Port 3306 durch Firewall blockiert");
      console.error("   2. MySQL/MariaDB läuft nicht auf dem Server");
      console.error("   3. Falsche HOST-Adresse in .env.local");
      console.error("\n   Lösung: SSH-Tunnel verwenden:");
      console.error(`   ssh -L 3307:localhost:3306 user@${host} -N`);
      console.error("   Dann DATABASE_URL auf localhost:3307 ändern\n");

    } else if (err.code === "ENOTFOUND") {
      console.error(`   → HOSTNAME NICHT GEFUNDEN: '${host}'`);
      console.error("   → Bitte HOST in .env.local prüfen\n");

    } else {
      console.error(`   → Fehlercode: ${err.code}`);
      console.error(`   → Meldung:    ${err.message}\n`);
    }

    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

testConnection();
