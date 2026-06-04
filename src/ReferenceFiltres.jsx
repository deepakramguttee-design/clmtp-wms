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
  { key:'pneu',              label:'Pneu', noSplit:true },
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

  const cols    = tab === 'vehicules' ? VEH_COLS : ENG_COLS;
  const rows    = tab === 'vehicules' ? vehicules : engins;
  const nameKey = tab === 'vehicules' ? 'designation' : 'engin';

  const filtered = rows.filter(r => {
    const matchSearch = !search || r[nameKey]?.toLowerCase().includes(search.toLowerCase());
    const matchCat    = tab !== 'engins' || !catFilter || r.categorie === catFilter;
    return matchSearch && matchCat;
  });

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
                {cols.map(c=>{
                  const val=row[c.key];
                  if(!val) return <td key={c.key} style={tdStyle}>—</td>;
                  const parts=c.noSplit?[val]:val.split('/').map(p=>p.trim()).filter(Boolean);
                  if(parts.length<=1) return <td key={c.key} style={tdStyle}>{val}</td>;
                  return(
                    <td key={c.key} style={{...tdStyle,whiteSpace:'normal'}}>
                      <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                        {parts.map((p,i)=>(
                          <span key={i} style={{background:'#f3f4f6',fontFamily:'monospace',borderRadius:4,padding:'2px 6px',fontSize:11,color:'#374151',display:'inline-block'}}>
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                  );
                })}
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
