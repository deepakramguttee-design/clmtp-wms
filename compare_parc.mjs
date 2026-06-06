import { createClient } from '@supabase/supabase-js';
import { PARC_VEHICULES } from './src/parc.js';

const supabase = createClient(
  'https://jtqlaiabxwbgwgduqzpl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0cWxhaWFieHdiZ3dnZHVxenBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MjAxOTIsImV4cCI6MjA5NTE5NjE5Mn0.Jct69RHpkvSXwCxO7S0lkd2faSlucwtcTtqkSVNjkQQ'
);

// Récupère TOUS les nums Supabase (sans limite)
let allRows = [], from = 0, step = 1000;
while (true) {
  const { data } = await supabase.from('parc_vehicules').select('num').range(from, from + step - 1);
  if (!data || data.length === 0) break;
  allRows.push(...data);
  if (data.length < step) break;
  from += step;
}

const supabaseNums = new Set(allRows.map(r => r.num?.trim()));
console.log(`parc.js   : ${PARC_VEHICULES.length} véhicules`);
console.log(`Supabase  : ${allRows.length} véhicules`);

const missing = PARC_VEHICULES.filter(v => !supabaseNums.has(v.num?.trim()));
console.log(`\nManquants dans Supabase : ${missing.length}`);
missing.slice(0, 30).forEach(v => console.log(`  ${v.num.padEnd(14)} ${v.name.slice(0,50)}`));
if (missing.length > 30) console.log(`  ... et ${missing.length - 30} autres`);
