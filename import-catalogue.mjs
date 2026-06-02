import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

process.loadEnvFile(new URL('.env', import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL et SUPABASE_KEY doivent être définis dans .env');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SITE_ID  = process.argv[2] || 'claisse_rail';
const FILE     = process.argv[3] || 'template_catalogue_import.xlsx';

const wb   = XLSX.readFile(FILE);
const ws   = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws);

let idx = 1;
const rows = [];
for (const row of data) {
  const nom = String(row['DESIGNATION'] || row['Nom'] || row['Désignation'] || row['Article'] || row['NAME'] || '').trim();
  if (!nom) continue;
  const article_id = String(row['article_id'] || row['SKU'] || row['ID'] || row['Référence'] || row['REF'] || `ART-${String(idx).padStart(4,'0')}`).trim();
  rows.push({
    site_id:    SITE_ID,
    article_id,
    nom,
    sku:        String(row['article_id'] || row['SKU'] || row['Référence'] || article_id),
    categorie:  String(row['CATEGORIE']  || row['Catégorie'] || 'Général'),
    fournisseur:String(row['FOURNISSEUR']|| row['Fournisseur'] || ''),
    stock:      parseInt(row['Stock']    || row['QTÉ'] || row['Quantité'] || 0) || 0,
    stock_min:  parseInt(row['Min']      || row['Minimum'] || row['Stock min'] || 0) || 0,
    location:   String(row['Location']   || row['Emplacement'] || ''),
    prix_ht:    parseFloat(row['prix_unitaire'] || row['Prix HT'] || row['Prix'] || 0) || 0,
    unite:      String(row['unité']      || row['Unité'] || 'pcs'),
    actif:      true,
  });
  idx++;
}

if (rows.length === 0) {
  console.error('❌ Aucun article trouvé dans le fichier.');
  process.exit(1);
}

console.log(`📦 ${rows.length} article(s) à importer dans "${SITE_ID}"…`);

const { error } = await supabase
  .from('catalogues')
  .upsert(rows, { onConflict: 'site_id,article_id' });

if (error) {
  console.error('❌ Erreur Supabase :', error.message);
  process.exit(1);
}

console.log(`✅ Import réussi — ${rows.length} articles dans "${SITE_ID}".`);
