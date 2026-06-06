import { useState, useEffect } from "react";
import {
  createParcVehicule, updateParcVehicule, deleteParcVehicule,
  getParcCategories, createParcCategorie, updateParcCategorie, deleteParcCategorie,
} from "../db.js";

const AFFECTATIONS = ["CLMTP", "CLAISSE RAIL", "STMF", ""];
const FORM_EMPTY     = { num:"", name:"", modele:"", marque:"", immat:"", affectation:"CLMTP", chauffeur:"", annee:"", serie:"" };
const CAT_FORM_EMPTY = { nom:"", icone:"🔧", mots_cles:"" };

const CAT_TOUS = { id:"tous", label:"📋 Tous", match:() => true };

const makeMatch = (mots_cles) => (v) => {
  const n = ((v.name||"") + " " + (v.marque||"")).toUpperCase();
  return (mots_cles||[]).some(kw => kw.trim() && n.includes(kw.trim().toUpperCase()));
};

const buildCategories = (dbCats) => [
  CAT_TOUS,
  ...[...dbCats].sort((a,b) => a.ordre - b.ordre).map(c => ({
    id: c.id,
    label: `${c.icone} ${c.nom}`,
    match: makeMatch(c.mots_cles),
  })),
];

export default function ParcVehicules({ parc, setParc, user }) {
  const [activeTab,   setActiveTab]   = useState("tous");
  const [search,      setSearch]      = useState("");
  const [filterAff,   setFilterAff]   = useState("tous");
  const [showForm,    setShowForm]    = useState(false);
  const [editItem,    setEditItem]    = useState(null);
  const [form,        setForm]        = useState(FORM_EMPTY);
  const [saving,      setSaving]      = useState(false);

  const [dbCats,      setDbCats]      = useState([]);
  const [catsLoaded,  setCatsLoaded]  = useState(false);

  const [showCatModal, setShowCatModal] = useState(false);
  const [catEditItem,  setCatEditItem]  = useState(null);
  const [catForm,      setCatForm]      = useState(CAT_FORM_EMPTY);
  const [catSaving,    setCatSaving]    = useState(false);

  const isAdmin = user?.role === "admin";
  const canEdit = user && ["admin","magasinier","magasinier_preparateur"].includes(user.role);

  useEffect(() => {
    getParcCategories().then(data => { setDbCats(data); setCatsLoaded(true); });
  }, []);

  const categories = buildCategories(dbCats);
  const catMatch   = categories.find(c => c.id === activeTab)?.match || (() => true);
  const inCat      = parc.filter(catMatch);

  const affCounts = {};
  inCat.forEach(v => { const k = v.affectation||""; affCounts[k] = (affCounts[k]||0)+1; });

  const filtered = inCat.filter(v => {
    const okAff = filterAff === "tous" || v.affectation === filterAff;
    const s = search.toLowerCase();
    const okS = !s || [v.num,v.name,v.marque,v.modele,v.immat,v.chauffeur].filter(Boolean).join(" ").toLowerCase().includes(s);
    return okAff && okS;
  });

  const catCount = cat => parc.filter(cat.match).length;

  // ── Engin CRUD ──────────────────────────────────────────────────────────────
  const openAdd  = () => { setEditItem(null); setForm(FORM_EMPTY); setShowForm(true); };
  const openEdit = v  => {
    setEditItem(v);
    setForm({ num:v.num||"", name:v.name||"", modele:v.modele||"", marque:v.marque||"",
              immat:v.immat||"", affectation:v.affectation||"CLMTP",
              chauffeur:v.chauffeur||"", annee:v.annee||"", serie:v.serie||"" });
    setShowForm(true);
  };
  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      num:form.num||null, name:form.name, modele:form.modele||null,
      marque:form.marque||null, immat:form.immat||null,
      affectation:form.affectation||null, chauffeur:form.chauffeur||null,
      annee:form.annee||null, serie:form.serie||null,
    };
    if (editItem) {
      await updateParcVehicule(editItem.id, payload);
      setParc(prev => prev.map(v => v.id===editItem.id ? {...v,...payload} : v));
    } else {
      const saved = await createParcVehicule(payload);
      if (saved) setParc(prev => [saved, ...prev]);
    }
    setSaving(false); setShowForm(false);
  };
  const handleDelete = async v => {
    if (!confirm(`Supprimer "${v.name}" ?`)) return;
    await deleteParcVehicule(v.id);
    setParc(prev => prev.filter(x => x.id !== v.id));
  };

  // ── Catégorie CRUD ───────────────────────────────────────────────────────────
  const openCatAdd  = () => { setCatEditItem(null); setCatForm(CAT_FORM_EMPTY); };
  const openCatEdit = c  => {
    setCatEditItem(c);
    setCatForm({ nom:c.nom, icone:c.icone, mots_cles:(c.mots_cles||[]).join(", ") });
  };
  const handleCatSave = async () => {
    if (!catForm.nom.trim()) return;
    setCatSaving(true);
    const maxOrdre = dbCats.length > 0 ? Math.max(...dbCats.map(c => c.ordre)) : 0;
    const payload = {
      nom:       catForm.nom.trim(),
      icone:     catForm.icone.trim() || "🔧",
      mots_cles: catForm.mots_cles.split(",").map(s => s.trim()).filter(Boolean),
      ordre:     catEditItem ? catEditItem.ordre : maxOrdre + 1,
    };
    if (catEditItem) {
      await updateParcCategorie(catEditItem.id, payload);
      setDbCats(prev => prev.map(c => c.id===catEditItem.id ? {...c,...payload} : c));
    } else {
      const saved = await createParcCategorie(payload);
      if (saved) setDbCats(prev => [...prev, saved]);
    }
    setCatSaving(false); setCatEditItem(null); setCatForm(CAT_FORM_EMPTY);
  };
  const handleCatDelete = async c => {
    if (!confirm(`Supprimer la catégorie "${c.nom}" ?`)) return;
    await deleteParcCategorie(c.id);
    setDbCats(prev => prev.filter(x => x.id !== c.id));
    if (activeTab === c.id) setActiveTab("tous");
  };
  const closeCatModal = () => { setShowCatModal(false); setCatEditItem(null); setCatForm(CAT_FORM_EMPTY); };

  // ── Styles partagés ──────────────────────────────────────────────────────────
  const lbl = { fontSize:11, fontWeight:600, color:"#374151", display:"block", marginBottom:4 };
  const inp = { width:"100%", padding:"9px 12px", border:"1px solid #e5e7eb", borderRadius:9, fontSize:13, outline:"none", boxSizing:"border-box" };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>

      {/* En-tête */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:900,color:"#111827",margin:0}}>🚜 Parc véhicules & engins</h1>
          <p style={{color:"#6b7280",fontSize:13,margin:"4px 0 0"}}>{parc.length} engin{parc.length>1?"s":""} · données Supabase</p>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {isAdmin && (
            <button onClick={() => setShowCatModal(true)}
              style={{background:"#f3f4f6",color:"#374151",border:"1px solid #e5e7eb",borderRadius:10,
                      padding:"10px 16px",fontWeight:600,cursor:"pointer",fontSize:13}}>
              ⚙️ Gérer les catégories
            </button>
          )}
          {canEdit && (
            <button onClick={openAdd}
              style={{background:"#111827",color:"#fff",border:"none",borderRadius:10,
                      padding:"10px 18px",fontWeight:700,cursor:"pointer",fontSize:13}}>
              + Ajouter un engin
            </button>
          )}
        </div>
      </div>

      {/* Pills catégories */}
      <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",msOverflowStyle:"none",scrollbarWidth:"none"}}>
        <div style={{display:"flex",gap:6,minWidth:"max-content",padding:"2px 0 6px"}}>
          {!catsLoaded ? (
            <span style={{fontSize:13,color:"#9ca3af",padding:"7px 14px"}}>Chargement…</span>
          ) : categories.map(cat => {
            const count  = catCount(cat);
            const active = activeTab === cat.id;
            return (
              <button key={cat.id}
                onClick={() => { setActiveTab(cat.id); setSearch(""); setFilterAff("tous"); }}
                style={{
                  display:"inline-flex",alignItems:"center",gap:6,padding:"7px 14px",
                  background: active ? "#111827" : "#f3f4f6",
                  color:      active ? "#fff"     : "#374151",
                  border:     active ? "1.5px solid #111827" : "1.5px solid #e5e7eb",
                  borderRadius:99,cursor:"pointer",whiteSpace:"nowrap",
                  fontWeight: active ? 700 : 500, fontSize:13, transition:"all 0.15s",
                }}>
                <span>{cat.label}</span>
                <span style={{
                  fontSize:11, fontWeight:700,
                  background: active ? "rgba(255,255,255,0.2)" : "#e5e7eb",
                  color:      active ? "#fff" : "#6b7280",
                  padding:"1px 7px", borderRadius:99, minWidth:20, textAlign:"center",
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filtres affectation */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {[{k:"tous",l:"Tous",n:inCat.length},
          ...AFFECTATIONS.filter(a=>a).map(a=>({k:a,l:a,n:affCounts[a]||0}))
        ].map(btn => (
          <button key={btn.k} onClick={() => setFilterAff(btn.k)}
            style={{padding:"6px 14px",borderRadius:99,
                    border:`1px solid ${filterAff===btn.k?"#111827":"#e5e7eb"}`,
                    background:filterAff===btn.k?"#111827":"#fff",
                    color:filterAff===btn.k?"#fff":"#374151",
                    fontWeight:600,cursor:"pointer",fontSize:12}}>
            {btn.l} <span style={{opacity:0.65}}>({btn.n})</span>
          </button>
        ))}
      </div>

      {/* Recherche + compteur */}
      <div style={{display:"flex",gap:10,alignItems:"center"}}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍  Rechercher numéro, désignation, marque, immat, chauffeur…"
          style={{flex:1,padding:"10px 16px",border:"1px solid #e5e7eb",borderRadius:10,
                  fontSize:13,outline:"none",boxSizing:"border-box"}}/>
        <span style={{fontSize:13,color:"#6b7280",whiteSpace:"nowrap",flexShrink:0}}>
          {filtered.length} résultat{filtered.length!==1?"s":""}
        </span>
      </div>

      {/* Tableau */}
      <div style={{background:"#fff",borderRadius:16,border:"1px solid #e5e7eb",overflow:"hidden"}}>
        {filtered.length === 0 ? (
          <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>
            <div style={{fontSize:40,marginBottom:10}}>🚜</div>
            <div style={{fontWeight:700,color:"#374151"}}>
              {search||filterAff!=="tous" ? "Aucun résultat pour ces filtres" : "Aucun engin dans cette catégorie"}
            </div>
          </div>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:800}}>
              <thead>
                <tr style={{background:"#111827"}}>
                  {["N°","Désignation","Marque / Modèle","Immat.","Affectation","Chauffeur","Année","Actions"].map(h => (
                    <th key={h} style={{padding:"10px 12px",textAlign:"left",fontSize:11,fontWeight:700,
                                        color:"#9ca3af",textTransform:"uppercase",letterSpacing:0.5,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((v,i) => (
                  <tr key={v.id} style={{borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                    <td style={{padding:"10px 12px",fontSize:12,fontFamily:"monospace",fontWeight:700,color:"#374151",whiteSpace:"nowrap"}}>{v.num||"—"}</td>
                    <td style={{padding:"10px 12px"}}>
                      <div style={{fontWeight:700,fontSize:13,color:"#111827"}}>{v.name}</div>
                      {v.serie && <div style={{fontSize:10,color:"#9ca3af",fontFamily:"monospace",marginTop:1}}>{v.serie}</div>}
                    </td>
                    <td style={{padding:"10px 12px",fontSize:12,color:"#374151"}}>{[v.marque,v.modele].filter(Boolean).join(" / ")||"—"}</td>
                    <td style={{padding:"10px 12px",fontSize:12,fontFamily:"monospace",color:"#374151"}}>{v.immat||"—"}</td>
                    <td style={{padding:"10px 12px"}}>
                      {v.affectation
                        ? <span style={{background:"#dbeafe",color:"#1e40af",padding:"2px 8px",borderRadius:99,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{v.affectation}</span>
                        : <span style={{color:"#d1d5db",fontSize:11}}>—</span>}
                    </td>
                    <td style={{padding:"10px 12px",fontSize:12,color:"#374151"}}>{v.chauffeur||"—"}</td>
                    <td style={{padding:"10px 12px",fontSize:12,color:"#374151"}}>{v.annee||"—"}</td>
                    <td style={{padding:"10px 12px"}}>
                      {canEdit && (
                        <div style={{display:"flex",gap:6}}>
                          <button onClick={() => openEdit(v)}
                            style={{padding:"5px 10px",background:"#f3f4f6",border:"none",borderRadius:7,cursor:"pointer",fontSize:12}}>✏️</button>
                          <button onClick={() => handleDelete(v)}
                            style={{padding:"5px 10px",background:"#fee2e2",border:"none",borderRadius:7,cursor:"pointer",fontSize:12,color:"#dc2626"}}>🗑</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal ajout / modification engin ─────────────────────────────────── */}
      {showForm && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",
                     justifyContent:"center",zIndex:1000,backdropFilter:"blur(2px)"}}>
          <div style={{background:"#fff",borderRadius:20,padding:28,width:"min(96vw,560px)",
                       maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h2 style={{fontSize:17,fontWeight:800,color:"#111827",margin:0}}>
                {editItem ? "✏️ Modifier l'engin" : "➕ Nouvel engin"}
              </h2>
              <button onClick={() => setShowForm(false)}
                style={{background:"#f3f4f6",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:15}}>✕</button>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label style={lbl}>N° parc</label>
                  <input value={form.num} onChange={e => setForm(p=>({...p,num:e.target.value}))} placeholder="Ex : VU01" style={inp}/>
                </div>
                <div style={{gridColumn:"1/3"}}>
                  <label style={lbl}>Désignation *</label>
                  <input value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} placeholder="Nom complet de l'engin" style={inp}/>
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {[
                  {l:"Marque",k:"marque",ph:"Ex : RENAULT"},
                  {l:"Modèle",k:"modele",ph:"Ex : MASTER"},
                  {l:"Immatriculation",k:"immat",ph:"Ex : AB-123-CD"},
                  {l:"Chauffeur",k:"chauffeur",ph:"Prénom NOM"},
                  {l:"Année",k:"annee",ph:"Ex : 2020"},
                  {l:"N° série",k:"serie",ph:"Numéro de série"},
                ].map(field => (
                  <div key={field.k}>
                    <label style={lbl}>{field.l}</label>
                    <input value={form[field.k]} onChange={e => setForm(p=>({...p,[field.k]:e.target.value}))} placeholder={field.ph} style={inp}/>
                  </div>
                ))}
              </div>

              <div>
                <label style={lbl}>Affectation</label>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {["CLMTP","CLAISSE RAIL","STMF",""].map(a => (
                    <button key={a||"aucune"} onClick={() => setForm(p=>({...p,affectation:a}))}
                      style={{padding:"7px 14px",borderRadius:9,
                              border:`2px solid ${form.affectation===a?"#111827":"#e5e7eb"}`,
                              background:form.affectation===a?"#111827":"#fff",
                              color:form.affectation===a?"#fff":"#374151",
                              fontWeight:600,cursor:"pointer",fontSize:12}}>
                      {a||"Non affecté"}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{display:"flex",gap:10,marginTop:6}}>
                <button onClick={() => setShowForm(false)}
                  style={{flex:1,padding:"11px",background:"#f3f4f6",border:"none",borderRadius:10,fontWeight:600,cursor:"pointer"}}>
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving||!form.name.trim()}
                  style={{flex:2,padding:"11px",
                          background:form.name.trim()?"#111827":"#e5e7eb",
                          color:form.name.trim()?"#fff":"#9ca3af",
                          border:"none",borderRadius:10,fontWeight:700,
                          cursor:form.name.trim()?"pointer":"not-allowed",fontSize:14}}>
                  {saving ? "⏳…" : editItem ? "💾 Modifier" : "➕ Ajouter"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal gestion catégories ──────────────────────────────────────────── */}
      {showCatModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",
                     justifyContent:"center",zIndex:1000,backdropFilter:"blur(2px)"}}>
          <div style={{background:"#fff",borderRadius:20,padding:28,width:"min(96vw,680px)",
                       maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>

            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h2 style={{fontSize:17,fontWeight:800,color:"#111827",margin:0}}>⚙️ Gérer les catégories</h2>
              <button onClick={closeCatModal}
                style={{background:"#f3f4f6",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:15}}>✕</button>
            </div>

            {/* Liste */}
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
              {[...dbCats].sort((a,b)=>a.ordre-b.ordre).map(c => (
                <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",
                                        background:"#f9fafb",borderRadius:12,border:"1px solid #e5e7eb"}}>
                  <span style={{fontSize:22,flexShrink:0,lineHeight:1}}>{c.icone}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#111827"}}>{c.nom}</div>
                    <div style={{fontSize:11,color:"#9ca3af",marginTop:2,
                                 overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {(c.mots_cles||[]).length > 0
                        ? (c.mots_cles||[]).join(" · ")
                        : <em>Aucun mot-clé</em>}
                    </div>
                  </div>
                  <span style={{fontSize:11,color:"#9ca3af",flexShrink:0}}>
                    {parc.filter(makeMatch(c.mots_cles)).length} engins
                  </span>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    <button onClick={() => openCatEdit(c)}
                      style={{padding:"5px 10px",background:"#f3f4f6",border:"none",borderRadius:7,cursor:"pointer",fontSize:12}}>✏️</button>
                    <button onClick={() => handleCatDelete(c)}
                      style={{padding:"5px 10px",background:"#fee2e2",border:"none",borderRadius:7,cursor:"pointer",fontSize:12,color:"#dc2626"}}>🗑</button>
                  </div>
                </div>
              ))}
              {dbCats.length === 0 && (
                <div style={{textAlign:"center",padding:24,color:"#9ca3af",fontSize:13}}>
                  Aucune catégorie — ajoutez-en une ci-dessous.
                </div>
              )}
            </div>

            {/* Formulaire ajout / modification */}
            <div style={{background:"#f9fafb",borderRadius:14,padding:20,border:"1px solid #e5e7eb"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <h3 style={{fontSize:14,fontWeight:700,color:"#111827",margin:0}}>
                  {catEditItem ? `✏️ Modifier "${catEditItem.nom}"` : "➕ Ajouter une catégorie"}
                </h3>
                {!catEditItem && dbCats.length > 0 && (
                  <button onClick={openCatAdd}
                    style={{fontSize:12,color:"#6b7280",background:"none",border:"none",cursor:"pointer",padding:0}}>
                    Réinitialiser
                  </button>
                )}
              </div>

              <div style={{display:"grid",gridTemplateColumns:"64px 1fr",gap:10,marginBottom:10}}>
                <div>
                  <label style={lbl}>Icône</label>
                  <input value={catForm.icone}
                    onChange={e => setCatForm(p=>({...p,icone:e.target.value}))}
                    style={{...inp,textAlign:"center",fontSize:22,padding:"6px 4px"}}/>
                </div>
                <div>
                  <label style={lbl}>Nom *</label>
                  <input value={catForm.nom}
                    onChange={e => setCatForm(p=>({...p,nom:e.target.value}))}
                    placeholder="Ex : Engins de chantier" style={inp}/>
                </div>
              </div>

              <div style={{marginBottom:14}}>
                <label style={lbl}>Mots-clés (séparés par virgule)</label>
                <textarea value={catForm.mots_cles}
                  onChange={e => setCatForm(p=>({...p,mots_cles:e.target.value}))}
                  placeholder="Ex : PELLE, PELLETEUSE, MINIPELLE, BULLDOZER"
                  rows={3}
                  style={{...inp,resize:"vertical",fontFamily:"monospace",lineHeight:1.6}}/>
                <div style={{fontSize:11,color:"#9ca3af",marginTop:4}}>
                  {catForm.mots_cles.split(",").map(s=>s.trim()).filter(Boolean).length} mot(s)-clé(s) · correspondance sur <strong>nom</strong> ou <strong>marque</strong> de l'engin
                </div>
              </div>

              <div style={{display:"flex",gap:8}}>
                {catEditItem && (
                  <button onClick={() => { setCatEditItem(null); setCatForm(CAT_FORM_EMPTY); }}
                    style={{flex:1,padding:"10px",background:"#f3f4f6",border:"none",
                            borderRadius:10,fontWeight:600,cursor:"pointer",fontSize:13}}>
                    Annuler
                  </button>
                )}
                <button onClick={handleCatSave} disabled={catSaving||!catForm.nom.trim()}
                  style={{flex:2,padding:"10px",
                          background:catForm.nom.trim()?"#111827":"#e5e7eb",
                          color:catForm.nom.trim()?"#fff":"#9ca3af",
                          border:"none",borderRadius:10,fontWeight:700,
                          cursor:catForm.nom.trim()?"pointer":"not-allowed",fontSize:13}}>
                  {catSaving ? "⏳…" : catEditItem ? "💾 Mettre à jour" : "➕ Ajouter"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
