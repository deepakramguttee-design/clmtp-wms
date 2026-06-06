import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

function parseEnv(filepath) {
  try {
    const vars = {};
    for (const line of readFileSync(filepath, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 0) continue;
      vars[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
    return vars;
  } catch { return {}; }
}

const envL = parseEnv(resolve(__dirname, '.env.local'));
const envM = parseEnv(resolve(__dirname, '.env'));

const SUPABASE_URL = envL.VITE_SUPABASE_URL || envM.SUPABASE_URL;
const SUPABASE_KEY = envL.VITE_SUPABASE_ANON_KEY || envM.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Variables Supabase manquantes dans .env ou .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Même logique que makeMatch dans ParcVehicules.jsx
function makeMatch(mots_cles) {
  return (v) => {
    const n = ((v.name || '') + ' ' + (v.marque || '')).toUpperCase();
    return (mots_cles || []).some(kw => kw.trim() && n.includes(kw.trim().toUpperCase()));
  };
}

// Préfixes num — regex exact pour éviter VP qui capture VPS
const NUM_PREFIX_MAP = [
  { prefix: 'VPS', exact: /^VPS/i,       catMatch: c => c.nom.toUpperCase().includes('PM') || c.nom.toUpperCase().includes('PETIT') },
  { prefix: 'VU',  exact: /^VU/i,        catMatch: c => c.nom.toUpperCase().includes('VU') || (c.mots_cles||[]).some(k=>k.trim().toUpperCase()==='VU') },
  { prefix: 'VP',  exact: /^VP(?!S)/i,   catMatch: c => c.nom.toUpperCase().includes('VP') || (c.mots_cles||[]).some(k=>k.trim().toUpperCase()==='VP') },
  { prefix: 'VC',  exact: /^VC/i,        catMatch: c => c.nom.toUpperCase().includes('VC') || (c.mots_cles||[]).some(k=>k.trim().toUpperCase()==='VC') },
];

function numPrefix(num) {
  if (!num) return null;
  return NUM_PREFIX_MAP.find(p => p.exact.test(num)) || null;
}

async function main() {
  console.log('🔗', SUPABASE_URL, '\n');

  // ── Catégories ──────────────────────────────────────────────────────────
  console.log('📂 Chargement des catégories...');
  const { data: cats, error: catErr } = await supabase
    .from('parc_categories').select('*').order('ordre');
  if (catErr) { console.error('❌', catErr.message); process.exit(1); }
  console.log(`   → ${cats.length} catégorie(s)`);
  cats.forEach(c =>
    console.log(`   [${c.id}] ${c.icone||''} ${c.nom}  mots-clés: ${(c.mots_cles||[]).join(', ')||'—'}`)
  );

  // Résoudre chaque préfixe vers une catégorie
  for (const entry of NUM_PREFIX_MAP) {
    const cat = cats.find(entry.catMatch);
    if (cat) {
      entry.cat = cat;
      console.log(`   → Préfixe ${entry.prefix} → "${cat.nom}" (id:${cat.id})`);
    } else {
      console.warn(`   ⚠️  Aucune catégorie pour le préfixe ${entry.prefix}`);
    }
  }

  // Catégorie PM pour le pré-contrôle "VPS dans la désignation"
  const pmCat = NUM_PREFIX_MAP.find(e => e.prefix === 'VPS')?.cat || null;

  // ── Engins (pagination 1000) ────────────────────────────────────────────
  console.log('\n🚗 Chargement des engins...');
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('parc_vehicules')
      .select('id, num, name, marque, categorie_id')
      .order('num')
      .range(from, from + 999);
    if (error) { console.error('❌', error.message); process.exit(1); }
    if (!data?.length) break;
    all.push(...data);
    from += 1000;
  }
  console.log(`   → ${all.length} engin(s) chargé(s)`);

  // ── Matching ────────────────────────────────────────────────────────────
  console.log('\n🔍 Association aux catégories...');
  const toUpdate = [];
  const noMatch  = [];

  for (const v of all) {
    let target = null;

    // Priorité 1 : préfixe num (VPS > VU/VP/VC)
    const entry = numPrefix(v.num);
    if (entry?.cat) target = entry.cat;

    // Priorité 2a : "VPS" dans la désignation → PM (avant que "VP" keyword matche faussement)
    if (!target && pmCat) {
      const nameUp = ((v.name || '') + ' ' + (v.marque || '')).toUpperCase();
      if (nameUp.includes('VPS')) target = pmCat;
    }

    // Priorité 2b : mots-clés sur name + marque (ordre catégories)
    if (!target) {
      for (const cat of cats) {
        if (makeMatch(cat.mots_cles)(v)) { target = cat; break; }
      }
    }

    if (!target) {
      noMatch.push(v);
    } else if (v.categorie_id !== target.id) {
      toUpdate.push({ id: v.id, categorie_id: target.id, label: `${v.num} — ${v.name}`, catNom: target.nom });
    }
  }

  const alreadyOk = all.length - toUpdate.length - noMatch.length;
  console.log(`\n📊 Résumé :`);
  console.log(`   ✅ ${alreadyOk} déjà à jour`);
  console.log(`   ✏️  ${toUpdate.length} à mettre à jour`);
  console.log(`   ⚠️  ${noMatch.length} sans catégorie correspondante`);
  if (noMatch.length) {
    noMatch.forEach(v => console.log(`      · ${v.num} — ${v.name} (${v.marque||''})`));
  }

  if (!toUpdate.length) {
    console.log('\n✅ Tout est déjà à jour — aucun UPDATE nécessaire.');
    return;
  }

  // ── Mises à jour ────────────────────────────────────────────────────────
  console.log('\n⬆️  Mise à jour en cours...');
  let done = 0, errors = 0;
  for (const upd of toUpdate) {
    const { error } = await supabase
      .from('parc_vehicules')
      .update({ categorie_id: upd.categorie_id })
      .eq('id', upd.id);
    if (error) {
      console.error(`   ❌ id=${upd.id} : ${error.message}`);
      errors++;
    } else {
      console.log(`   ✓ ${upd.label}  →  ${upd.catNom}`);
      done++;
    }
  }

  console.log(`\n✅ Terminé : ${done} mis à jour${errors ? `, ${errors} erreur(s)` : ''}.`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
