/**
 * FranksFotos – Migration: password_reset_tokens Tabelle anlegen
 * Ausführen mit: node scripts/migrate-password-reset-tokens.mjs
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
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
    console.log("✅ .env.local geladen\n");
  } catch {
    console.error("❌ .env.local nicht gefunden!");
    process.exit(1);
  }
}

async function migrate() {
  loadEnv();

  const host     = process.env.DATABASE_HOST;
  const port     = parseInt(process.env.DATABASE_PORT || "3306");
  const user     = process.env.DATABASE_USER;
  const password = process.env.DATABASE_PASSWORD;
  const database = process.env.DATABASE_NAME;

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  FranksFotos – Migration: password_reset_tokens");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Host:      ${host}:${port}`);
  console.log(`  Datenbank: ${database}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  let conn;
  try {
    console.log("🔄 Verbinde zur Datenbank...");
    conn = await createConnection({ host, port, user, password, database, connectTimeout: 10000 });
    console.log("✅ Verbunden!\n");

    const sql = `
      CREATE TABLE IF NOT EXISTS \`password_reset_tokens\` (
        \`id\`         INT           NOT NULL AUTO_INCREMENT,
        \`user_id\`    INT           NOT NULL,
        \`token\`      VARCHAR(255)  NOT NULL,
        \`expires_at\` TIMESTAMP     NOT NULL,
        \`used_at\`    TIMESTAMP     NULL DEFAULT NULL,
        \`created_at\` TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`prt_token_idx\` (\`token\`),
        KEY \`prt_user_idx\` (\`user_id\`),
        KEY \`prt_expires_idx\` (\`expires_at\`),
        CONSTRAINT \`prt_user_fk\`
          FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    console.log("🔄 Führe CREATE TABLE aus...");
    await conn.execute(sql);
    console.log("✅ Tabelle 'password_reset_tokens' erfolgreich angelegt (oder bereits vorhanden)!\n");

    // Prüfen ob Tabelle existiert
    const [rows] = await conn.execute("SHOW TABLES LIKE 'password_reset_tokens'");
    if (rows.length > 0) {
      console.log("✅ Tabelle ist in der Datenbank vorhanden.\n");

      // Spalten anzeigen
      const [cols] = await conn.execute("DESCRIBE password_reset_tokens");
      console.log("   Spalten:");
      for (const col of cols) {
        console.log(`     • ${col.Field.padEnd(12)} ${col.Type}`);
      }
    }

    console.log("\n✅ Migration abgeschlossen!\n");
  } catch (err) {
    console.error("\n❌ Fehler bei der Migration!\n");
    console.error(`   Code:    ${err.code}`);
    console.error(`   Meldung: ${err.message}\n`);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

migrate();
