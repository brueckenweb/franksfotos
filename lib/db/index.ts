/**
 * FranksFotos – Datenbankverbindung (Drizzle ORM + MariaDB/MySQL2)
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

// Singleton-Pattern für Datenbankverbindung (wichtig für Next.js Hot Reload)
declare global {
  // eslint-disable-next-line no-var
  var dbPool: mysql.Pool | undefined;
}

function createPool(): mysql.Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL ist nicht in .env.local definiert");
  }

  return mysql.createPool({
    uri: databaseUrl,
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0,
  });
}

// In Entwicklung den Pool im globalen Scope cachen (verhindert Verbindungsüberflutung)
const pool = global.dbPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  global.dbPool = pool;
}

export const db = drizzle(pool, { schema, mode: "default" });

export type Database = typeof db;

// Helper: Verbindung testen
export async function testConnection(): Promise<boolean> {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    return true;
  } catch {
    return false;
  }
}
