import { useState, useEffect } from 'react';
import { supabase, getVueEclateeUrl, getVuesEclateesUrls } from './supabase.js';
import { getVuesEclatees, addVueEclatee, updateVueEclatee, deleteVueEclatee } from './db.js';

const SITES_CONFIG = [
  { id: 'clmtp_sable',  label: 'CLMTP SABLÉ',  icon: '🏭', color: '#1e40af', bg: '#dbeafe' },
  { id: 'claisse_rail', label: 'CLAISSE RAIL',  icon: '🚂', color: '#065f46', bg: '#d1fae5' },
  { id: 'stmf',         label: 'STMF',          icon: '⚙️', color: '#7c3aed', bg: '#f3e8ff' },
];

const ACCEPTED_TYPES = { 'application/pdf': 'pdf', 'image/png': 'png' };

// Documents PDF statiques intégrés (servis depuis public/docs/)
const STATIC_DOCS = [
  // ── CLMTP SABLÉ ──
  { id:'s-1',  nom_equipement:'Mécanisme porte arrière',          description:'Master mécanisme porte arrière 09/11/2022', site_id:'clmtp_sable',  image_url:'/docs/mecanique_porte_arriere.pdf',  static:true },
  { id:'s-2',  nom_equipement:'Éclaté bas-moteur TJ045E',         description:'LD-1P ECO — vue éclatée moteur',            site_id:'clmtp_sable',  image_url:'/docs/eclate_bas_moteur_TJ045E.pdf',  static:true },
  { id:'s-3',  nom_equipement:'Clé à choc Monster 1690 Nm',       description:'KS Tools — 1690 Nm',                        site_id:'clmtp_sable',  image_url:'/docs/cle_choc_monster_1690NM.pdf',   static:true },
  { id:'s-4',  nom_equipement:'Minipelle',                        description:'Documentation minipelle',                   site_id:'clmtp_sable',  image_url:'/docs/minipelle.pdf',                 static:true },
  { id:'s-5',  nom_equipement:'Part Selection',                   description:'Sélection de pièces',                       site_id:'clmtp_sable',  image_url:'/docs/part_selection.pdf',            static:true },
  { id:'s-6',  nom_equipement:'Riveteuse GP5791',                 description:'Documentation riveteuse GP5791',            site_id:'clmtp_sable',  image_url:'/docs/riveteuse_GP5791.pdf',          static:true },
  { id:'s-7',  nom_equipement:'Bourroir autonome 2T',             description:'Bourroir autonome 2 tonnes',                site_id:'clmtp_sable',  image_url:'/docs/bourroir_autonome_2T.pdf',      static:true },
  // ── CLAISSE RAIL ──
  { id:'s-8',  nom_equipement:'Lorry 51.12',                      description:'Documentation Lorry 51.12',                 site_id:'claisse_rail', image_url:'/docs/lorry_51_12.pdf',               static:true },
  { id:'s-9',  nom_equipement:'Groupe électrogène bourrage 1',    description:'Groupe électrogène pour bourrage — vol. 1', site_id:'claisse_rail', image_url:'/docs/groupe_electrogene_bourrage1.pdf', static:true },
  { id:'s-10', nom_equipement:'Groupe électrogène bourrage 2',    description:'Groupe électrogène pour bourrage — vol. 2', site_id:'claisse_rail', image_url:'/docs/groupe_electrogene_bourrage2.pdf', static:true },
  { id:'s-11', nom_equipement:'Bourrage électrique Robel',        description:'Groupe de bourrage électrique Robel',       site_id:'claisse_rail', image_url:'/docs/bourrage_electrique_robel.pdf', static:true },
  { id:'s-12', nom_equipement:'Robel 5401 ED',                    description:'ET Robel 5401ED',                           site_id:'claisse_rail', image_url:'/docs/robel_5401ED.pdf',              static:true },
  { id:'s-13', nom_equipement:'Portique à rail',                  description:'Documentation portique à rail',             site_id:'claisse_rail', image_url:'/docs/portique_a_rail.pdf',           static:true },
];

function isPdfUrl(url) {
  if (!url) return false;
  return url.split('?')[0].toLowerCase().endsWith('.pdf');
}

// Résout image_url en chemin de stockage (bucket privé) à signer, ou null si
// c'est un fichier local/externe à ouvrir directement.
// - STATIC_DOCS : "/docs/xxx.pdf"                     → null (servi en statique)
// - preview local : "blob:..."                        → null
// - nouveau format en base : "clmtp_sable/xxx.pdf"    → chemin de stockage
// - ancien format (URL publique/signée complète)      → chemin extrait de l'URL
function toStoragePath(url) {
  if (!url) return null;
  if (url.startsWith('/') || url.startsWith('blob:')) return null;
  const publicMarker = '/object/public/vues-eclatees/';
  const signMarker = '/object/sign/vues-eclatees/';
  for (const marker of [publicMarker, signMarker]) {
    const idx = url.indexOf(marker);
    if (idx !== -1) return decodeURIComponent(url.slice(idx + marker.length).split('?')[0]);
  }
  if (url.startsWith('http')) return null; // URL externe inconnue → laisser tel quel
  return url; // chemin relatif déjà stocké
}

function Spinner() {
  return (
    <div style={{display:'flex',justifyContent:'center',padding:60}}>
      <div style={{width:32,height:32,border:'3px solid #e0e0d8',borderTop:'3px solid #1e2330',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
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
  const [signedUrls, setSignedUrls] = useState({}); // { [equipementId]: signedUrl } — vignettes PNG signées
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ nom: '', description: '', site_id: siteId, file: null, fileType: null, filePreview: null, fileName: null });
  const [saving, setSaving] = useState(false);

  const canEdit = !!user;
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await getVuesEclatees();
      if (cancelled) return;
      setEquipements(data);
      setLoading(false);

      // Les vignettes PNG s'affichent toutes en même temps → on signe en batch
      // (createSignedUrls) pour éviter un appel réseau par ligne. Les PDF, eux,
      // sont signés à la demande au clic (voir handleCardClick).
      const pngItems = data.filter(eq => !isPdfUrl(eq.image_url) && toStoragePath(eq.image_url));
      if (pngItems.length === 0) return;
      try {
        const paths = [...new Set(pngItems.map(eq => toStoragePath(eq.image_url)))];
        const urlMap = await getVuesEclateesUrls(paths);
        if (cancelled) return;
        const byId = {};
        for (const eq of pngItems) {
          const p = toStoragePath(eq.image_url);
          if (urlMap.has(p)) byId[eq.id] = urlMap.get(p);
        }
        setSignedUrls(prev => ({ ...prev, ...byId }));
      } catch (err) {
        console.error('Échec de génération des URLs signées (vignettes) :', err);
      }
    })();
    return () => { cancelled = true; };
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
        // Bucket privé : on stocke le chemin relatif, l'URL sera signée à l'affichage.
        image_url = path;
      }

      const payload = { nom_equipement: form.nom, description: form.description, site_id: form.site_id, image_url };

      let savedId = editTarget?.id || null;
      if (editTarget) {
        await updateVueEclatee(editTarget.id, payload);
        setEquipements(prev => prev.map(e => e.id === editTarget.id ? { ...e, ...payload } : e));
      } else {
        const saved = await addVueEclatee(payload);
        if (saved) { setEquipements(prev => [...prev, saved]); savedId = saved.id; }
      }

      // Signer immédiatement la nouvelle vignette PNG pour un affichage direct.
      if (form.file && form.fileType === 'png' && savedId) {
        try {
          const signed = await getVueEclateeUrl(image_url);
          setSignedUrls(prev => ({ ...prev, [savedId]: signed }));
        } catch (err) {
          console.error('Échec de signature de la nouvelle vignette :', err);
        }
      }
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eq) => {
    if (!confirm(`Supprimer "${eq.nom_equipement}" ?`)) return;
    await deleteVueEclatee(eq.id);
    const storagePath = toStoragePath(eq.image_url);
    if (storagePath) {
      try {
        await supabase.storage.from('vues-eclatees').remove([storagePath]);
      } catch (err) {
        console.error('Échec de suppression du fichier dans le stockage :', err);
      }
    }
    setEquipements(prev => prev.filter(e => e.id !== eq.id));
    if (lightbox?.id === eq.id) setLightbox(null);
  };

  const handleCardClick = async (eq) => {
    if (!eq.image_url) return;
    if (isPdfUrl(eq.image_url)) {
      const path = toStoragePath(eq.image_url);
      if (!path) { window.open(eq.image_url, '_blank', 'noopener'); return; } // PDF statique /docs
      // Bucket privé : URL signée générée à la demande, au clic.
      try {
        const url = await getVueEclateeUrl(path);
        window.open(url, '_blank', 'noopener');
      } catch (err) {
        console.error("Échec d'ouverture du PDF :", err);
        alert("Impossible d'ouvrir le document pour le moment. Veuillez réessayer.");
      }
    } else {
      setLightbox(eq);
    }
  };

  if (loading) return <Spinner />;

  const total = equipements.length + STATIC_DOCS.length;

  return (
    <div style={{display:'flex',flexDirection:'column',gap:24}}>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:900,color:'#1e2330',margin:0}}>Vue éclatée</h1>
          <p style={{color:'#6b7280',fontSize:13,margin:'4px 0 0'}}>{total} équipement{total!==1?'s':''} · 3 sites</p>
        </div>
        {canEdit&&(
          <button onClick={()=>openAdd(siteId)} style={{background:'#1e2330',color:'#fff',border:'none',borderRadius:10,padding:'9px 18px',fontWeight:700,cursor:'pointer',fontSize:13}}>
            + Ajouter équipement
          </button>
        )}
      </div>

      {/* Site sections */}
      {SITES_CONFIG.map(site=>{
        const items=[
          ...STATIC_DOCS.filter(d=>d.site_id===site.id),
          ...equipements.filter(e=>e.site_id===site.id),
        ];
        return (
          <div key={site.id}>
            {items.length===0?(
              <div style={{background:'#fff',borderRadius:14,border:'1px dashed #e5e7eb',padding:'32px 24px',textAlign:'center',color:'#9ca3af',fontSize:13}}>
                {canEdit
                  ?<><div style={{marginBottom:10}}>Aucun équipement pour ce site.</div><button onClick={()=>openAdd(site.id)} style={{padding:'8px 18px',background:'#f3f4f6',border:'none',borderRadius:9,fontWeight:600,cursor:'pointer',fontSize:13,color:'#555'}}>+ Ajouter le premier équipement</button></>
                  :'Aucun équipement enregistré pour ce site.'}
              </div>
            ):(
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:16}}>
                {items.map(eq=>{
                  const isPdf = isPdfUrl(eq.image_url);
                  // URL d'affichage : vignette signée si dispo, sinon fichier local/statique direct.
                  const imgSrc = signedUrls[eq.id] || (toStoragePath(eq.image_url) ? null : eq.image_url);
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
                        ):imgSrc?(
                          <img src={imgSrc} alt={eq.nom_equipement} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                        ):(
                          <span style={{fontSize:32,color:'#d1d5db'}}>🔧</span>
                        )}
                      </div>
                      <div style={{padding:'10px 14px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                          <div style={{fontWeight:700,fontSize:13,color:'#1e2330',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{eq.nom_equipement}</div>
                          {eq.static&&<span style={{fontSize:9,background:'#f3e8ff',color:'#7c3aed',padding:'1px 5px',borderRadius:99,fontWeight:700,flexShrink:0}}>📎</span>}
                        </div>
                        {eq.description&&<div style={{fontSize:11,color:'#6b7280',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{eq.description}</div>}
                        {canEdit&&!eq.static&&(
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
            <img src={signedUrls[lightbox.id] || (toStoragePath(lightbox.image_url) ? null : lightbox.image_url)} alt={lightbox.nom_equipement} style={{maxWidth:'90vw',maxHeight:'75vh',objectFit:'contain',borderRadius:12}}/>
            <div style={{textAlign:'center',color:'#fff'}}>
              <div style={{fontWeight:800,fontSize:18}}>{lightbox.nom_equipement}</div>
              {lightbox.description&&<div style={{fontSize:13,color:'#9ca3af',marginTop:4}}>{lightbox.description}</div>}
              {canEdit&&(
                <div style={{display:'flex',gap:10,marginTop:12,justifyContent:'center'}}>
                  <button onClick={()=>{setLightbox(null);openEdit(lightbox);}} style={{padding:'8px 16px',background:'#555',border:'none',borderRadius:9,color:'#fff',cursor:'pointer',fontWeight:600,fontSize:13}}>✏️ Modifier</button>
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
              <h2 style={{fontSize:18,fontWeight:800,color:'#1e2330',margin:0}}>{editTarget?'✏️ Modifier':'➕ Ajouter'} un équipement</h2>
              <button onClick={()=>setShowForm(false)} style={{background:'#f3f4f6',border:'none',borderRadius:8,padding:'6px 12px',cursor:'pointer',fontSize:16}}>✕</button>
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:'#555',display:'block',marginBottom:5}}>Nom *</label>
                <input value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))} placeholder="Ex: Moteur DEUTZ 2013"
                  style={{width:'100%',padding:'10px 14px',border:'1px solid #e5e7eb',borderRadius:10,fontSize:13,outline:'none',boxSizing:'border-box'}}/>
              </div>

              <div>
                <label style={{fontSize:12,fontWeight:600,color:'#555',display:'block',marginBottom:5}}>Site *</label>
                <select value={form.site_id} onChange={e=>setForm(f=>({...f,site_id:e.target.value}))}
                  style={{width:'100%',padding:'10px 14px',border:'1px solid #e5e7eb',borderRadius:10,fontSize:13,outline:'none',boxSizing:'border-box'}}>
                  {SITES_CONFIG.map(s=><option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
                </select>
              </div>

              <div>
                <label style={{fontSize:12,fontWeight:600,color:'#555',display:'block',marginBottom:5}}>Description</label>
                <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Référence, modèle, notes…" rows={3}
                  style={{width:'100%',padding:'10px 14px',border:'1px solid #e5e7eb',borderRadius:10,fontSize:13,outline:'none',boxSizing:'border-box',resize:'vertical',fontFamily:'inherit'}}/>
              </div>

              <div>
                <label style={{fontSize:12,fontWeight:600,color:'#555',display:'block',marginBottom:5}}>
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
                  style={{flex:2,padding:'12px',background:!form.nom||(!editTarget&&!form.file)||saving?'#e0e0d8':'#1e2330',color:!form.nom||(!editTarget&&!form.file)||saving?'#9ca3af':'#fff',border:'none',borderRadius:10,fontWeight:700,cursor:'pointer',fontSize:14}}>
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
