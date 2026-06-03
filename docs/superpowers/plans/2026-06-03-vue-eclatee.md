# Vue éclatée — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Vue éclatée" page to the WMS that shows exploded-view diagrams for equipment across all 3 sites, with admin-only upload/edit/delete and read-only access for all other roles.

**Architecture:** New standalone component `src/VueEclatee.jsx` (consistent with `AdminDashboard.jsx` pattern). Four CRUD helpers added to the end of `src/db.js`. Five targeted edits to `src/App.jsx` (import, nav, permissions, routing). Supabase Storage bucket `vues-eclatees` (public) stores the images; `image_url` in the `vues_eclatees` table holds the public URL.

**Tech Stack:** React 18, Vite, Supabase JS v2 (DB + Storage), SheetJS already loaded (not used here), DM Sans font already loaded globally.

---

## File Map

| Action | File | What changes |
|--------|------|-------------|
| Create | `src/VueEclatee.jsx` | Full new component (UI, upload, lightbox, CRUD) |
| Modify | `src/db.js` | Append 4 CRUD helpers at end of file (after line 743) |
| Modify | `src/App.jsx:3` | Add import for VueEclatee |
| Modify | `src/App.jsx:21` | Add db imports for 4 new helpers |
| Modify | `src/App.jsx:3579` | Add entry to `NAV_ALL` |
| Modify | `src/App.jsx:3700` | Add entry to `MODULES_PERMISSIONS` |
| Modify | `src/App.jsx:3712` | Add `"vue_eclatee"` to each non-admin role in `DEFAULT_PERMISSIONS` |
| Modify | `src/App.jsx:4258` | Add case to `renderPage()` |

---

## Task 1: Create Supabase table + Storage bucket

**Files:** Supabase SQL editor (browser), Supabase Dashboard Storage tab

- [ ] **Step 1: Run SQL in the Supabase SQL editor**

Navigate to your Supabase project → SQL Editor → New query. Paste and run:

```sql
CREATE TABLE IF NOT EXISTS vues_eclatees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id text NOT NULL CHECK (site_id IN ('clmtp_sable','claisse_rail','stmf')),
  nom_equipement text NOT NULL,
  description text,
  image_url text,
  ordre int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vues_eclatees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lecture_vues_eclatees"
  ON vues_eclatees FOR SELECT USING (true);

CREATE POLICY "ecriture_vues_eclatees"
  ON vues_eclatees FOR ALL USING (true) WITH CHECK (true);
```

Expected: "Success. No rows returned."

- [ ] **Step 2: Create Storage bucket**

Navigate to Supabase Dashboard → Storage → New bucket.
- Name: `vues-eclatees`
- Public: **ON** (toggle)
- Click "Create bucket"

Expected: bucket `vues-eclatees` appears in the list with a "Public" badge.

- [ ] **Step 3: Verify table exists**

In SQL Editor run: `SELECT * FROM vues_eclatees LIMIT 1;`
Expected: empty result set, no error.

---

## Task 2: Add CRUD helpers to `src/db.js`

**Files:**
- Modify: `src/db.js` (append after line 743)

- [ ] **Step 1: Append the 4 helpers at the end of `src/db.js`**

Open `src/db.js`. After the last line (743), add:

```js
// ── VUES ÉCLATÉES ─────────────────────────────────────────────────────────────
export async function getVuesEclatees() {
  const { data, error } = await supabase
    .from('vues_eclatees')
    .select('*')
    .order('site_id')
    .order('ordre')
    .order('created_at')
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function addVueEclatee(payload) {
  const { data, error } = await supabase
    .from('vues_eclatees')
    .insert([{
      site_id: payload.site_id,
      nom_equipement: payload.nom_equipement,
      description: payload.description || null,
      image_url: payload.image_url || null,
      ordre: payload.ordre || 0,
    }])
    .select()
  if (error) { console.error(error); return null; }
  return data?.[0];
}

export async function updateVueEclatee(id, payload) {
  const { error } = await supabase
    .from('vues_eclatees')
    .update({
      nom_equipement: payload.nom_equipement,
      description: payload.description || null,
      image_url: payload.image_url || null,
    })
    .eq('id', id)
  if (error) console.error(error);
}

export async function deleteVueEclatee(id) {
  const { error } = await supabase
    .from('vues_eclatees')
    .delete()
    .eq('id', id)
  if (error) console.error(error);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/db.js
git commit -m "feat: add vues_eclatees CRUD helpers to db.js"
```

---

## Task 3: Create `src/VueEclatee.jsx`

**Files:**
- Create: `src/VueEclatee.jsx`

- [ ] **Step 1: Create the file with full content**

Create `src/VueEclatee.jsx` with this complete content:

```jsx
import { useState, useEffect } from 'react';
import { supabase } from './supabase.js';
import { getVuesEclatees, addVueEclatee, updateVueEclatee, deleteVueEclatee } from './db.js';

const SITES_CONFIG = [
  { id: 'clmtp_sable',  label: 'CLMTP SABLÉ',  icon: '🏭', color: '#1e40af', bg: '#dbeafe' },
  { id: 'claisse_rail', label: 'CLAISSE RAIL',  icon: '🚂', color: '#065f46', bg: '#d1fae5' },
  { id: 'stmf',         label: 'STMF',          icon: '⚙️', color: '#7c3aed', bg: '#f3e8ff' },
];

function Spinner() {
  return (
    <div style={{display:'flex',justifyContent:'center',padding:60}}>
      <div style={{width:32,height:32,border:'3px solid #e5e7eb',borderTop:'3px solid #111827',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
    </div>
  );
}

export default function VueEclatee({ user, siteId }) {
  const [equipements, setEquipements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ nom: '', description: '', site_id: siteId, imageFile: null, imagePreview: null });
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    getVuesEclatees().then(data => { setEquipements(data); setLoading(false); });
  }, []);

  const openAdd = (site) => {
    setEditTarget(null);
    setForm({ nom: '', description: '', site_id: site, imageFile: null, imagePreview: null });
    setShowForm(true);
  };

  const openEdit = (eq) => {
    setEditTarget(eq);
    setForm({ nom: eq.nom_equipement, description: eq.description || '', site_id: eq.site_id, imageFile: null, imagePreview: eq.image_url });
    setShowForm(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setForm(f => ({ ...f, imageFile: file, imagePreview: URL.createObjectURL(file) }));
  };

  const handleSave = async () => {
    if (!form.nom || (!editTarget && !form.imageFile)) return;
    setSaving(true);
    let image_url = editTarget?.image_url || null;

    if (form.imageFile) {
      const safeName = form.imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${form.site_id}/${Date.now()}_${safeName}`;
      const { error: uploadErr } = await supabase.storage.from('vues-eclatees').upload(path, form.imageFile);
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('vues-eclatees').getPublicUrl(path);
        image_url = urlData.publicUrl;
      }
    }

    const payload = { nom_equipement: form.nom, description: form.description, site_id: form.site_id, image_url };

    if (editTarget) {
      await updateVueEclatee(editTarget.id, payload);
      setEquipements(prev => prev.map(e => e.id === editTarget.id ? { ...e, ...payload } : e));
    } else {
      const saved = await addVueEclatee(payload);
      if (saved) setEquipements(prev => [...prev, saved]);
    }
    setShowForm(false);
    setSaving(false);
  };

  const handleDelete = async (eq) => {
    if (!confirm(`Supprimer "${eq.nom_equipement}" ?`)) return;
    await deleteVueEclatee(eq.id);
    if (eq.image_url) {
      const parts = eq.image_url.split('/object/public/vues-eclatees/');
      if (parts[1]) supabase.storage.from('vues-eclatees').remove([decodeURIComponent(parts[1])]);
    }
    setEquipements(prev => prev.filter(e => e.id !== eq.id));
    if (lightbox?.id === eq.id) setLightbox(null);
  };

  if (loading) return <Spinner />;

  const total = equipements.length;

  return (
    <div style={{display:'flex',flexDirection:'column',gap:24}}>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:900,color:'#111827',margin:0}}>Vue éclatée</h1>
          <p style={{color:'#6b7280',fontSize:13,margin:'4px 0 0'}}>{total} équipement{total!==1?'s':''} · 3 sites</p>
        </div>
        {isAdmin&&(
          <button onClick={()=>openAdd(siteId)} style={{background:'#111827',color:'#fff',border:'none',borderRadius:10,padding:'9px 18px',fontWeight:700,cursor:'pointer',fontSize:13}}>
            + Ajouter équipement
          </button>
        )}
      </div>

      {/* Site sections */}
      {SITES_CONFIG.map(site=>{
        const items=equipements.filter(e=>e.site_id===site.id);
        return (
          <div key={site.id}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
              <span style={{background:site.bg,color:site.color,borderRadius:8,padding:'4px 14px',fontWeight:800,fontSize:13}}>{site.icon} {site.label}</span>
              <span style={{fontSize:12,color:'#9ca3af'}}>{items.length} équipement{items.length!==1?'s':''}</span>
            </div>

            {items.length===0?(
              <div style={{background:'#fff',borderRadius:14,border:'1px dashed #e5e7eb',padding:'32px 24px',textAlign:'center',color:'#9ca3af',fontSize:13}}>
                {isAdmin
                  ?<><div style={{marginBottom:10}}>Aucun équipement pour ce site.</div><button onClick={()=>openAdd(site.id)} style={{padding:'8px 18px',background:'#f3f4f6',border:'none',borderRadius:9,fontWeight:600,cursor:'pointer',fontSize:13,color:'#374151'}}>+ Ajouter le premier équipement</button></>
                  :'Aucun équipement enregistré pour ce site.'}
              </div>
            ):(
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:16}}>
                {items.map(eq=>(
                  <div key={eq.id} style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',overflow:'hidden',cursor:'pointer',transition:'box-shadow 0.15s'}}
                    onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 20px rgba(0,0,0,0.1)'}
                    onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}
                    onClick={()=>setLightbox(eq)}>
                    <div style={{aspectRatio:'4/3',background:'#f3f4f6',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {eq.image_url
                        ?<img src={eq.image_url} alt={eq.nom_equipement} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                        :<span style={{fontSize:32,color:'#d1d5db'}}>🔧</span>}
                    </div>
                    <div style={{padding:'10px 14px'}}>
                      <div style={{fontWeight:700,fontSize:13,color:'#111827',marginBottom:4}}>{eq.nom_equipement}</div>
                      {eq.description&&<div style={{fontSize:11,color:'#6b7280',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{eq.description}</div>}
                      {isAdmin&&(
                        <div style={{display:'flex',gap:6,marginTop:8}} onClick={e=>e.stopPropagation()}>
                          <button onClick={()=>openEdit(eq)} style={{flex:1,padding:'5px',background:'#f3f4f6',border:'none',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:600}}>✏️ Modifier</button>
                          <button onClick={()=>handleDelete(eq)} style={{padding:'5px 8px',background:'#fee2e2',border:'none',borderRadius:7,cursor:'pointer',color:'#dc2626',fontSize:12}}>🗑</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Lightbox */}
      {lightbox&&(
        <div onClick={()=>setLightbox(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20}}>
          <button onClick={()=>setLightbox(null)} style={{position:'absolute',top:20,right:20,background:'rgba(255,255,255,0.15)',border:'none',borderRadius:8,padding:'8px 14px',color:'#fff',cursor:'pointer',fontSize:18,fontWeight:700}}>✕</button>
          <div onClick={e=>e.stopPropagation()} style={{maxWidth:'90vw',maxHeight:'90vh',display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
            {lightbox.image_url
              ?<img src={lightbox.image_url} alt={lightbox.nom_equipement} style={{maxWidth:'90vw',maxHeight:'75vh',objectFit:'contain',borderRadius:12}}/>
              :<div style={{width:300,height:200,background:'#374151',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontSize:48}}>🔧</div>}
            <div style={{textAlign:'center',color:'#fff'}}>
              <div style={{fontWeight:800,fontSize:18}}>{lightbox.nom_equipement}</div>
              {lightbox.description&&<div style={{fontSize:13,color:'#9ca3af',marginTop:4}}>{lightbox.description}</div>}
              {isAdmin&&(
                <div style={{display:'flex',gap:10,marginTop:12,justifyContent:'center'}}>
                  <button onClick={()=>{setLightbox(null);openEdit(lightbox);}} style={{padding:'8px 16px',background:'#374151',border:'none',borderRadius:9,color:'#fff',cursor:'pointer',fontWeight:600,fontSize:13}}>✏️ Modifier</button>
                  <button onClick={()=>handleDelete(lightbox)} style={{padding:'8px 16px',background:'#dc2626',border:'none',borderRadius:9,color:'#fff',cursor:'pointer',fontWeight:600,fontSize:13}}>🗑 Supprimer</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajout / Édition */}
      {showForm&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,backdropFilter:'blur(2px)',padding:16}}>
          <div style={{background:'#fff',borderRadius:20,padding:32,width:'min(96vw,480px)',maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
              <h2 style={{fontSize:18,fontWeight:800,color:'#111827',margin:0}}>{editTarget?'✏️ Modifier':'➕ Ajouter'} un équipement</h2>
              <button onClick={()=>setShowForm(false)} style={{background:'#f3f4f6',border:'none',borderRadius:8,padding:'6px 12px',cursor:'pointer',fontSize:16}}>✕</button>
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:5}}>Nom *</label>
                <input value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))} placeholder="Ex: Moteur DEUTZ 2013"
                  style={{width:'100%',padding:'10px 14px',border:'1px solid #e5e7eb',borderRadius:10,fontSize:13,outline:'none',boxSizing:'border-box'}}/>
              </div>

              <div>
                <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:5}}>Site *</label>
                <select value={form.site_id} onChange={e=>setForm(f=>({...f,site_id:e.target.value}))}
                  style={{width:'100%',padding:'10px 14px',border:'1px solid #e5e7eb',borderRadius:10,fontSize:13,outline:'none',boxSizing:'border-box'}}>
                  {SITES_CONFIG.map(s=><option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
                </select>
              </div>

              <div>
                <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:5}}>Description</label>
                <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Référence, modèle, notes…" rows={3}
                  style={{width:'100%',padding:'10px 14px',border:'1px solid #e5e7eb',borderRadius:10,fontSize:13,outline:'none',boxSizing:'border-box',resize:'vertical',fontFamily:'inherit'}}/>
              </div>

              <div>
                <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:5}}>Image {editTarget?'(laisser vide pour conserver l\'existante)':'*'}</label>
                <label style={{display:'block',padding:'14px',background:'#f9fafb',border:'2px dashed #e5e7eb',borderRadius:10,textAlign:'center',cursor:'pointer',fontSize:13,color:'#6b7280'}}>
                  📁 Cliquez pour sélectionner une image
                  <input type="file" accept="image/*" onChange={handleImageChange} style={{display:'none'}}/>
                </label>
                {form.imagePreview&&(
                  <img src={form.imagePreview} alt="preview" style={{width:'100%',maxHeight:150,objectFit:'contain',borderRadius:10,marginTop:10,border:'1px solid #e5e7eb'}}/>
                )}
              </div>

              <div style={{display:'flex',gap:10,marginTop:6}}>
                <button onClick={()=>setShowForm(false)} style={{flex:1,padding:'12px',background:'#f3f4f6',border:'none',borderRadius:10,fontWeight:600,cursor:'pointer'}}>Annuler</button>
                <button onClick={handleSave} disabled={!form.nom||(!editTarget&&!form.imageFile)||saving}
                  style={{flex:2,padding:'12px',background:!form.nom||(!editTarget&&!form.imageFile)||saving?'#e5e7eb':'#111827',color:!form.nom||(!editTarget&&!form.imageFile)||saving?'#9ca3af':'#fff',border:'none',borderRadius:10,fontWeight:700,cursor:'pointer',fontSize:14}}>
                  {saving?'⏳ Enregistrement…':editTarget?'💾 Enregistrer':'➕ Ajouter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/VueEclatee.jsx
git commit -m "feat: add VueEclatee component"
```

---

## Task 4: Wire VueEclatee into `src/App.jsx`

**Files:**
- Modify: `src/App.jsx` (5 edits)

> All line numbers reference the file **before** this task's edits. Apply top-to-bottom.

- [ ] **Step 1: Add import for VueEclatee (after line 3, after AdminDashboard import)**

Current line 3:
```js
import AdminDashboard from "./AdminDashboard.jsx";
```

Change to:
```js
import AdminDashboard from "./AdminDashboard.jsx";
import VueEclatee from "./VueEclatee.jsx";
```

- [ ] **Step 2: Add db imports for the 4 new helpers (after line 21, inside the existing `from "./db.js"` block)**

Current lines 20-22:
```js
  getPermissions, savePermissions, deletePermissions,
} from "./db.js";
```

Change to:
```js
  getPermissions, savePermissions, deletePermissions,
  getVuesEclatees, addVueEclatee, updateVueEclatee, deleteVueEclatee,
} from "./db.js";
```

> Note: `getVuesEclatees`, `addVueEclatee`, `updateVueEclatee`, `deleteVueEclatee` are imported here so Vite bundles them, but they are actually called inside `VueEclatee.jsx` via its own import. This import is only needed if App.jsx itself ever calls them directly (e.g. for pre-loading). Since VueEclatee.jsx imports them directly, you can skip this step — the component handles its own imports. **Skip step 2, it is not needed.**

- [ ] **Step 3: Add entry to `NAV_ALL` (after the `equivalences` entry, around line 3580)**

Find this line in `NAV_ALL`:
```js
  { id:"equivalences", label:"Équivalences",         icon:"↔️", roles:["admin","technicien","magasinier","preparateur","magasinier_preparateur"], sites:["clmtp_sable","claisse_rail","stmf"] },
```

Add the new entry **after** it:
```js
  { id:"vue_eclatee",  label:"Vue éclatée",           icon:"🔍", roles:["admin","technicien","magasinier","preparateur","magasinier_preparateur","lecteur"], sites:["clmtp_sable","claisse_rail","stmf"] },
```

- [ ] **Step 4: Add entry to `MODULES_PERMISSIONS` (around line 3709)**

Find the last entry of `MODULES_PERMISSIONS`:
```js
  { id:"catalogue",    label:"Catalogue articles",   icon:"📋", desc:"Import catalogue Excel" },
```

Add after it (before the closing `];`):
```js
  { id:"vue_eclatee",  label:"Vue éclatée",          icon:"🔍", desc:"Schémas éclatés des équipements" },
```

- [ ] **Step 5: Add `"vue_eclatee"` to `DEFAULT_PERMISSIONS` for all non-admin roles (around line 3712)**

Current:
```js
const DEFAULT_PERMISSIONS = {
  admin:                  null,
  technicien:             ["dashboard","stock","scanner","ordres","equivalences"],
  magasinier:             ["dashboard","stock","scanner","mouvements","ordres","equivalences"],
  preparateur:            ["dashboard","stock","scanner","ordres","location","pret","equivalences"],
  magasinier_preparateur: ["dashboard","stock","scanner","mouvements","ordres","location","pret","equivalences"],
  lecteur:                ["dashboard","stock","scanner"],
};
```

Change to:
```js
const DEFAULT_PERMISSIONS = {
  admin:                  null,
  technicien:             ["dashboard","stock","scanner","ordres","equivalences","vue_eclatee"],
  magasinier:             ["dashboard","stock","scanner","mouvements","ordres","equivalences","vue_eclatee"],
  preparateur:            ["dashboard","stock","scanner","ordres","location","pret","equivalences","vue_eclatee"],
  magasinier_preparateur: ["dashboard","stock","scanner","mouvements","ordres","location","pret","equivalences","vue_eclatee"],
  lecteur:                ["dashboard","stock","scanner","vue_eclatee"],
};
```

- [ ] **Step 6: Add case to `renderPage()` (after the `prix` case, around line 4258)**

Find:
```js
    if(page==="prix")      return <GestionPrix prixFournisseurs={prixFournisseurs} setPrixFournisseurs={setPrixFournisseurs} historiquePrix={historiquePrix} setHistoriquePrix={setHistoriquePrix} products={ALL_SITE_PRODUCTS}/>;
```

Add after it:
```js
    if(page==="vue_eclatee") return <VueEclatee user={user} siteId={siteId}/>;
```

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire VueEclatee into App navigation and routing"
```

---

## Task 5: Browser verification

**Files:** No code changes — visual verification only.

The dev server from the previous session may still be running. If not:
```bash
npm run dev
```

- [ ] **Step 1: Verify the nav entry appears**

Login as admin (deepak.ramguttee@gmail.com), select CLMTP SABLÉ.
Expected: "🔍 Vue éclatée" appears in the left sidebar.

- [ ] **Step 2: Verify empty state renders correctly**

Click "Vue éclatée" in the sidebar.
Expected:
- Page title "Vue éclatée" with "0 équipements · 3 sites"
- 3 site sections: CLMTP SABLÉ, CLAISSE RAIL, STMF
- Each section shows "Aucun équipement pour ce site." + "Ajouter le premier équipement" button (admin)
- "+ Ajouter équipement" button in top-right header

- [ ] **Step 3: Add an equipment with image upload**

Click "+ Ajouter équipement".
- Fill Nom: "Moteur test"
- Select site: CLMTP SABLÉ
- Add description: "Test description"
- Select any image file (jpg/png)
- Click "➕ Ajouter"

Expected:
- Modal closes
- Equipment card appears in the CLMTP SABLÉ section with thumbnail
- Counter updates: "1 équipement · 3 sites"

- [ ] **Step 4: Test lightbox**

Click the equipment card.
Expected:
- Dark overlay appears
- Image displays large (max 90vw × 75vh)
- Nom and description shown below
- Admin sees "✏️ Modifier" and "🗑 Supprimer" buttons
- Click overlay or ✕ closes lightbox

- [ ] **Step 5: Test edit**

Click ✏️ on the card.
Expected:
- Modal opens pre-filled with current name, description, site
- Image preview shows current image
- Change name, leave image blank, click "💾 Enregistrer"
- Card updates with new name, image unchanged

- [ ] **Step 6: Test delete**

Click 🗑 on a card, confirm.
Expected: card disappears from the grid, counter decrements.

- [ ] **Step 7: Test read-only access**

Log out, log back in as a non-admin user (or create one temporarily).
Navigate to Vue éclatée.
Expected:
- Page loads with equipment visible
- No "+ Ajouter équipement" button
- No ✏️ / 🗑 buttons on cards
- Lightbox works but shows no admin buttons

- [ ] **Step 8: Final commit if any fixes were needed**

```bash
git add -p
git commit -m "fix: vue eclatee browser verification fixes"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Visible dans nav pour tous les rôles | Task 4 step 3 (NAV_ALL) + step 5 (DEFAULT_PERMISSIONS) |
| Organisé par site (3 sections) | Task 3 — SITES_CONFIG + section rendering |
| Plusieurs équipements par site, nom + image | Task 3 — card grid |
| Upload image → Supabase Storage | Task 1 (bucket) + Task 3 (handleSave upload logic) |
| Affichage image en grand au clic | Task 3 — lightbox |
| Ajout/modif/suppression admin only | Task 3 — `isAdmin` guard on all mutation UI |
| Autres rôles : consultation uniquement | Task 3 — no form/delete buttons if !isAdmin |
| Nouveau composant src/VueEclatee.jsx | Task 3 |
| Table Supabase vues_eclatees | Task 1 |
| Style cohérent WMS | Task 3 — same colors, fonts, border-radius |
| MODULES_PERMISSIONS entry | Task 4 step 4 |
| renderPage() case | Task 4 step 6 |

All spec requirements covered. ✓
