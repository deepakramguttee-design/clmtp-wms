import { useState, useEffect } from 'react';
import { supabase } from './supabase.js';
import { getVuesEclatees, addVueEclatee, updateVueEclatee, deleteVueEclatee } from './db.js';

const SITES_CONFIG = [
  { id: 'clmtp_sable',  label: 'CLMTP SABLÉ',  icon: '🏭', color: '#1e40af', bg: '#dbeafe' },
  { id: 'claisse_rail', label: 'CLAISSE RAIL',  icon: '🚂', color: '#065f46', bg: '#d1fae5' },
  { id: 'stmf',         label: 'STMF',          icon: '⚙️', color: '#7c3aed', bg: '#f3e8ff' },
];

const ACCEPTED_TYPES = { 'application/pdf': 'pdf', 'image/png': 'png' };

function isPdfUrl(url) {
  if (!url) return false;
  return url.split('?')[0].toLowerCase().endsWith('.pdf');
}

function Spinner() {
  return (
    <div style={{display:'flex',justifyContent:'center',padding:60}}>
      <div style={{width:32,height:32,border:'3px solid #e5e7eb',borderTop:'3px solid #111827',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
    </div>
  );
}

function PdfIcon({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect x="8" y="2" width="28" height="36" rx="3" fill="#fee2e2" stroke="#dc2626" strokeWidth="2"/>
      <path d="M28 2v10h10" stroke="#dc2626" strokeWidth="2" fill="none"/>
      <rect x="4" y="26" width="32" height="16" rx="3" fill="#dc2626"/>
      <text x="20" y="38" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="sans-serif">PDF</text>
    </svg>
  );
}

export default function VueEclatee({ user, siteId }) {
  const [equipements, setEquipements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ nom: '', description: '', site_id: siteId, file: null, fileType: null, filePreview: null, fileName: null });
  const [saving, setSaving] = useState(false);

  const canEdit = !!user;
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    getVuesEclatees().then(data => { setEquipements(data); setLoading(false); });
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { setLightbox(null); setShowForm(false); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const openAdd = (site) => {
    setEditTarget(null);
    setForm({ nom: '', description: '', site_id: site, file: null, fileType: null, filePreview: null, fileName: null });
    setShowForm(true);
  };

  const openEdit = (eq) => {
    setEditTarget(eq);
    setForm({ nom: eq.nom_equipement, description: eq.description || '', site_id: eq.site_id, file: null, fileType: null, filePreview: null, fileName: null });
    setShowForm(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fileType = ACCEPTED_TYPES[file.type];
    if (!fileType) {
      alert('Format non accepté. Veuillez sélectionner un fichier PDF ou PNG.');
      e.target.value = '';
      return;
    }
    const filePreview = fileType === 'png' ? URL.createObjectURL(file) : null;
    setForm(f => ({ ...f, file, fileType, filePreview, fileName: file.name }));
  };

  const handleSave = async () => {
    if (!form.nom || (!editTarget && !form.file)) return;
    setSaving(true);
    try {
      let image_url = editTarget?.image_url || null;

      if (form.file) {
        const safeName = form.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${form.site_id}/${Date.now()}_${safeName}`;
        const { error: uploadErr } = await supabase.storage.from('vues-eclatees').upload(path, form.file);
        if (uploadErr) {
          alert("Erreur lors de l'upload du fichier : " + uploadErr.message);
          return;
        }
        const { data: urlData } = supabase.storage.from('vues-eclatees').getPublicUrl(path);
        image_url = urlData.publicUrl;
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
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eq) => {
    if (!confirm(`Supprimer "${eq.nom_equipement}" ?`)) return;
    await deleteVueEclatee(eq.id);
    if (eq.image_url) {
      const parts = eq.image_url.split('/object/public/vues-eclatees/');
      if (parts[1]) {
        const storagePath = decodeURIComponent(parts[1].split('?')[0]);
        supabase.storage.from('vues-eclatees').remove([storagePath]);
      }
    }
    setEquipements(prev => prev.filter(e => e.id !== eq.id));
    if (lightbox?.id === eq.id) setLightbox(null);
  };

  const handleCardClick = (eq) => {
    if (!eq.image_url) return;
    if (isPdfUrl(eq.image_url)) {
      window.open(eq.image_url, '_blank');
    } else {
      setLightbox(eq);
    }
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
        {canEdit&&(
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
            {items.length===0?(
              <div style={{background:'#fff',borderRadius:14,border:'1px dashed #e5e7eb',padding:'32px 24px',textAlign:'center',color:'#9ca3af',fontSize:13}}>
                {canEdit
                  ?<><div style={{marginBottom:10}}>Aucun équipement pour ce site.</div><button onClick={()=>openAdd(site.id)} style={{padding:'8px 18px',background:'#f3f4f6',border:'none',borderRadius:9,fontWeight:600,cursor:'pointer',fontSize:13,color:'#374151'}}>+ Ajouter le premier équipement</button></>
                  :'Aucun équipement enregistré pour ce site.'}
              </div>
            ):(
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:16}}>
                {items.map(eq=>{
                  const isPdf = isPdfUrl(eq.image_url);
                  return (
                    <div key={eq.id} style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',overflow:'hidden',transition:'box-shadow 0.15s'}}
                      onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 20px rgba(0,0,0,0.1)'}
                      onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
                      <div onClick={()=>handleCardClick(eq)}
                        style={{aspectRatio:'4/3',background: isPdf?'#fef2f2':'#f3f4f6',overflow:'hidden',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,cursor:eq.image_url?'pointer':'default'}}>
                        {isPdf?(
                          <>
                            <PdfIcon size={48}/>
                            <span style={{fontSize:11,color:'#dc2626',fontWeight:600}}>Ouvrir le PDF</span>
                          </>
                        ):eq.image_url?(
                          <img src={eq.image_url} alt={eq.nom_equipement} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                        ):(
                          <span style={{fontSize:32,color:'#d1d5db'}}>🔧</span>
                        )}
                      </div>
                      <div style={{padding:'10px 14px'}}>
                        <div style={{fontWeight:700,fontSize:13,color:'#111827',marginBottom:4}}>{eq.nom_equipement}</div>
                        {eq.description&&<div style={{fontSize:11,color:'#6b7280',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{eq.description}</div>}
                        {canEdit&&(
                          <div style={{display:'flex',gap:6,marginTop:8}}>
                            <button onClick={()=>openEdit(eq)} style={{flex:1,padding:'5px',background:'#f3f4f6',border:'none',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:600}}>✏️ Modifier</button>
                            {isAdmin&&<button onClick={()=>handleDelete(eq)} style={{padding:'5px 8px',background:'#fee2e2',border:'none',borderRadius:7,cursor:'pointer',color:'#dc2626',fontSize:12}}>🗑</button>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Lightbox PNG */}
      {lightbox&&(
        <div onClick={()=>setLightbox(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20}}>
          <button onClick={()=>setLightbox(null)} style={{position:'absolute',top:20,right:20,background:'rgba(255,255,255,0.15)',border:'none',borderRadius:8,padding:'8px 14px',color:'#fff',cursor:'pointer',fontSize:18,fontWeight:700}}>✕</button>
          <div onClick={e=>e.stopPropagation()} style={{maxWidth:'90vw',maxHeight:'90vh',display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
            <img src={lightbox.image_url} alt={lightbox.nom_equipement} style={{maxWidth:'90vw',maxHeight:'75vh',objectFit:'contain',borderRadius:12}}/>
            <div style={{textAlign:'center',color:'#fff'}}>
              <div style={{fontWeight:800,fontSize:18}}>{lightbox.nom_equipement}</div>
              {lightbox.description&&<div style={{fontSize:13,color:'#9ca3af',marginTop:4}}>{lightbox.description}</div>}
              {canEdit&&(
                <div style={{display:'flex',gap:10,marginTop:12,justifyContent:'center'}}>
                  <button onClick={()=>{setLightbox(null);openEdit(lightbox);}} style={{padding:'8px 16px',background:'#374151',border:'none',borderRadius:9,color:'#fff',cursor:'pointer',fontWeight:600,fontSize:13}}>✏️ Modifier</button>
                  {isAdmin&&<button onClick={()=>handleDelete(lightbox)} style={{padding:'8px 16px',background:'#dc2626',border:'none',borderRadius:9,color:'#fff',cursor:'pointer',fontWeight:600,fontSize:13}}>🗑 Supprimer</button>}
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
                <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:5}}>
                  Fichier PDF ou PNG {editTarget?'(laisser vide pour conserver l\'existant)':'*'}
                </label>
                <label style={{display:'block',padding:'14px',background:'#f9fafb',border:'2px dashed #e5e7eb',borderRadius:10,textAlign:'center',cursor:'pointer',fontSize:13,color:'#6b7280'}}>
                  📄 Cliquez pour sélectionner un PDF ou PNG
                  <input type="file" accept=".pdf,.png" onChange={handleFileChange} style={{display:'none'}}/>
                </label>
                {/* Preview fichier sélectionné */}
                {form.file&&(
                  form.fileType==='png'?(
                    <img src={form.filePreview} alt="preview" style={{width:'100%',maxHeight:150,objectFit:'contain',borderRadius:10,marginTop:10,border:'1px solid #e5e7eb'}}/>
                  ):(
                    <div style={{display:'flex',alignItems:'center',gap:10,marginTop:10,padding:'10px 14px',background:'#fef2f2',borderRadius:10,border:'1px solid #fca5a5'}}>
                      <PdfIcon size={28}/>
                      <span style={{fontSize:12,color:'#dc2626',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{form.fileName}</span>
                    </div>
                  )
                )}
                {/* Indicateur fichier existant en édition */}
                {!form.file&&editTarget?.image_url&&(
                  <div style={{display:'flex',alignItems:'center',gap:10,marginTop:10,padding:'10px 14px',background:'#f3f4f6',borderRadius:10,border:'1px solid #e5e7eb'}}>
                    {isPdfUrl(editTarget.image_url)?<PdfIcon size={28}/>:<span style={{fontSize:20}}>🖼️</span>}
                    <span style={{fontSize:12,color:'#6b7280'}}>{isPdfUrl(editTarget.image_url)?'Fichier PDF existant conservé':'Image PNG existante conservée'}</span>
                  </div>
                )}
              </div>

              <div style={{display:'flex',gap:10,marginTop:6}}>
                <button onClick={()=>setShowForm(false)} style={{flex:1,padding:'12px',background:'#f3f4f6',border:'none',borderRadius:10,fontWeight:600,cursor:'pointer'}}>Annuler</button>
                <button onClick={handleSave} disabled={!form.nom||(!editTarget&&!form.file)||saving}
                  style={{flex:2,padding:'12px',background:!form.nom||(!editTarget&&!form.file)||saving?'#e5e7eb':'#111827',color:!form.nom||(!editTarget&&!form.file)||saving?'#9ca3af':'#fff',border:'none',borderRadius:10,fontWeight:700,cursor:'pointer',fontSize:14}}>
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
