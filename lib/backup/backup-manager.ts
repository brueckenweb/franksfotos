import { promises as fs } from "fs";
import path from "path";
import { createGzip } from "zlib";
import { pipeline } from "stream";
import { promisify as streamPromisify } from "util";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

const pipelineAsync = streamPromisify(pipeline);

interface BackupInfo {
  id: string;
  filename: string;
  created_at: string;
  size: number;
  status: "completed" | "failed" | "running";
  tables_count?: number;
}

interface BackupStatus {
  isRunning: boolean;
  progress?: number;
  currentTable?: string;
  error?: string;
}

export class BackupManager {
  private backupDir: string;
  private currentBackupStatus: BackupStatus = { isRunning: false };
  private statusFile: string;

  constructor() {
    this.backupDir = path.join(process.cwd(), "backups");
    this.statusFile = path.join(this.backupDir, "backup-status.json");
    this.ensureBackupDirectory();
  }

  private async ensureBackupDirectory() {
    try {
      await fs.access(this.backupDir);
    } catch {
      await fs.mkdir(this.backupDir, { recursive: true });
    }
  }

  async saveStatus(status: BackupStatus) {
    this.currentBackupStatus = status;
    try {
      await fs.writeFile(this.statusFile, JSON.stringify(status, null, 2));
    } catch (error) {
      console.error("Fehler beim Speichern des Status:", error);
    }
  }

  private async loadStatus(): Promise<BackupStatus> {
    try {
      const statusData = await fs.readFile(this.statusFile, "utf-8");
      return JSON.parse(statusData);
    } catch {
      return { isRunning: false };
    }
  }

  private generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getDatabaseConfig() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL nicht konfiguriert");
    }
    // Parse MySQL URL: mysql://user:password@host:port/database
    const url = new URL(databaseUrl);
    return {
      host: url.hostname,
      port: url.port || "3306",
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1), // Remove leading slash
    };
  }

  private async getTableCount(): Promise<number> {
    try {
      const dbConfig = await this.getDatabaseConfig();
      const result = await db.execute(
        sql`SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ${dbConfig.database} AND table_type = 'BASE TABLE'`
      );
      return (result as any)[0]?.count || 0;
    } catch (error) {
      console.error("Fehler beim Ermitteln der Tabellenzahl:", error);
      return 0;
    }
  }

  private async createSQLDump(outputPath: string): Promise<void> {
    console.log("🔄 Starte Drizzle-basiertes Backup (KEIN mysqldump!)");

    const dbConfig = await this.getDatabaseConfig();

    let sqlContent = "";

    // Header
    sqlContent += `-- MySQL dump created by FranksFotos Backup Manager (Pure Drizzle Implementation)\n`;
    sqlContent += `-- Host: ${dbConfig.host}    Database: ${dbConfig.database}\n`;
    sqlContent += `-- ------------------------------------------------------\n`;
    sqlContent += `-- Server version\t${new Date().toISOString()}\n\n`;

    sqlContent += `/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;\n`;
    sqlContent += `/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;\n`;
    sqlContent += `/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;\n`;
    sqlContent += `/*!40101 SET NAMES utf8mb4 */;\n`;
    sqlContent += `/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;\n`;
    sqlContent += `/*!40103 SET TIME_ZONE='+00:00' */;\n`;
    sqlContent += `/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;\n`;
    sqlContent += `/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;\n`;
    sqlContent += `/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;\n`;
    sqlContent += `/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;\n\n`;

    try {
      console.log("📋 Lade Tabellenliste...");

      let foundTableNames: string[] = [];

      // Methode 1: SHOW TABLES
      try {
        console.log("🔍 Versuche SHOW TABLES...");
        const tables = await db.execute(sql`SHOW TABLES`);
        const tableList = tables as any[];

        foundTableNames = tableList
          .map((row) => {
            return (
              row[`Tables_in_${dbConfig.database}`] ||
              row.table_name ||
              row.TABLE_NAME ||
              Object.values(row)[0]
            );
          })
          .filter((name) => name && typeof name === "string");

        console.log(
          `✅ Gefundene Tabellen via SHOW TABLES: ${foundTableNames.length}`,
          foundTableNames
        );
      } catch (showTablesError) {
        console.warn("⚠️ SHOW TABLES fehlgeschlagen:", showTablesError);
      }

      // Methode 2: information_schema.tables (Fallback)
      if (foundTableNames.length === 0) {
        try {
          console.log("🔍 Versuche information_schema.tables...");
          const infoTables = await db.execute(
            sql`SELECT table_name FROM information_schema.tables WHERE table_schema = ${dbConfig.database} AND table_type = 'BASE TABLE'`
          );
          const infoTableList = infoTables as any[];

          let tableRows = infoTableList;
          if (
            Array.isArray(infoTableList[0]) &&
            infoTableList[0].length > 0
          ) {
            tableRows = infoTableList[0];
          }

          foundTableNames = tableRows
            .map((row: any) => row.table_name || row.TABLE_NAME)
            .filter((name: string) => name);

          console.log(
            `✅ Gefundene Tabellen via information_schema: ${foundTableNames.length}`,
            foundTableNames
          );
        } catch (infoError) {
          console.warn(
            "⚠️ information_schema.tables fehlgeschlagen:",
            infoError
          );
        }
      }

      if (foundTableNames.length === 0) {
        throw new Error(
          "Keine Tabellen gefunden! Überprüfen Sie die Datenbankverbindung und Berechtigungen."
        );
      }

      console.log(
        `📋 ${foundTableNames.length} Tabellen werden exportiert`
      );

      let processedTables = 0;
      for (const tableName of foundTableNames) {
        console.log(`🔄 Verarbeite Tabelle: ${tableName}`);

        if (!tableName || typeof tableName !== "string") {
          console.error("❌ Ungültiger Tabellenname:", tableName);
          continue;
        }

        await this.saveStatus({
          isRunning: true,
          progress:
            30 + (processedTables / foundTableNames.length) * 60,
          currentTable: `Exportiere Tabelle: ${tableName}`,
        });

        try {
          // CREATE TABLE Statement
          const createResult = await db.execute(
            sql.raw(`SHOW CREATE TABLE \`${tableName}\``)
          );

          let createRow = null;
          if (Array.isArray(createResult) && createResult.length > 0) {
            if (
              Array.isArray(createResult[0]) &&
              createResult[0].length > 0
            ) {
              createRow = createResult[0][0];
            } else {
              createRow = createResult[0];
            }
          }

          let createStatement = null;
          if (createRow) {
            createStatement =
              createRow["Create Table"] ||
              createRow["CREATE TABLE"] ||
              createRow["create_table"] ||
              createRow["createTable"];
          }

          if (!createStatement) {
            console.error(
              `❌ Kein CREATE TABLE Statement für Tabelle ${tableName} gefunden`
            );
            continue;
          }

          sqlContent += `--\n-- Table structure for table \`${tableName}\`\n--\n\n`;
          sqlContent += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
          sqlContent += `/*!40101 SET @saved_cs_client     = @@character_set_client */;\n`;
          sqlContent += `/*!40101 SET character_set_client = utf8 */;\n`;
          sqlContent += `${createStatement};\n`;
          sqlContent += `/*!40101 SET character_set_client = @saved_cs_client */;\n\n`;

          // Daten exportieren
          const rows = await db.execute(
            sql.raw(`SELECT * FROM \`${tableName}\``)
          );

          let dataRows: any[] = [];
          if (Array.isArray(rows) && rows.length > 0) {
            if (Array.isArray(rows[0]) && rows[0].length > 0) {
              dataRows = rows[0];
            } else {
              dataRows = rows as any[];
            }
          }

          console.log(
            `📊 Tabelle ${tableName}: ${dataRows.length} Zeilen gefunden`
          );

          if (dataRows.length > 0) {
            sqlContent += `--\n-- Dumping data for table \`${tableName}\`\n--\n\n`;
            sqlContent += `LOCK TABLES \`${tableName}\` WRITE;\n`;
            sqlContent += `/*!40000 ALTER TABLE \`${tableName}\` DISABLE KEYS */;\n`;

            const batchSize = 100;
            for (let i = 0; i < dataRows.length; i += batchSize) {
              const batch = dataRows.slice(i, i + batchSize);
              const values = batch.map((row) => {
                const rowValues = Object.values(row).map((value) => {
                  if (value === null || value === undefined) return "NULL";
                  if (typeof value === "string") {
                    const escaped = value
                      .replace(/\\/g, "\\\\")
                      .replace(/'/g, "\\'")
                      .replace(/"/g, '\\"')
                      .replace(/\n/g, "\\n")
                      .replace(/\r/g, "\\r")
                      .replace(/\t/g, "\\t")
                      .replace(/\0/g, "\\0");
                    return `'${escaped}'`;
                  }
                  if (value instanceof Date)
                    return `'${value
                      .toISOString()
                      .slice(0, 19)
                      .replace("T", " ")}'`;
                  if (typeof value === "boolean")
                    return value ? "1" : "0";
                  if (typeof value === "number")
                    return value.toString();
                  if (Buffer.isBuffer(value))
                    return `'${value.toString("hex")}'`;
                  return `'${String(value)}'`;
                });
                return `(${rowValues.join(",")})`;
              });

              if (values.length > 0) {
                const columns = Object.keys(dataRows[0])
                  .map((col) => `\`${col}\``)
                  .join(",");
                sqlContent += `INSERT INTO \`${tableName}\` (${columns}) VALUES\n${values.join(
                  ",\n"
                )};\n`;
              }
            }

            sqlContent += `/*!40000 ALTER TABLE \`${tableName}\` ENABLE KEYS */;\n`;
            sqlContent += `UNLOCK TABLES;\n\n`;
          }
        } catch (tableError) {
          console.error(
            `❌ Fehler beim Exportieren der Tabelle ${tableName}:`,
            tableError
          );
          sqlContent += `-- Fehler beim Exportieren der Tabelle ${tableName}: ${tableError}\n\n`;
        }

        processedTables++;
      }

      // Footer
      sqlContent += `/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;\n`;
      sqlContent += `/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;\n`;
      sqlContent += `/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;\n`;
      sqlContent += `/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;\n`;
      sqlContent += `/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;\n`;
      sqlContent += `/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;\n`;
      sqlContent += `/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;\n`;
      sqlContent += `/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;\n`;

      console.log(`💾 Schreibe SQL-Datei: ${outputPath}`);
      await fs.writeFile(outputPath, sqlContent, "utf8");
      console.log("✅ SQL-Datei erfolgreich geschrieben");
    } catch (error) {
      console.error("❌ Fehler beim Erstellen des SQL-Dumps:", error);
      throw error;
    }
  }

  async startBackup(): Promise<void> {
    console.log("🚀 BackupManager.startBackup() aufgerufen");

    if (this.currentBackupStatus.isRunning) {
      throw new Error("Backup läuft bereits");
    }

    const backupId = this.generateBackupId();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `fotodatenbank_backup_${timestamp}.sql.gz`;
    const backupPath = path.join(this.backupDir, filename);
    const tempSqlPath = path.join(
      this.backupDir,
      `temp_${backupId}.sql`
    );

    try {
      await this.saveStatus({
        isRunning: true,
        progress: 0,
        currentTable: "Initialisierung...",
      });

      const tableCount = await this.getTableCount();

      await this.saveStatus({
        isRunning: true,
        progress: 10,
        currentTable: "Starte Backup...",
      });

      await this.createSQLDump(tempSqlPath);

      await this.saveStatus({
        isRunning: true,
        progress: 90,
        currentTable: "Komprimiere Backup...",
      });

      // Datei komprimieren
      const readStream = require("fs").createReadStream(tempSqlPath);
      const writeStream = require("fs").createWriteStream(backupPath);
      const gzipStream = createGzip({ level: 9 });
      await pipelineAsync(readStream, gzipStream, writeStream);

      // Temporäre SQL-Datei löschen
      await fs.unlink(tempSqlPath);

      const stats = await fs.stat(backupPath);
      const fileSize = stats.size;

      const backupInfo: BackupInfo = {
        id: backupId,
        filename,
        created_at: new Date().toISOString(),
        size: fileSize,
        status: "completed",
        tables_count: tableCount,
      };

      await this.saveBackupInfo(backupInfo);

      await this.saveStatus({
        isRunning: false,
        progress: 100,
      });

      console.log(`✅ Backup erfolgreich erstellt: ${filename}`);
    } catch (error) {
      console.error("❌ Backup-Fehler:", error);

      try {
        await fs.unlink(tempSqlPath);
      } catch {}
      try {
        await fs.unlink(backupPath);
      } catch {}

      await this.saveStatus({
        isRunning: false,
        error:
          error instanceof Error
            ? error.message
            : "Unbekannter Fehler",
      });

      throw error;
    }
  }

  private async saveBackupInfo(backupInfo: BackupInfo) {
    const backupListFile = path.join(this.backupDir, "backup-list.json");
    let backupList: BackupInfo[] = [];

    try {
      const existingData = await fs.readFile(backupListFile, "utf-8");
      backupList = JSON.parse(existingData);
    } catch {
      // Datei existiert noch nicht
    }

    backupList.unshift(backupInfo); // Neueste zuerst
    backupList = backupList.slice(0, 50); // Max. 50 Backups

    await fs.writeFile(
      backupListFile,
      JSON.stringify(backupList, null, 2)
    );
  }

  async getBackupList(): Promise<BackupInfo[]> {
    const backupListFile = path.join(this.backupDir, "backup-list.json");

    try {
      const data = await fs.readFile(backupListFile, "utf-8");
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async getBackupStatus(): Promise<BackupStatus> {
    const status = await this.loadStatus();

    // Prüfe auf hängende Backup-Prozesse (älter als 5 Minuten)
    if (status.isRunning) {
      try {
        const statusFileStats = await fs.stat(this.statusFile);
        const statusAge =
          Date.now() - statusFileStats.mtime.getTime();
        const maxAge = 5 * 60 * 1000; // 5 Minuten

        if (statusAge > maxAge) {
          console.warn(
            "⚠️ Hängender Backup-Prozess erkannt, setze Status zurück"
          );
          const resetStatus = {
            isRunning: false,
            error:
              "Backup-Prozess wurde nach 5 Minuten Inaktivität zurückgesetzt",
          };
          await this.saveStatus(resetStatus);
          return resetStatus;
        }
      } catch (error) {
        console.error(
          "Fehler beim Prüfen des Status-Alters:",
          error
        );
      }
    }

    // Lösche alte Fehlermeldungen nach 10 Minuten
    if (status.error && !status.isRunning) {
      try {
        const statusFileStats = await fs.stat(this.statusFile);
        const statusAge =
          Date.now() - statusFileStats.mtime.getTime();
        const errorMaxAge = 10 * 60 * 1000; // 10 Minuten

        if (statusAge > errorMaxAge) {
          const cleanStatus = { isRunning: false };
          await this.saveStatus(cleanStatus);
          return cleanStatus;
        }
      } catch (error) {
        console.error(
          "Fehler beim Prüfen des Fehler-Alters:",
          error
        );
      }
    }

    return status;
  }

  async forceResetBackupStatus(): Promise<void> {
    await this.saveStatus({ isRunning: false });
    console.log("✅ Backup-Status wurde zurückgesetzt");
  }

  async getBackupFile(
    backupId: string
  ): Promise<{ filePath: string; filename: string } | null> {
    const backupList = await this.getBackupList();
    const backup = backupList.find((b) => b.id === backupId);

    if (!backup) return null;

    const filePath = path.join(this.backupDir, backup.filename);

    try {
      await fs.access(filePath);
      return { filePath, filename: backup.filename };
    } catch {
      return null;
    }
  }

  async cleanupOldBackupsKeepNewest(): Promise<number> {
    const backupList = await this.getBackupList();

    const sorted = backupList.sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    );

    const toDelete = sorted.slice(1);
    let deletedCount = 0;

    for (const backup of toDelete) {
      try {
        const filePath = path.join(this.backupDir, backup.filename);
        await fs.unlink(filePath);
        console.log(`🗑️ Altes Backup gelöscht: ${backup.filename}`);
        deletedCount++;
      } catch (error) {
        console.error(
          `Fehler beim Löschen von ${backup.filename}:`,
          error
        );
      }
    }

    const updatedList = sorted.slice(0, 1);
    const backupListFile = path.join(this.backupDir, "backup-list.json");
    await fs.writeFile(
      backupListFile,
      JSON.stringify(updatedList, null, 2)
    );

    return deletedCount;
  }
}
