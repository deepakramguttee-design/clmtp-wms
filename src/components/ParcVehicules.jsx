import { useState, useEffect } from "react";
import {
  createParcVehicule, updateParcVehicule, deleteParcVehicule,
  getParcCategories, createParcCategorie, updateParcCategorie, deleteParcCategorie,
} from "../db.js";

const AFFECTATIONS = ["CLMTP", "CLAISSE RAIL", "STMF", ""];
const FORM_EMPTY     = { num:"", name:"", modele:"", marque:"", immat:"", affectation:"CLMTP", chauffeur:"", annee:"", serie:"", categorie_id:"" };
const CAT_FORM_EMPTY = { nom:"", icone:"🔧", mots_cles:"" };

const CAT_TOUS = { id:"tous", label:"📋 Tous" };

const buildCategories = (dbCats) => [
  CAT_TOUS,
  ...[...dbCats].sort((a,b) => a.ordre - b.ordre).map(c => ({
    id: c.id,
    label: `${c.icone} ${c.nom}`,
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
  const inCat      = activeTab === "tous"
    ? parc
    : parc.filter(v => v.categorie_id === activeTab);

  const affCounts = {};
  inCat.forEach(v => { const k = v.affectation||""; affCounts[k] = (affCounts[k]||0)+1; });

  const filtered = inCat.filter(v => {
    const okAff = filterAff === "tous" || v.affectation === filterAff;
    const s = search.toLowerCase();
    const okS = !s || [v.num,v.name,v.marque,v.modele,v.immat,v.chauffeur].filter(Boolean).join(" ").toLowerCase().includes(s);
    return okAff && okS;
  });

  const catCount = cat => cat.id === "tous" ? parc.length : parc.filter(v => v.categorie_id === cat.id).length;

  // ── Engin CRUD ──────────────────────────────────────────────────────────────
  const openAdd  = () => { setEditItem(null); setForm(FORM_EMPTY); setShowForm(true); };
  const openEdit = v  => {
    setEditItem(v);
    setForm({ num:v.num||"", name:v.name||"", modele:v.modele||"", marque:v.marque||"",
              immat:v.immat||"", affectation:v.affectation||"CLMTP",
              chauffeur:v.chauffeur||"", annee:v.annee||"", serie:v.serie||"",
              categorie_id:v.categorie_id||"" });
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
      categorie_id:form.categorie_id||null,
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

  // ── Changement de catégorie inline ──────────────────────────────────────────
  const handleCatChange = async (v, categorie_id) => {
    const val = categorie_id || null;
    await updateParcVehicule(v.id, { categorie_id: val });
    setParc(prev => prev.map(x => x.id === v.id ? { ...x, categorie_id: val } : x));
  };

  // ── Styles partagés ──────────────────────────────────────────────────────────
  const lbl = { fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 };
  const inp = { width:"100%", padding:"9px 12px", border:"1px solid #e5e7eb", borderRadius:9, fontSize:13, outline:"none", boxSizing:"border-box" };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>

      {/* En-tête */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:900,color:"#1e2330",margin:0}}>🚜 Parc véhicules & engins</h1>
          <p style={{color:"#6b7280",fontSize:13,margin:"4px 0 0"}}>{parc.length} engin{parc.length>1?"s":""} · données Supabase</p>
        </div>
        {canEdit && (
          <button onClick={openAdd}
            style={{background:"#1e2330",color:"#fff",border:"none",borderRadius:10,
                    padding:"10px 18px",fontWeight:700,cursor:"pointer",fontSize:13}}>
            + Ajouter un engin
          </button>
        )}
      </div>

      {/* Body : sidebar gauche + contenu principal */}
      <div style={{display:"flex",gap:0,alignItems:"flex-start"}}>

        {/* ── Sidebar catégories ── */}
        <div style={{
          width:210, flexShrink:0,
          background:"#f8f9fa", borderRight:"1px solid #e5e7eb",
          borderRadius:"12px 0 0 12px", display:"flex", flexDirection:"column",
          minHeight:400,
        }}>
          {/* Items */}
          <div style={{flex:1, overflowY:"auto", padding:"8px 0"}}>
            {!catsLoaded ? (
              <div style={{padding:"12px 16px",fontSize:12,color:"#8a9ab8"}}>Chargement…</div>
            ) : categories.map(cat => {
              const count  = catCount(cat);
              const active = activeTab === cat.id;
              return (
                <button key={cat.id}
                  onClick={() => { setActiveTab(cat.id); setSearch(""); setFilterAff("tous"); }}
                  style={{
                    display:"flex", alignItems:"center", justifyContent:"space-between",
                    width:"100%", padding:"9px 14px", border:"none", cursor:"pointer",
                    background: active ? "#4472C4" : "transparent",
                    color:      active ? "#fff"    : "#555",
                    fontWeight: active ? 700 : 500, fontSize:13,
                    textAlign:"left", transition:"background 0.12s",
                    borderLeft: active ? "3px solid #2d5aaa" : "3px solid transparent",
                  }}>
                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>
                    {cat.label}
                  </span>
                  <span style={{
                    fontSize:11, fontWeight:700, flexShrink:0, marginLeft:6,
                    background: active ? "rgba(255,255,255,0.25)" : "#e0e0d8",
                    color:      active ? "#fff" : "#6b7280",
                    padding:"1px 7px", borderRadius:99, minWidth:22, textAlign:"center",
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Bouton gérer en bas */}
          {isAdmin && (
            <div style={{borderTop:"1px solid #e5e7eb", padding:10}}>
              <button onClick={() => setShowCatModal(true)}
                style={{
                  width:"100%", padding:"8px 10px", background:"#fff",
                  border:"1px solid #e5e7eb", borderRadius:8,
                  fontSize:12, fontWeight:600, color:"#555",
                  cursor:"pointer", textAlign:"left",
                }}>
                ⚙️ Gérer les catégories
              </button>
            </div>
          )}
        </div>

        {/* ── Contenu principal ── */}
        <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:12,
                     paddingLeft:16,background:"#fff",borderRadius:"0 12px 12px 0",
                     border:"1px solid #e5e7eb",borderLeft:"none",padding:16}}>

          {/* Filtres affectation */}
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {[{k:"tous",l:"Tous",n:inCat.length},
              ...AFFECTATIONS.filter(a=>a).map(a=>({k:a,l:a,n:affCounts[a]||0}))
            ].map(btn => (
              <button key={btn.k} onClick={() => setFilterAff(btn.k)}
                style={{padding:"5px 12px",borderRadius:99,
                        border:`1px solid ${filterAff===btn.k?"#4472C4":"#e0e0d8"}`,
                        background:filterAff===btn.k?"#4472C4":"#fff",
                        color:filterAff===btn.k?"#fff":"#555",
                        fontWeight:600,cursor:"pointer",fontSize:12}}>
                {btn.l} <span style={{opacity:0.7}}>({btn.n})</span>
              </button>
            ))}
          </div>

          {/* Recherche + compteur */}
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍  Rechercher numéro, désignation, marque, immat, chauffeur…"
              style={{flex:1,padding:"9px 14px",border:"1px solid #e5e7eb",borderRadius:10,
                      fontSize:13,outline:"none",boxSizing:"border-box"}}/>
            <span style={{fontSize:13,color:"#6b7280",whiteSpace:"nowrap",flexShrink:0}}>
              {filtered.length} résultat{filtered.length!==1?"s":""}
            </span>
          </div>

          {/* Tableau */}
          <div style={{background:"#fff",borderRadius:10,border:"1px solid #f3f4f6",overflow:"hidden"}}>
        {filtered.length === 0 ? (
          <div style={{padding:40,textAlign:"center",color:"#8a9ab8"}}>
            <div style={{fontSize:40,marginBottom:10}}>🚜</div>
            <div style={{fontWeight:700,color:"#555"}}>
              {search||filterAff!=="tous" ? "Aucun résultat pour ces filtres" : "Aucun engin dans cette catégorie"}
            </div>
          </div>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth: activeTab==="tous" ? 1000 : 800}}>
              <thead>
                <tr style={{background:"#1e2330"}}>
                  {["N°","Désignation","Marque / Modèle","Immat.","Affectation",
                    ...(activeTab==="tous" ? ["Catégorie"] : []),
                    "Chauffeur","Année","Actions"].map(h => (
                    <th key={h} style={{padding:"10px 12px",textAlign:"left",fontSize:11,fontWeight:700,
                                        color:"#8a9ab8",textTransform:"uppercase",letterSpacing:0.5,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((v,i) => (
                  <tr key={v.id} style={{borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                    <td style={{padding:"10px 12px",fontSize:12,fontFamily:"monospace",fontWeight:700,color:"#555",whiteSpace:"nowrap"}}>{v.num||"—"}</td>
                    <td style={{padding:"10px 12px"}}>
                      <div style={{fontWeight:700,fontSize:13,color:"#1e2330"}}>{v.name}</div>
                      {v.serie && <div style={{fontSize:10,color:"#8a9ab8",fontFamily:"monospace",marginTop:1}}>{v.serie}</div>}
                    </td>
                    <td style={{padding:"10px 12px",fontSize:12,color:"#555"}}>{[v.marque,v.modele].filter(Boolean).join(" / ")||"—"}</td>
                    <td style={{padding:"10px 12px",fontSize:12,fontFamily:"monospace",color:"#555"}}>{v.immat||"—"}</td>
                    <td style={{padding:"10px 12px"}}>
                      {v.affectation
                        ? <span style={{background:"#dbeafe",color:"#1e40af",padding:"2px 8px",borderRadius:99,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{v.affectation}</span>
                        : <span style={{color:"#d1d5db",fontSize:11}}>—</span>}
                    </td>
                    {activeTab === "tous" && (
                      <td style={{padding:"6px 12px"}}>
                        <select
                          value={v.categorie_id || ""}
                          onChange={e => handleCatChange(v, e.target.value)}
                          style={{fontSize:12,border:"1px solid #e5e7eb",borderRadius:7,
                                  padding:"5px 8px",background:"#fff",cursor:"pointer",
                                  maxWidth:190,width:"100%"}}>
                          <option value="">— Non classé</option>
                          {[...dbCats].sort((a,b)=>a.ordre-b.ordre).map(c => (
                            <option key={c.id} value={c.id}>{c.icone} {c.nom}</option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td style={{padding:"10px 12px",fontSize:12,color:"#555"}}>{v.chauffeur||"—"}</td>
                    <td style={{padding:"10px 12px",fontSize:12,color:"#555"}}>{v.annee||"—"}</td>
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
        </div>{/* fin tableau */}
        </div>{/* fin contenu principal */}
      </div>{/* fin body sidebar+main */}

      {/* ── Modal ajout / modification engin ─────────────────────────────────── */}
      {showForm && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",
                     justifyContent:"center",zIndex:1000,backdropFilter:"blur(2px)"}}>
          <div style={{background:"#fff",borderRadius:20,padding:28,width:"min(96vw,560px)",
                       maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h2 style={{fontSize:17,fontWeight:800,color:"#1e2330",margin:0}}>
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
                              border:`2px solid ${form.affectation===a?"#1e2330":"#e0e0d8"}`,
                              background:form.affectation===a?"#1e2330":"#fff",
                              color:form.affectation===a?"#fff":"#555",
                              fontWeight:600,cursor:"pointer",fontSize:12}}>
                      {a||"Non affecté"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={lbl}>Catégorie</label>
                <select value={form.categorie_id} onChange={e => setForm(p=>({...p,categorie_id:e.target.value}))}
                  style={{...inp,cursor:"pointer"}}>
                  <option value="">— Non classé</option>
                  {[...dbCats].sort((a,b)=>a.ordre-b.ordre).map(c => (
                    <option key={c.id} value={c.id}>{c.icone} {c.nom}</option>
                  ))}
                </select>
              </div>

              <div style={{display:"flex",gap:10,marginTop:6}}>
                <button onClick={() => setShowForm(false)}
                  style={{flex:1,padding:"11px",background:"#f3f4f6",border:"none",borderRadius:10,fontWeight:600,cursor:"pointer"}}>
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving||!form.name.trim()}
                  style={{flex:2,padding:"11px",
                          background:form.name.trim()?"#1e2330":"#e0e0d8",
                          color:form.name.trim()?"#fff":"#8a9ab8",
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
              <h2 style={{fontSize:17,fontWeight:800,color:"#1e2330",margin:0}}>⚙️ Gérer les catégories</h2>
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
                    <div style={{fontWeight:700,fontSize:13,color:"#1e2330"}}>{c.nom}</div>
                    <div style={{fontSize:11,color:"#8a9ab8",marginTop:2,
                                 overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {(c.mots_cles||[]).length > 0
                        ? (c.mots_cles||[]).join(" · ")
                        : <em>Aucun mot-clé</em>}
                    </div>
                  </div>
                  <span style={{fontSize:11,color:"#8a9ab8",flexShrink:0}}>
                    {parc.filter(v => v.categorie_id === c.id).length} engins
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
                <div style={{textAlign:"center",padding:24,color:"#8a9ab8",fontSize:13}}>
                  Aucune catégorie — ajoutez-en une ci-dessous.
                </div>
              )}
            </div>

            {/* Formulaire ajout / modification */}
            <div style={{background:"#f9fafb",borderRadius:14,padding:20,border:"1px solid #e5e7eb"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <h3 style={{fontSize:14,fontWeight:700,color:"#1e2330",margin:0}}>
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
                <div style={{fontSize:11,color:"#8a9ab8",marginTop:4}}>
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
                          background:catForm.nom.trim()?"#1e2330":"#e0e0d8",
                          color:catForm.nom.trim()?"#fff":"#8a9ab8",
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
