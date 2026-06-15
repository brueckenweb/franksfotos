import { createPool } from 'mysql2/promise';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// .env.local einlesen
const envPath = resolve(process.cwd(), '.env.local');
const env = readFileSync(envPath, 'utf-8');
const dbUrl = env.match(/DATABASE_URL=(.+)/)?.[1]?.trim().replace(/^["']|["']$/g, '');

if (!dbUrl) {
  console.error('DATABASE_URL nicht gefunden in .env.local');
  process.exit(1);
}

const pool = createPool(dbUrl);

const slug = process.argv[2] || '2026-05-09-whale-watching-cruise-in-kaikoura';

// Album-ID via Slug
const [albumRows] = await pool.query('SELECT id, photo_sort_mode FROM albums WHERE slug = ?', [slug]);

if (!albumRows.length) {
  console.log('Album nicht gefunden für slug:', slug);
  await pool.end();
  process.exit(1);
}

const { id: albumId, photo_sort_mode } = albumRows[0];
console.log(`Album ID: ${albumId}, photoSortMode: ${photo_sort_mode}`);

// Fotos mit EXIF-Daten
const [photos] = await pool.query(
  'SELECT id, filename, created_at, exif_data FROM photos WHERE album_id = ? ORDER BY id ASC LIMIT 10',
  [albumId]
);

console.log(`\nAnzahl Fotos in Album: ${photos.length}`);

for (const p of photos) {
  console.log(`\n--- Foto ID: ${p.id} | Datei: ${p.filename}`);
  console.log(`  created_at: ${p.created_at}`);
  if (p.exif_data) {
    const exif = typeof p.exif_data === 'string' ? JSON.parse(p.exif_data) : p.exif_data;
    const dto = exif.DateTimeOriginal;
    console.log(`  DateTimeOriginal: ${dto !== undefined ? JSON.stringify(dto) : '(nicht vorhanden)'}`);
    const dateKeys = Object.keys(exif).filter(k => /date|time/i.test(k));
    if (dateKeys.length > 0) console.log(`  Alle Datum-Keys: ${dateKeys.join(', ')}`);
    // MySQL CAST-Test direkt
    if (dto) {
      const replaced = String(dto).replace('T', ' ');
      const leftResult = replaced.substring(0, 19);
      console.log(`  REPLACE('T',' '): "${replaced}"  → LEFT(19): "${leftResult}"`);
    }
  } else {
    console.log('  exif_data: NULL');
  }
}

// SQL-Test: wie MySQL tatsächlich sortiert
console.log('\n\n=== MySQL-Sortiertest (EXIF-Datum ASC) ===');
const [sorted] = await pool.query(`
  SELECT id, filename, created_at,
    JSON_UNQUOTE(JSON_EXTRACT(exif_data, '$.DateTimeOriginal')) AS dto_raw,
    CAST(LEFT(REPLACE(JSON_UNQUOTE(JSON_EXTRACT(exif_data, '$.DateTimeOriginal')), 'T', ' '), 19) AS DATETIME) AS dto_cast,
    COALESCE(CAST(LEFT(REPLACE(JSON_UNQUOTE(JSON_EXTRACT(exif_data, '$.DateTimeOriginal')), 'T', ' '), 19) AS DATETIME), created_at) AS sort_val
  FROM photos
  WHERE album_id = ?
  ORDER BY sort_val ASC
  LIMIT 10
`, [albumId]);

for (const r of sorted) {
  console.log(`  ID:${r.id} | dto_raw: ${r.dto_raw} | dto_cast: ${r.dto_cast} | sort_val: ${r.sort_val} | file: ${r.filename}`);
}

await pool.end();
