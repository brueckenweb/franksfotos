import { promises as fs } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

// Chunk-Größe für SELECT-Abfragen (Zeilen pro Abfrage)
const ROW_CHUNK_SIZE = 500;

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

  /** Hilfsmethode: String inkrementell an Datei anhängen */
  private async appendToFile(filePath: string, content: string): Promise<void> {
    await fs.appendFile(filePath, content, "utf8");
  }

  /** Escape-Funktion für SQL-Werte */
  private escapeValue(value: unknown): string {
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
      return `'${value.toISOString().slice(0, 19).replace("T", " ")}'`;
    if (typeof value === "boolean") return value ? "1" : "0";
    if (typeof value === "number") return value.toString();
    if (Buffer.isBuffer(value)) return `'${value.toString("hex")}'`;
    return `'${String(value)}'`;
  }

  private async createSQLDump(outputPath: string, onProgress?: (table: string, rows: number) => Promise<void>): Promise<void> {
    console.log("🔄 Starte Drizzle-basiertes Backup (Chunked-Modus)");

    const dbConfig = await this.getDatabaseConfig();

    // Datei zunächst leeren / neu anlegen
    await fs.writeFile(outputPath, "", "utf8");

    // Header
    let header = `-- MySQL dump created by FranksFotos Backup Manager (Chunked Drizzle)\n`;
    header += `-- Host: ${dbConfig.host}    Database: ${dbConfig.database}\n`;
    header += `-- ------------------------------------------------------\n`;
    header += `-- Server version\t${new Date().toISOString()}\n\n`;
    header += `/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;\n`;
    header += `/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;\n`;
    header += `/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;\n`;
    header += `/*!40101 SET NAMES utf8mb4 */;\n`;
    header += `/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;\n`;
    header += `/*!40103 SET TIME_ZONE='+00:00' */;\n`;
    header += `/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;\n`;
    header += `/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;\n`;
    header += `/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;\n`;
    header += `/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;\n\n`;
    await this.appendToFile(outputPath, header);

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

      console.log(`📋 ${foundTableNames.length} Tabellen werden exportiert`);

      let processedTables = 0;
      for (const tableName of foundTableNames) {
        console.log(`🔄 Verarbeite Tabelle: ${tableName}`);

        if (!tableName || typeof tableName !== "string") {
          console.error("❌ Ungültiger Tabellenname:", tableName);
          continue;
        }

        // Status pro Tabelle aktualisieren (hält den Timeout-Wächter bei Laune)
        await this.saveStatus({
          isRunning: true,
          progress: 30 + (processedTables / foundTableNames.length) * 60,
          currentTable: `Exportiere: ${tableName}…`,
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

          let tableHeader = `--\n-- Table structure for table \`${tableName}\`\n--\n\n`;
          tableHeader += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
          tableHeader += `/*!40101 SET @saved_cs_client     = @@character_set_client */;\n`;
          tableHeader += `/*!40101 SET character_set_client = utf8 */;\n`;
          tableHeader += `${createStatement};\n`;
          tableHeader += `/*!40101 SET character_set_client = @saved_cs_client */;\n\n`;
          await this.appendToFile(outputPath, tableHeader);

          // ── Daten CHUNK-weise exportieren (kein SELECT * ohne LIMIT!) ──
          let offset = 0;
          let totalRows = 0;
          let columns: string[] | null = null;
          let headerWritten = false;

          while (true) {
            // Status für jeden Chunk aktualisieren – verhindert Timeout
            await this.saveStatus({
              isRunning: true,
              progress: 30 + (processedTables / foundTableNames.length) * 60,
              currentTable: `${tableName} (${totalRows} Zeilen exportiert…)`,
            });

            const rows = await db.execute(
              sql.raw(`SELECT * FROM \`${tableName}\` LIMIT ${ROW_CHUNK_SIZE} OFFSET ${offset}`)
            );

            let dataRows: any[] = [];
            if (Array.isArray(rows) && rows.length > 0) {
              if (Array.isArray(rows[0]) && rows[0].length > 0) {
                dataRows = rows[0];
              } else {
                dataRows = rows as any[];
              }
            }

            if (dataRows.length === 0) break;

            // Spalten beim ersten Chunk ermitteln
            if (!columns) {
              columns = Object.keys(dataRows[0]);
            }

            // Beim ersten Chunk Daten-Header schreiben
            if (!headerWritten) {
              const dataHdr =
                `--\n-- Dumping data for table \`${tableName}\`\n--\n\n` +
                `LOCK TABLES \`${tableName}\` WRITE;\n` +
                `/*!40000 ALTER TABLE \`${tableName}\` DISABLE KEYS */;\n`;
              await this.appendToFile(outputPath, dataHdr);
              headerWritten = true;
            }

            // INSERT-Statement für diesen Chunk (je 100 Zeilen pro INSERT)
            const INSERT_BATCH = 100;
            const colList = columns.map((c) => `\`${c}\``).join(",");

            for (let i = 0; i < dataRows.length; i += INSERT_BATCH) {
              const batch = dataRows.slice(i, i + INSERT_BATCH);
              const valueLines = batch.map((row) => {
                const vals = Object.values(row).map((v) => this.escapeValue(v));
                return `(${vals.join(",")})`;
              });
              await this.appendToFile(
                outputPath,
                `INSERT INTO \`${tableName}\` (${colList}) VALUES\n${valueLines.join(",\n")};\n`
              );
            }

            totalRows += dataRows.length;
            offset += ROW_CHUNK_SIZE;
            console.log(`  → ${tableName}: ${totalRows} Zeilen bisher…`);

            if (dataRows.length < ROW_CHUNK_SIZE) break; // Letzter Chunk
          }

          if (headerWritten) {
            await this.appendToFile(
              outputPath,
              `/*!40000 ALTER TABLE \`${tableName}\` ENABLE KEYS */;\nUNLOCK TABLES;\n\n`
            );
          }

          console.log(`✅ Tabelle ${tableName}: ${totalRows} Zeilen exportiert`);
        } catch (tableError) {
          console.error(
            `❌ Fehler beim Exportieren der Tabelle ${tableName}:`,
            tableError
          );
          await this.appendToFile(
            outputPath,
            `-- Fehler beim Exportieren der Tabelle ${tableName}: ${tableError}\n\n`
          );
        }

        processedTables++;
      }

      // Footer
      const footer =
        `/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;\n` +
        `/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;\n` +
        `/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;\n` +
        `/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;\n` +
        `/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;\n` +
        `/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;\n` +
        `/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;\n` +
        `/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;\n`;
      await this.appendToFile(outputPath, footer);

      console.log(`💾 SQL-Dump fertiggestellt: ${outputPath}`);
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
    const filename = `fotodatenbank_backup_${timestamp}.sql`;
    const backupPath = path.join(this.backupDir, filename);

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

      // SQL-Dump direkt in die finale Datei schreiben (kein gzip)
      await this.createSQLDump(backupPath);

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

      try { await fs.unlink(backupPath); } catch {}

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

    // Prüfe auf hängende Backup-Prozesse (älter als 30 Minuten)
    if (status.isRunning) {
      try {
        const statusFileStats = await fs.stat(this.statusFile);
        const statusAge =
          Date.now() - statusFileStats.mtime.getTime();
        const maxAge = 30 * 60 * 1000; // 30 Minuten (vorher: 5 Minuten)

        if (statusAge > maxAge) {
          console.warn(
            "⚠️ Hängender Backup-Prozess erkannt, setze Status zurück"
          );
          const resetStatus = {
            isRunning: false,
            error:
              "Backup-Prozess wurde nach 30 Minuten Inaktivität zurückgesetzt",
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
