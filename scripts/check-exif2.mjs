import { createPool } from 'mysql2/promise';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
const env = readFileSync(envPath, 'utf-8');
const dbUrl = env.match(/DATABASE_URL=(.+)/)?.[1]?.trim().replace(/^["']|["']$/g, '');
const pool = createPool(dbUrl);

const [rows] = await pool.query(`
  SELECT 
    id, filename, created_at,
    JSON_UNQUOTE(JSON_EXTRACT(exif_data, '$.DateTimeOriginal')) AS dto_raw,
    COALESCE(
      CAST(LEFT(REPLACE(JSON_UNQUOTE(JSON_EXTRACT(exif_data, '$.DateTimeOriginal')), 'T', ' '), 19) AS DATETIME),
      created_at
    ) AS exif_sort,
    ROW_NUMBER() OVER (ORDER BY id ASC) AS upload_rank,
    ROW_NUMBER() OVER (ORDER BY COALESCE(CAST(LEFT(REPLACE(JSON_UNQUOTE(JSON_EXTRACT(exif_data, '$.DateTimeOriginal')), 'T', ' '), 19) AS DATETIME), created_at) ASC) AS exif_rank
  FROM photos
  WHERE album_id = 559
  ORDER BY id ASC
`);

let diffCount = 0;
console.log('Total photos in album 559:', rows.length);
console.log('\nAlle Fotos (upload_rank vs exif_rank):');
for (const r of rows) {
  const diff = r.upload_rank !== r.exif_rank ? ' <<< DIFFERENT' : '';
  if (diff) diffCount++;
  console.log(`  ID:${r.id} | up:${r.upload_rank} | exif:${r.exif_rank}${diff} | dto: ${r.dto_raw}`);
}

console.log(`\nAnzahl Fotos mit anderer Reihenfolge: ${diffCount}`);
if (diffCount === 0) {
  console.log('Für dieses Album: Upload-Reihenfolge == EXIF-Reihenfolge => Kein sichtbarer Unterschied!');
} else {
  console.log('Fix würde die Reihenfolge verändern.');
}

await pool.end();
