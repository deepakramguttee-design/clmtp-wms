import { useState } from "react";
import { createParcVehicule, updateParcVehicule, deleteParcVehicule } from "../db.js";

const AFFECTATIONS = ["CLMTP", "CLAISSE RAIL", "STMF", ""];
const FORM_EMPTY = { num:"", name:"", modele:"", marque:"", immat:"", affectation:"CLMTP", chauffeur:"", annee:"", serie:"" };

const pfx = v => (v.num||"").match(/^[A-Za-z]+/)?.[0]?.toUpperCase() || "";
const nom = v => (v.name||"").toUpperCase();

const CATEGORIES = [
  {
    id: "vuvp",
    label: "🚗 VU/VP/VC",
    shortLabel: "VU/VP/VC",
    match: v => {
      const p = pfx(v), n = nom(v);
      return ["VU","VP","VC"].includes(p) ||
             (n.includes("REMORQUE") && !n.includes("POIDS LOURD") && !/\bPL\b/.test(n) && !n.includes(" PL "));
    }
  },
  {
    id: "pelle",
    label: "🚜 Pelle",
    shortLabel: "Pelle",
    match: v => {
      const n = nom(v);
      return n.includes("PELLE") || n.includes("PELLETEUSE") || n.includes("MINI-PELLE") || n.includes("MINIPELLE");
    }
  },
  {
    id: "prr",
    label: "🚂 PRR",
    shortLabel: "PRR",
    match: v => {
      const n = nom(v);
      return n.includes("PRR") || n.includes("PORTIQUE") || n.includes("RAIL") || n.includes("VOIE");
    }
  },
  {
    id: "pl",
    label: "🚛 PL / Remorques PL",
    shortLabel: "PL",
    match: v => {
      const p = pfx(v), n = nom(v);
      return p === "PL" || n.includes("POIDS LOURD") || n.includes("SEMI-REMORQUE") ||
             (n.includes("REMORQUE") && /\bPL\b/.test(n));
    }
  },
  {
    id: "gc",
    label: "⚙️ Engins GC & MP",
    shortLabel: "GC/MP",
    match: v => {
      const n = nom(v);
      return n.includes("BOURREUSE") || n.includes("BOURREUR") || n.includes("COMPACTEUR") ||
             n.includes("FINISSEUR") || n.includes("NIVELEUSE") || n.includes("CHARGEUSE") ||
             n.includes("FINITION");
    }
  },
  {
    id: "em",
    label: "🔩 EM + BML",
    shortLabel: "EM/BML",
    match: v => {
      const n = nom(v);
      return n.includes("BML") || /\bEM\b/.test(n) || n.includes("MOTRICE") ||
             n.includes("LOCOMOTIVE") || n.includes("LOCOTRACTEUR");
    }
  },
  {
    id: "broyeur",
    label: "🌿 Broyeur",
    shortLabel: "Broyeur",
    match: v => nom(v).includes("BROYEUR") || nom(v).includes("CRIBLE")
  },
  {
    id: "agri",
    label: "🌾 Agri / Tondeuse",
    shortLabel: "Agri",
    match: v => {
      const n = nom(v);
      return n.includes("TRACTEUR") || n.includes("TONDEUSE") || n.includes("AGRI");
    }
  },
  {
    id: "pm",
    label: "🔧 PM - Petit Matériel",
    shortLabel: "PM",
    match: v => {
      const p = pfx(v), n = nom(v);
      return p === "PM" || n.includes("COMPRESSEUR") || n.includes("GROUPE") ||
             n.includes("POMPE") || n.includes("GENERATRICE") || n.includes("GÉNÉRATRICE") ||
             n.includes("MOTOPOMPE") || n.includes("VIBREUR") || n.includes("AIGUILLE") ||
             n.includes("MARTEAU") || n.includes("PERFORATEUR");
    }
  },
  {
    id: "tous",
    label: "📋 Tous",
    shortLabel: "Tous",
    match: () => true
  }
];

export default function ParcVehicules({ parc, setParc, user }) {
  const [activeTab, setActiveTab] = useState("tous");
  const [search, setSearch]       = useState("");
  const [filterAff, setFilterAff] = useState("tous");
  const [showForm, setShowForm]   = useState(false);
  const [editItem, setEditItem]   = useState(null);
  const [form, setForm]           = useState(FORM_EMPTY);
  const [saving, setSaving]       = useState(false);

  const canEdit = user && ["admin","magasinier","magasinier_preparateur"].includes(user.role);

  const catMatch = CATEGORIES.find(c => c.id === activeTab)?.match || (() => true);

  const inCat   = parc.filter(catMatch);
  const affCounts = {};
  inCat.forEach(v => { const k = v.affectation||""; affCounts[k] = (affCounts[k]||0)+1; });

  const filtered = inCat.filter(v => {
    const okAff = filterAff === "tous" || v.affectation === filterAff;
    const s = search.toLowerCase();
    const okS = !s || [v.num,v.name,v.marque,v.modele,v.immat,v.chauffeur].filter(Boolean).join(" ").toLowerCase().includes(s);
    return okAff && okS;
  });

  const catCount = cat => parc.filter(cat.match).length;

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
      num: form.num||null, name: form.name, modele: form.modele||null,
      marque: form.marque||null, immat: form.immat||null,
      affectation: form.affectation||null, chauffeur: form.chauffeur||null,
      annee: form.annee||null, serie: form.serie||null,
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

  const lbl = { fontSize:11, fontWeight:600, color:"#374151", display:"block", marginBottom:4 };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>

      {/* En-tête */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:900,color:"#111827",margin:0}}>🚜 Parc véhicules & engins</h1>
          <p style={{color:"#6b7280",fontSize:13,margin:"4px 0 0"}}>{parc.length} engin{parc.length>1?"s":""} · données Supabase</p>
        </div>
        {canEdit && (
          <button onClick={openAdd}
            style={{background:"#111827",color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",fontWeight:700,cursor:"pointer",fontSize:13}}>
            + Ajouter un engin
          </button>
        )}
      </div>

      {/* Onglets catégories */}
      <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        <div style={{display:"flex",gap:4,borderBottom:"2px solid #e5e7eb",minWidth:"max-content",paddingBottom:0}}>
          {CATEGORIES.map(cat => {
            const count = catCount(cat);
            const active = activeTab === cat.id;
            return (
              <button key={cat.id}
                onClick={() => { setActiveTab(cat.id); setSearch(""); setFilterAff("tous"); }}
                style={{
                  padding:"10px 14px",background:"none",border:"none",cursor:"pointer",
                  borderBottom:`3px solid ${active?"#111827":"transparent"}`,
                  marginBottom:-2,fontWeight:active?700:500,fontSize:13,
                  color:active?"#111827":"#6b7280",whiteSpace:"nowrap",
                  display:"flex",flexDirection:"column",alignItems:"center",gap:2,
                }}>
                <span>{cat.label}</span>
                <span style={{fontSize:10,fontWeight:700,color:active?"#111827":"#9ca3af",
                              background:active?"#f3f4f6":"transparent",
                              padding:"1px 6px",borderRadius:99}}>
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
          <button key={btn.k} onClick={()=>setFilterAff(btn.k)}
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
        <input
          value={search} onChange={e=>setSearch(e.target.value)}
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
                  {["N°","Désignation","Marque / Modèle","Immat.","Affectation","Chauffeur","Année","Actions"].map(h=>(
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
                          <button onClick={()=>openEdit(v)}
                            style={{padding:"5px 10px",background:"#f3f4f6",border:"none",borderRadius:7,cursor:"pointer",fontSize:12}}>✏️</button>
                          <button onClick={()=>handleDelete(v)}
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

      {/* Modal ajout / modification */}
      {showForm && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",
                     justifyContent:"center",zIndex:1000,backdropFilter:"blur(2px)"}}>
          <div style={{background:"#fff",borderRadius:20,padding:28,width:"min(96vw,560px)",
                       maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h2 style={{fontSize:17,fontWeight:800,color:"#111827",margin:0}}>
                {editItem ? "✏️ Modifier l'engin" : "➕ Nouvel engin"}
              </h2>
              <button onClick={()=>setShowForm(false)}
                style={{background:"#f3f4f6",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:15}}>✕</button>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label style={lbl}>N° parc</label>
                  <input value={form.num} onChange={e=>setForm(p=>({...p,num:e.target.value}))} placeholder="Ex : VU01"
                    style={{width:"100%",padding:"9px 12px",border:"1px solid #e5e7eb",borderRadius:9,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                </div>
                <div style={{gridColumn:"1/3"}}>
                  <label style={lbl}>Désignation *</label>
                  <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Nom complet de l'engin"
                    style={{width:"100%",padding:"9px 12px",border:"1px solid #e5e7eb",borderRadius:9,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
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
                    <input value={form[field.k]} onChange={e=>setForm(p=>({...p,[field.k]:e.target.value}))} placeholder={field.ph}
                      style={{width:"100%",padding:"9px 12px",border:"1px solid #e5e7eb",borderRadius:9,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                  </div>
                ))}
              </div>

              <div>
                <label style={lbl}>Affectation</label>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {["CLMTP","CLAISSE RAIL","STMF",""].map(a => (
                    <button key={a||"aucune"} onClick={()=>setForm(p=>({...p,affectation:a}))}
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
                <button onClick={()=>setShowForm(false)}
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
    </div>
  );
}
