/**
 * Zweite Datenbankverbindung zur Brückendatenbank (brueckenweb)
 * Lesend: Umkreissuche in der Fotodatenbank-Eingabe
 * Schreibend: bilder-Tabelle – neuer Datensatz bei BAS-Eintrag (aktiv = wartend)
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

declare global {
  // eslint-disable-next-line no-var
  var brueckenPool: mysql.Pool | undefined;
}

function createBrueckenPool(): mysql.Pool {
  const host = process.env.BRUECKEN_DATABASE_HOST;
  const port = parseInt(process.env.BRUECKEN_DATABASE_PORT || "3306");
  const user = process.env.BRUECKEN_DATABASE_USER;
  const password = process.env.BRUECKEN_DATABASE_PASSWORD;
  const database = process.env.BRUECKEN_DATABASE_NAME;

  if (!host || !user || !password || !database) {
    throw new Error(
      "BRUECKEN_DATABASE_* Umgebungsvariablen sind nicht gesetzt"
    );
  }

  return mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    connectionLimit: 5,
    waitForConnections: true,
    queueLimit: 0,
    connectTimeout: 10_000,
  });
}

const pool = global.brueckenPool ?? createBrueckenPool();

if (process.env.NODE_ENV !== "production") {
  global.brueckenPool = pool;
}

export const brueckenDb = drizzle(pool, { mode: "default" });
