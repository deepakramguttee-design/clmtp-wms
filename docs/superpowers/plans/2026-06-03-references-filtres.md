# Références Filtres Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Références filtres" module with two tabs — Véhicules (VU/VL/VP/VC) and Engins lourds — with search, category filter, full CRUD for admin, read-only for all other roles.

**Architecture:** New `src/ReferenceFiltres.jsx` component (self-contained, ~350 lines) registered in `App.jsx` following the exact same 4-point pattern used by VueEclatee: import → NAV_ALL → MODULES_PERMISSIONS → DEFAULT_PERMISSIONS → renderPage(). Four db.js helpers per table. Two Supabase tables (`filtration_vehicules`, `filtration_engins`) seeded from SQL.

**Tech Stack:** React 18 + inline styles (no CSS files), Supabase JS client, same visual conventions as the rest of the WMS (font DM Sans, colors `#111827` / `#f1f5f9` / `#e5e7eb`, border-radius 10-14px).

---

## Codebase Context (read before coding)

### Adding a new page — the 4-point pattern in App.jsx

Every new page follows these exact 4 steps (search for `vue_eclatee` to see the live example):

**1. Import** (top of file, ~line 4):
```js
import ReferenceFiltres from "./ReferenceFiltres.jsx";
```

**2. NAV_ALL entry** (~line 3581, after `vue_eclatee`):
```js
{ id:"ref_filtres", label:"Références filtres", icon:"🔩", roles:["admin","technicien","magasinier","preparateur","magasinier_preparateur","lecteur"], sites:["clmtp_sable","claisse_rail","stmf"] },
```

**3. MODULES_PERMISSIONS entry** (~line 3712, after `vue_eclatee`):
```js
{ id:"ref_filtres", label:"Références filtres", icon:"🔩", desc:"Références filtres véhicules et engins" },
```

**4. DEFAULT_PERMISSIONS** (~line 3717-3721) — append `"ref_filtres"` to all 5 non-admin role arrays:
```js
technicien:             ["dashboard","stock","scanner","ordres","equivalences","vue_eclatee","ref_filtres"],
magasinier:             ["dashboard","stock","scanner","mouvements","ordres","equivalences","vue_eclatee","ref_filtres"],
preparateur:            ["dashboard","stock","scanner","ordres","location","pret","equivalences","vue_eclatee","ref_filtres"],
magasinier_preparateur: ["dashboard","stock","scanner","mouvements","ordres","location","pret","equivalences","vue_eclatee","ref_filtres"],
lecteur:                ["dashboard","stock","scanner","vue_eclatee","ref_filtres"],
```

**5. renderPage()** (~line 4287, after vue_eclatee line):
```js
if(page==="ref_filtres") return <ReferenceFiltres user={user}/>;
```

### NAV filter logic (App.jsx ~line 4265)
The nav filter merges stored permissions with DEFAULT_PERMISSIONS — new modules added to DEFAULT_PERMISSIONS automatically appear for existing users without DB migration.

### db.js pattern
All helpers are plain async functions exported at the bottom of `src/db.js`. No classes, no ORM. Follow this exact shape:
```js
export async function getFiltrationVehicules() {
  const { data, error } = await supabase.from('filtration_vehicules').select('*').order('designation')
  if (error) { console.error(error); return []; }
  return data || [];
}
```

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/ReferenceFiltres.jsx` | Create | Full component: 2-tab UI, search, category filter, CRUD modals |
| `src/db.js` | Modify (append) | 8 CRUD helpers: 4 for `filtration_vehicules`, 4 for `filtration_engins` |
| `src/App.jsx` | Modify (5 spots) | Import, NAV_ALL, MODULES_PERMISSIONS, DEFAULT_PERMISSIONS, renderPage |

---

## Task 1 — Supabase tables + seed data

**Files:** No code files — SQL only (run in Supabase SQL Editor).

- [ ] **Step 1: Create tables and seed vehicules**

Run in Supabase SQL Editor:

```sql
-- Table véhicules
CREATE TABLE IF NOT EXISTS filtration_vehicules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designation text NOT NULL,
  filtre_air text,
  filtre_habitacle text,
  filtre_gasoil text,
  filtre_huile text,
  plaquette_avant text,
  plaquette_arriere text,
  disque_avant text,
  disque_arriere text,
  pneu text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE filtration_vehicules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lecture publique filtration_vehicules"
  ON filtration_vehicules FOR SELECT USING (true);
CREATE POLICY "ecriture anon filtration_vehicules"
  ON filtration_vehicules FOR ALL USING (true) WITH CHECK (true);

-- Seed données véhicules
INSERT INTO filtration_vehicules (designation,filtre_air,filtre_habitacle,filtre_gasoil,filtre_huile,plaquette_avant,plaquette_arriere,disque_avant,disque_arriere,pneu) VALUES
('MASTER III','C30011/A1407','AH273-2/CU2418-2','FCS922/WK 12009','P7011/L460/HU6011Z','BP1417','BP2474','BD1548','BD2153','195/75 R16C'),
('MASTER IV','C30011/A1407','AH273-2/CU2418-2','FCS922/WK 12009','P7011/L460/HU6011Z','BP1417','BP2474','BD1548','BD2153','195/75 R16C'),
('BERLINGO','A3005/C24036','AH261-2/CU29003-2/C875','','L1125/HU 7032Z','BP2482','BP1711','BD2149','BD2163','205/60 R16'),
('CITROEN JUMPY 6 places','A3005/C24036','AH261-2/CU29003-2/C626','','L1125/HU 7032Z','BP2298','BP2299','BD2653','BD2164','215/60R 17C'),
('PEUGEOT EXPERT III 120cv','A3005/C24036','AH261-2/CU29003-2/C626','','L1125/HU 7032Z','BP2298','BP2299','BD2653','BD2164','215/65R 16C'),
('PEUGEOT EXPERT III 145cv','A1725/S0433','AH261-2/CU29003-2/C626','','W7063/LS995','BP2298','BP2299','BD2653','BD2164','215/65R 16C'),
('CITROEN JUMPER 7 places','A1276/C17237','AH263','C879','W7063/LS995','BD1021','BD1845','BD1217','BD1277',NULL),
('PEUGEOT 308 1.5 HDI 130','A3005/C24036','AH425-2/R5525','C875','L1125/HU 7032Z','BP2863','BP1979',NULL,NULL,'205/55 R16'),
('PEUGEOT 308 1.2 PURETECH 130','S0517/A1786','AH425-2/R5525',NULL,'LS923/W7058','BP2863/BP1797','BP1979',NULL,NULL,'205/55 R16'),
('PEUGEOT 3008 1.5 HDI 130','A3005/C24036','AH725-2','C875','L1125/HU 7032Z','BP1797','BP1979','BD2149','BD2163','225/55 R18'),
('PEUGEOT 2008 1.5 HDI 110','A3005/C24036','AH725-2','C875','L1125/HU 7032Z','BP2603','BP2605',NULL,NULL,'215/65 R16'),
('CITROEN C5 AIRCROSS 2.0 HDI 180','A1725/S0433','AH261-2/R5522','C533A/N2533','P7268/LS995','BP1797','BP1979',NULL,NULL,'205/55 R19'),
('CITROEN C5 AIRCROSS HYBRIDE','A1274/S0219','AH261-2','N/A','HU711/51X/L358A','BP1797','BP1979',NULL,NULL,'205/55 R19'),
('CITROEN C4 2 places','A1792/S0511','M2079','C533A/N2533','P7082','BP1170','BP1359',NULL,NULL,'205/55 R16'),
('PEUGEOT 308 2 places','A3005/C24036','AH425-2/R5525','C875','L1125/HU 7032Z','BP1709','BP1710/BP1711','BD2172','BD2162/BD2163','205/55 R16'),
('PEUGEOT 208 2 places','A3005/C24036','AH725-2','C875','L1125/HU 7032Z','BP1360','BP2605','BD876','BD2959','205/55 R16');
```

- [ ] **Step 2: Create engins table**

Run in Supabase SQL Editor:

```sql
-- Table engins lourds
CREATE TABLE IF NOT EXISTS filtration_engins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engin text NOT NULL,
  code text,
  categorie text NOT NULL,
  fournisseur text,
  f_hydraulique text,
  f_moteur text,
  f_air_secu text,
  f_air_princ text,
  f_go text,
  f_adblue text,
  dessiccateur text,
  f_aeration text,
  f_transmission text,
  courroie text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE filtration_engins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lecture publique filtration_engins"
  ON filtration_engins FOR SELECT USING (true);
CREATE POLICY "ecriture anon filtration_engins"
  ON filtration_engins FOR ALL USING (true) WITH CHECK (true);
```

Expected: both tables appear in Supabase Table Editor, `filtration_vehicules` has 16 rows.

---

## Task 2 — db.js helpers

**Files:**
- Modify: `src/db.js` (append at end, after `deleteVueEclatee`)

- [ ] **Step 1: Append 8 helpers to db.js**

Open `src/db.js` and append after the last function:

```js
// ── FILTRATION VÉHICULES ──────────────────────────────────────────────────────
export async function getFiltrationVehicules() {
  const { data, error } = await supabase.from('filtration_vehicules').select('*').order('designation')
  if (error) { console.error(error); return []; }
  return data || [];
}
export async function addFiltrationVehicule(payload) {
  const { data, error } = await supabase.from('filtration_vehicules').insert([payload]).select()
  if (error) { console.error(error); return null; }
  return data?.[0];
}
export async function updateFiltrationVehicule(id, payload) {
  const { error } = await supabase.from('filtration_vehicules').update(payload).eq('id', id)
  if (error) console.error(error);
}
export async function deleteFiltrationVehicule(id) {
  const { error } = await supabase.from('filtration_vehicules').delete().eq('id', id)
  if (error) console.error(error);
}

// ── FILTRATION ENGINS ─────────────────────────────────────────────────────────
export async function getFiltrationEngins() {
  const { data, error } = await supabase.from('filtration_engins').select('*').order('categorie').order('engin')
  if (error) { console.error(error); return []; }
  return data || [];
}
export async function addFiltrationEngin(payload) {
  const { data, error } = await supabase.from('filtration_engins').insert([payload]).select()
  if (error) { console.error(error); return null; }
  return data?.[0];
}
export async function updateFiltrationEngin(id, payload) {
  const { error } = await supabase.from('filtration_engins').update(payload).eq('id', id)
  if (error) console.error(error);
}
export async function deleteFiltrationEngin(id) {
  const { error } = await supabase.from('filtration_engins').delete().eq('id', id)
  if (error) console.error(error);
}
```

- [ ] **Step 2: Verify imports compile**

Run: `npm run build 2>&1 | tail -5`
Expected: no error mentioning `db.js` or `filtration`.

- [ ] **Step 3: Commit**

```bash
git add src/db.js
git commit -m "feat: add filtration_vehicules and filtration_engins db helpers"
```

---

## Task 3 — ReferenceFiltres component

**Files:**
- Create: `src/ReferenceFiltres.jsx`

The component has two tabs. State:
- `tab` — `'vehicules'` | `'engins'`
- `vehicules` / `engins` — fetched arrays
- `loading` — bool
- `search` — string (filters both tabs by name)
- `catFilter` — string (engins only, filters by `categorie`)
- `showForm` — bool
- `editTarget` — object | null
- `form` — object matching the current tab's table columns
- `saving` — bool

Column headers for each table (used both in the table display and in the form):

**Véhicules columns:**
```js
const VEH_COLS = [
  { key:'designation',      label:'Désignation' },
  { key:'filtre_air',       label:'Filtre air' },
  { key:'filtre_habitacle', label:'Filtre habitacle' },
  { key:'filtre_gasoil',    label:'Filtre gasoil' },
  { key:'filtre_huile',     label:'Filtre huile' },
  { key:'plaquette_avant',  label:'Plaquette AV' },
  { key:'plaquette_arriere',label:'Plaquette AR' },
  { key:'disque_avant',     label:'Disque AV' },
  { key:'disque_arriere',   label:'Disque AR' },
  { key:'pneu',             label:'Pneu' },
];
```

**Engins columns:**
```js
const ENG_COLS = [
  { key:'engin',          label:'Engin' },
  { key:'code',           label:'Code' },
  { key:'categorie',      label:'Catégorie' },
  { key:'fournisseur',    label:'Fournisseur' },
  { key:'f_hydraulique',  label:'F. Hydraulique' },
  { key:'f_moteur',       label:'F. Moteur' },
  { key:'f_air_secu',     label:'F. Air sécu' },
  { key:'f_air_princ',    label:'F. Air princ.' },
  { key:'f_go',           label:'F. GO' },
  { key:'f_adblue',       label:'F. AdBlue' },
  { key:'dessiccateur',   label:'Dessiccateur' },
  { key:'f_aeration',     label:'F. Aération' },
  { key:'f_transmission', label:'F. Transmission' },
  { key:'courroie',       label:'Courroie' },
];

const CATEGORIES = ['PELLE','CHARGEUSE','NACELLE','PL','TRACTEUR','BOUREUSE','COMPACTEUR',
  'TELESCOPIQUE','TOMBEREAU','BROYEUR','UNIMOG','CHARIOT ELEVATEUR','DUMPER','VL',
  'GROUPE ELECTROGENE','MAT ECLAIRAGE','GROUPE AIR'];
```

- [ ] **Step 1: Create src/ReferenceFiltres.jsx**

```jsx
import { useState, useEffect } from 'react';
import {
  getFiltrationVehicules, addFiltrationVehicule, updateFiltrationVehicule, deleteFiltrationVehicule,
  getFiltrationEngins,    addFiltrationEngin,    updateFiltrationEngin,    deleteFiltrationEngin,
} from './db.js';

const VEH_COLS = [
  { key:'designation',       label:'Désignation' },
  { key:'filtre_air',        label:'Filtre air' },
  { key:'filtre_habitacle',  label:'Filtre habitacle' },
  { key:'filtre_gasoil',     label:'Filtre gasoil' },
  { key:'filtre_huile',      label:'Filtre huile' },
  { key:'plaquette_avant',   label:'Plaquette AV' },
  { key:'plaquette_arriere', label:'Plaquette AR' },
  { key:'disque_avant',      label:'Disque AV' },
  { key:'disque_arriere',    label:'Disque AR' },
  { key:'pneu',              label:'Pneu' },
];

const ENG_COLS = [
  { key:'engin',           label:'Engin' },
  { key:'code',            label:'Code' },
  { key:'categorie',       label:'Catégorie' },
  { key:'fournisseur',     label:'Fournisseur' },
  { key:'f_hydraulique',   label:'F. Hydraulique' },
  { key:'f_moteur',        label:'F. Moteur' },
  { key:'f_air_secu',      label:'F. Air sécu' },
  { key:'f_air_princ',     label:'F. Air princ.' },
  { key:'f_go',            label:'F. GO' },
  { key:'f_adblue',        label:'F. AdBlue' },
  { key:'dessiccateur',    label:'Dessiccateur' },
  { key:'f_aeration',      label:'F. Aération' },
  { key:'f_transmission',  label:'F. Transmission' },
  { key:'courroie',        label:'Courroie' },
];

const CATEGORIES = ['PELLE','CHARGEUSE','NACELLE','PL','TRACTEUR','BOUREUSE','COMPACTEUR',
  'TELESCOPIQUE','TOMBEREAU','BROYEUR','UNIMOG','CHARIOT ELEVATEUR','DUMPER','VL',
  'GROUPE ELECTROGENE','MAT ECLAIRAGE','GROUPE AIR'];

const emptyVeh = () => Object.fromEntries(VEH_COLS.map(c => [c.key, '']));
const emptyEng = () => ({ ...Object.fromEntries(ENG_COLS.map(c => [c.key, ''])), categorie: CATEGORIES[0] });

function Spinner() {
  return (
    <div style={{display:'flex',justifyContent:'center',padding:60}}>
      <div style={{width:32,height:32,border:'3px solid #e5e7eb',borderTop:'3px solid #111827',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
    </div>
  );
}

export default function ReferenceFiltres({ user }) {
  const [tab, setTab] = useState('vehicules');
  const [vehicules, setVehicules] = useState([]);
  const [engins, setEngins]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm]           = useState(emptyVeh());
  const [saving, setSaving]       = useState(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    Promise.all([getFiltrationVehicules(), getFiltrationEngins()])
      .then(([v, e]) => { setVehicules(v); setEngins(e); setLoading(false); });
  }, []);

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') setShowForm(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const openAdd = () => {
    setEditTarget(null);
    setForm(tab === 'vehicules' ? emptyVeh() : emptyEng());
    setShowForm(true);
  };

  const openEdit = row => {
    setEditTarget(row);
    setForm({ ...row });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const isVeh = tab === 'vehicules';
      // Strip empty strings to null for optional fields
      const payload = Object.fromEntries(
        Object.entries(form).filter(([k]) => k !== 'id' && k !== 'created_at')
          .map(([k, v]) => [k, v === '' ? null : v])
      );
      if (editTarget) {
        isVeh ? await updateFiltrationVehicule(editTarget.id, payload)
              : await updateFiltrationEngin(editTarget.id, payload);
        const updated = { ...editTarget, ...payload };
        isVeh ? setVehicules(p => p.map(r => r.id === editTarget.id ? updated : r))
              : setEngins(p => p.map(r => r.id === editTarget.id ? updated : r));
      } else {
        const saved = isVeh ? await addFiltrationVehicule(payload)
                            : await addFiltrationEngin(payload);
        if (saved) {
          isVeh ? setVehicules(p => [...p, saved])
                : setEngins(p => [...p, saved]);
        }
      }
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async row => {
    const label = tab === 'vehicules' ? row.designation : row.engin;
    if (!confirm(`Supprimer "${label}" ?`)) return;
    if (tab === 'vehicules') {
      await deleteFiltrationVehicule(row.id);
      setVehicules(p => p.filter(r => r.id !== row.id));
    } else {
      await deleteFiltrationEngin(row.id);
      setEngins(p => p.filter(r => r.id !== row.id));
    }
  };

  if (loading) return <Spinner />;

  const cols   = tab === 'vehicules' ? VEH_COLS : ENG_COLS;
  const rows   = tab === 'vehicules' ? vehicules : engins;
  const nameKey = tab === 'vehicules' ? 'designation' : 'engin';

  const filtered = rows.filter(r => {
    const matchSearch = !search || r[nameKey]?.toLowerCase().includes(search.toLowerCase());
    const matchCat    = tab !== 'engins' || !catFilter || r.categorie === catFilter;
    return matchSearch && matchCat;
  });

  // Unique categories present in loaded engins
  const cats = [...new Set(engins.map(e => e.categorie).filter(Boolean))].sort();

  const thStyle = { padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700,
    color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em',
    borderBottom:'2px solid #e5e7eb', whiteSpace:'nowrap', background:'#f9fafb' };
  const tdStyle = { padding:'10px 12px', fontSize:12, color:'#374151',
    borderBottom:'1px solid #f3f4f6', whiteSpace:'nowrap' };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:900,color:'#111827',margin:0}}>Références filtres</h1>
          <p style={{color:'#6b7280',fontSize:13,margin:'4px 0 0'}}>{filtered.length} résultat{filtered.length!==1?'s':''}</p>
        </div>
        {isAdmin&&(
          <button onClick={openAdd} style={{background:'#111827',color:'#fff',border:'none',borderRadius:10,padding:'9px 18px',fontWeight:700,cursor:'pointer',fontSize:13}}>
            + Ajouter
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:4,borderBottom:'2px solid #e5e7eb'}}>
        {[{id:'vehicules',label:'🚗 Véhicules (VU/VL/VP/VC)'},{id:'engins',label:'🏗️ Engins lourds'}].map(t=>(
          <button key={t.id} onClick={()=>{setTab(t.id);setSearch('');setCatFilter('');}}
            style={{padding:'10px 20px',border:'none',borderBottom:tab===t.id?'2px solid #111827':'2px solid transparent',
              background:'none',fontWeight:tab===t.id?700:400,color:tab===t.id?'#111827':'#6b7280',
              cursor:'pointer',fontSize:13,marginBottom:-2}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder={tab==='vehicules'?'Rechercher un véhicule…':'Rechercher un engin…'}
          style={{flex:1,minWidth:200,padding:'9px 14px',border:'1px solid #e5e7eb',borderRadius:10,fontSize:13,outline:'none'}}/>
        {tab==='engins'&&(
          <select value={catFilter} onChange={e=>setCatFilter(e.target.value)}
            style={{padding:'9px 14px',border:'1px solid #e5e7eb',borderRadius:10,fontSize:13,outline:'none',background:'#fff'}}>
            <option value=''>Toutes catégories</option>
            {cats.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',overflow:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',minWidth:600}}>
          <thead>
            <tr>
              {cols.map(c=><th key={c.key} style={thStyle}>{c.label}</th>)}
              {isAdmin&&<th style={{...thStyle,textAlign:'center'}}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length===0?(
              <tr><td colSpan={cols.length+(isAdmin?1:0)} style={{...tdStyle,textAlign:'center',color:'#9ca3af',padding:32}}>
                Aucun résultat
              </td></tr>
            ):filtered.map(row=>(
              <tr key={row.id} style={{transition:'background 0.1s'}}
                onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'}
                onMouseLeave={e=>e.currentTarget.style.background=''}>
                {cols.map(c=><td key={c.key} style={tdStyle}>{row[c.key]||'—'}</td>)}
                {isAdmin&&(
                  <td style={{...tdStyle,textAlign:'center'}}>
                    <div style={{display:'flex',gap:6,justifyContent:'center'}}>
                      <button onClick={()=>openEdit(row)} style={{padding:'4px 10px',background:'#f3f4f6',border:'none',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:600}}>✏️</button>
                      <button onClick={()=>handleDelete(row)} style={{padding:'4px 10px',background:'#fee2e2',border:'none',borderRadius:7,cursor:'pointer',color:'#dc2626',fontSize:12}}>🗑</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showForm&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,backdropFilter:'blur(2px)',padding:16}}>
          <div style={{background:'#fff',borderRadius:20,padding:28,width:'min(96vw,560px)',maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <h2 style={{fontSize:17,fontWeight:800,color:'#111827',margin:0}}>
                {editTarget?'✏️ Modifier':'➕ Ajouter'} — {tab==='vehicules'?'Véhicule':'Engin'}
              </h2>
              <button onClick={()=>setShowForm(false)} style={{background:'#f3f4f6',border:'none',borderRadius:8,padding:'6px 12px',cursor:'pointer',fontSize:16}}>✕</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {cols.map(c=>(
                <div key={c.key} style={c.key==='designation'||c.key==='engin'?{gridColumn:'1/-1'}:{}}>
                  <label style={{fontSize:11,fontWeight:600,color:'#374151',display:'block',marginBottom:4}}>{c.label}{(c.key==='designation'||c.key==='engin')?' *':''}</label>
                  {c.key==='categorie'?(
                    <select value={form[c.key]||''} onChange={e=>setForm(f=>({...f,[c.key]:e.target.value}))}
                      style={{width:'100%',padding:'8px 12px',border:'1px solid #e5e7eb',borderRadius:9,fontSize:13,outline:'none',boxSizing:'border-box'}}>
                      {CATEGORIES.map(cat=><option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  ):(
                    <input value={form[c.key]||''} onChange={e=>setForm(f=>({...f,[c.key]:e.target.value}))}
                      style={{width:'100%',padding:'8px 12px',border:'1px solid #e5e7eb',borderRadius:9,fontSize:13,outline:'none',boxSizing:'border-box'}}/>
                  )}
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:10,marginTop:20}}>
              <button onClick={()=>setShowForm(false)} style={{flex:1,padding:'11px',background:'#f3f4f6',border:'none',borderRadius:10,fontWeight:600,cursor:'pointer'}}>Annuler</button>
              <button onClick={handleSave}
                disabled={!(tab==='vehicules'?form.designation:form.engin)||saving}
                style={{flex:2,padding:'11px',background:!(tab==='vehicules'?form.designation:form.engin)||saving?'#e5e7eb':'#111827',color:!(tab==='vehicules'?form.designation:form.engin)||saving?'#9ca3af':'#fff',border:'none',borderRadius:10,fontWeight:700,cursor:'pointer',fontSize:14}}>
                {saving?'⏳ Enregistrement…':editTarget?'💾 Enregistrer':'➕ Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the component renders without error**

Run: `npm run build 2>&1 | tail -10`
Expected: build succeeds, no JSX errors.

- [ ] **Step 3: Commit**

```bash
git add src/ReferenceFiltres.jsx
git commit -m "feat: add ReferenceFiltres component with 2-tab table UI"
```

---

## Task 4 — Wire into App.jsx

**Files:**
- Modify: `src/App.jsx` (5 targeted edits)

- [ ] **Step 1: Add import**

Find line 4 of `src/App.jsx` (after the VueEclatee import):
```js
import VueEclatee from "./VueEclatee.jsx";
```
Add after it:
```js
import ReferenceFiltres from "./ReferenceFiltres.jsx";
```

- [ ] **Step 2: Add NAV_ALL entry**

Find the `vue_eclatee` line in NAV_ALL (~line 3581):
```js
  { id:"vue_eclatee",  label:"Vue éclatée", ...
```
Add after it:
```js
  { id:"ref_filtres", label:"Références filtres", icon:"🔩", roles:["admin","technicien","magasinier","preparateur","magasinier_preparateur","lecteur"], sites:["clmtp_sable","claisse_rail","stmf"] },
```

- [ ] **Step 3: Add MODULES_PERMISSIONS entry**

Find the `vue_eclatee` line in MODULES_PERMISSIONS (~line 3712):
```js
  { id:"vue_eclatee",  label:"Vue éclatée", ...
```
Add after it:
```js
  { id:"ref_filtres", label:"Références filtres", icon:"🔩", desc:"Références filtres véhicules et engins" },
```

- [ ] **Step 4: Update DEFAULT_PERMISSIONS**

Find the 5 non-admin role arrays (~line 3717-3721) and append `"ref_filtres"` to each:
```js
  technicien:             ["dashboard","stock","scanner","ordres","equivalences","vue_eclatee","ref_filtres"],
  magasinier:             ["dashboard","stock","scanner","mouvements","ordres","equivalences","vue_eclatee","ref_filtres"],
  preparateur:            ["dashboard","stock","scanner","ordres","location","pret","equivalences","vue_eclatee","ref_filtres"],
  magasinier_preparateur: ["dashboard","stock","scanner","mouvements","ordres","location","pret","equivalences","vue_eclatee","ref_filtres"],
  lecteur:                ["dashboard","stock","scanner","vue_eclatee","ref_filtres"],
```

- [ ] **Step 5: Add renderPage entry**

Find the vue_eclatee line in renderPage (~line 4287):
```js
    if(page==="vue_eclatee") return <VueEclatee user={user} siteId={siteId}/>;
```
Add after it:
```js
    if(page==="ref_filtres") return <ReferenceFiltres user={user}/>;
```

- [ ] **Step 6: Build and verify**

Run: `npm run build 2>&1 | tail -10`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "feat: register ref_filtres page in App.jsx navigation and routing"
```

---

## Task 5 — Push

- [ ] **Step 1: Push to both remotes**

```bash
git push origin master && git push netlify master
```
