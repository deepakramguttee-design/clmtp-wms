/**
 * Import Milwaukee ONE-KEY inventory → Supabase table "equipements"
 * Usage : node scripts/import-milwaukee.mjs [--dry-run]
 */

import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const XLSX_PATH = 'C:/Users/Deepak RAMGUTTEE/Downloads/MilwaukeeTool-OneKey-Inventory-Export.xlsx';
const DRY_RUN   = process.argv.includes('--dry-run');
const BATCH     = 100; // lignes par INSERT batch

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://jtqlaiabxwbgwgduqzpl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0cWxhaWFieHdiZ3dnZHVxenBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MjAxOTIsImV4cCI6MjA5NTE5NjE5Mn0.Jct69RHpkvSXwCxO7S0lkd2faSlucwtcTtqkSVNjkQQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Mapping Département → site_id ─────────────────────────────────────────────
const SITE_MAP = {
  'CLMTP':        'clmtp_sable',
  'STMF':         'stmf',
  'Claisse Rail': 'claisse_rail',
  'Bâtiment':     null,
};

// ── Lecture Excel ─────────────────────────────────────────────────────────────
console.log('📂 Lecture du fichier Excel…');
const wb   = XLSX.readFile(XLSX_PATH);
const ws   = wb.Sheets[wb.SheetNames[0]];
const all  = XLSX.utils.sheet_to_json(ws, { defval: '' });

// La première ligne contient les en-têtes (lus comme données car pas de header row)
const [headerRow, ...dataRows] = all;
console.log(`📊 ${dataRows.length} lignes trouvées`);

// ── Transformation ────────────────────────────────────────────────────────────
const records = [];
const skipped = [];

for (const [i, r] of dataRows.entries()) {
  const nom = String(r.__EMPTY_1 || '').trim();
  if (!nom) {
    skipped.push({ ligne: i + 2, raison: 'nom vide' });
    continue;
  }

  const dept   = String(r.__EMPTY_5 || '').trim();
  const valRaw = r.__EMPTY_15;
  const valeur = valRaw !== '' && !isNaN(Number(valRaw)) ? Number(valRaw) : null;

  records.push({
    fabricant:    String(r.__EMPTY    || '').trim() || null,
    nom,
    modele:       String(r.__EMPTY_2  || '').trim() || null,
    categorie:    String(r.__EMPTY_3  || '').trim() || null,
    site:         dept in SITE_MAP ? SITE_MAP[dept] : null,
    localisation: String(r.__EMPTY_6  || '').trim() || null,
    code:         String(r.__EMPTY_9  || '').trim() || null,
    numero_serie: String(r.__EMPTY_10 || '').trim() || null,
    statut:       String(r.__EMPTY_14 || '').trim() || null,
    valeur,
    assigne_a:    String(r.__EMPTY_8  || '').trim() || null,
    notes:        String(r.__EMPTY_11 || '').trim() || null,
  });
}

console.log(`✅ ${records.length} lignes à importer, ${skipped.length} ignorées (nom vide)`);
if (skipped.length) console.log('   Ignorées :', skipped);

// Aperçu stats
const bySite = {};
for (const r of records) {
  const k = r.site ?? '(non mappé)';
  bySite[k] = (bySite[k] || 0) + 1;
}
console.log('📊 Par site :', bySite);

const byStatut = {};
for (const r of records) {
  const k = r.statut ?? '(vide)';
  byStatut[k] = (byStatut[k] || 0) + 1;
}
console.log('📊 Par statut :', byStatut);

if (DRY_RUN) {
  console.log('\n🔍 --dry-run : aucun INSERT effectué.');
  console.log('Exemple ligne 0 :', records[0]);
  process.exit(0);
}

// ── INSERT par batches ────────────────────────────────────────────────────────
console.log(`\n🚀 Import en batches de ${BATCH}…`);
let inserted = 0;
let errors   = 0;

for (let i = 0; i < records.length; i += BATCH) {
  const batch = records.slice(i, i + BATCH);
  const { error } = await supabase.from('equipements').insert(batch);
  if (error) {
    console.error(`❌ Batch ${i}–${i + batch.length - 1} :`, error.message);
    errors += batch.length;
  } else {
    inserted += batch.length;
    process.stdout.write(`\r   ${inserted}/${records.length} insérés…`);
  }
}

console.log(`\n\n✅ Import terminé : ${inserted} insérés, ${errors} erreurs`);
if (errors) process.exit(1);
