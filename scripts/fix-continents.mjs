import { readFileSync, writeFileSync } from 'fs';

const path = 'c:/NEXTjs/franksfotos/lib/reisen/countries.ts';
let src = readFileSync(path, 'utf8');

// CONTINENTS array aktualisieren
src = src.replace(
  `export const CONTINENTS = ["Europa", "Asien", "Afrika", "Amerika", "Ozeanien", "Antarktika"] as const;`,
  `export const CONTINENTS = ["Europa", "Asien", "Afrika", "Nordamerika", "Südamerika", "Ozeanien", "Antarktika"] as const;`
);

// Südamerika-Codes
const sa = new Set(['AR','BO','BR','CL','CO','EC','FK','GF','GY','PE','PY','SR','UY','VE']);

// Jede Zeile mit continent: "Amerika" prüfen und zuordnen
src = src.replace(/(\{ code: "([A-Z]{2})",.*?continent: )"Amerika"/g, (match, prefix, code) => {
  return prefix + (sa.has(code) ? '"Südamerika"' : '"Nordamerika"');
});

writeFileSync(path, src, 'utf8');

// Verifikation
const lines = src.split('\n');
console.log('CONTINENTS:', lines.find(l => l.includes('CONTINENTS =')));
console.log('AR (sollte Südamerika):', lines.find(l => l.includes('code: "AR"')));
console.log('US (sollte Nordamerika):', lines.find(l => l.includes('code: "US"')));
console.log('Verbleibende "Amerika":', lines.filter(l => l.includes('"Amerika"') && !l.includes('Nord') && !l.includes('Süd')).length);
