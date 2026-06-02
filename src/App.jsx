import { useState, useEffect, useCallback } from "react";
import { ALL_PRODUCTS } from "./products.js";
import AdminDashboard from "./AdminDashboard.jsx";
import { PARC_VEHICULES } from "./parc.js";
import { supabase } from "./supabase.js";
import {
  loginUser, loginUserMultiSite,
  getUtilisateurs, getUtilisateursSite, createUtilisateur, createUtilisateurSite, updateUtilisateur, updateUtilisateurPermissions, deleteUtilisateur,
  getCatalogue, importCatalogue,
  addCatalogueArticle, updateCatalogueArticle, deleteCatalogueArticle,
  getMouvements, getMouvementsSite, addMouvement, addMouvementSite, deleteMouvement,
  getStockOverrides, getStockOverridesSite, setStockOverride, setStockOverrideSite, deleteStockOverride,
  getOrdres, getOrdresSite, createOrdre, createOrdreSite, updateOrdre, deleteOrdre,
  getEquivalences, addEquivalence, removeEquivalence,
  getPrixFournisseurs, addPrixFournisseur, updatePrixFournisseur, deletePrixFournisseur,
  getHistoriquePrix, addHistoriquePrix,
  getLotsArticle, getAllLots, addLotAchat, consommerFIFO, deleteLotAchat,
  getLocations, addLocation, updateLocation, deleteLocation,
  getPrets, addPret, updatePret, deletePret,
  getUserPermissions,
  getPermissions, savePermissions, deletePermissions,
} from "./db.js";

// ── STATUTS ───────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  ok:       { bg: "#d1fae5", text: "#065f46", label: "En stock" },
  warning:  { bg: "#fef3c7", text: "#92400e", label: "Faible" },
  critical: { bg: "#fee2e2", text: "#991b1b", label: "Critique" },
  rupture:  { bg: "#f3f4f6", text: "#374151", label: "Rupture" },
};
const OR_STATUTS = {
  ouvert:     { bg: "#dbeafe", text: "#1e40af", label: "Ouvert" },
  en_cours:   { bg: "#fef3c7", text: "#92400e", label: "En cours" },
  en_attente: { bg: "#f3e8ff", text: "#6b21a8", label: "En attente pièces" },
  termine:    { bg: "#d1fae5", text: "#065f46", label: "Terminé" },
  annule:     { bg: "#f3f4f6", text: "#374151", label: "Annulé" },
};
const OR_PRIORITES = {
  urgente: { bg: "#fee2e2", text: "#991b1b" },
  haute:   { bg: "#fef3c7", text: "#92400e" },
  normale: { bg: "#f3f4f6", text: "#374151" },
};
const FOURN_TOP = [
  { name:"KRAMP",count:286},{name:"GUILIANI",count:150},{name:"ADPL",count:126},
  {name:"HYDROKIT",count:126},{name:"VISSERIE SERVICE",count:122},{name:"AD SABLE",count:91},
  {name:"MDA",count:66},{name:"CCMB",count:63},
];

// ── UTILS ─────────────────────────────────────────────────────────────────────
function Badge({ status, map }) {
  const c = (map||STATUS_CONFIG)[status]||{bg:"#f3f4f6",text:"#374151",label:status};
  return <span style={{background:c.bg,color:c.text,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{c.label||status}</span>;
}

function Spinner() {
  return <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:40,gap:12,color:"#6b7280",fontSize:14}}>
    <div style={{width:20,height:20,border:"2px solid #e5e7eb",borderTopColor:"#3b82f6",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
    Chargement…
  </div>;
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({ stockOverrides, mouvements, ordres, products, user, navigateTo }) {
  const [time, setTime] = useState(new Date());
  useEffect(()=>{const t=setInterval(()=>setTime(new Date()),1000);return()=>clearInterval(t);},[]);
  const siteProducts = products || ALL_PRODUCTS;
  const getStock = p => stockOverrides[p.id]!==undefined ? stockOverrides[p.id] : p.stock;

  const stats = {
    total: siteProducts.length,
    ok: siteProducts.filter(p=>getStock(p)>0&&getStock(p)>=(p.min||0)).length,
    rupture: siteProducts.filter(p=>getStock(p)===0).length,
    faible: siteProducts.filter(p=>getStock(p)>0&&(p.min||0)>0&&getStock(p)<(p.min||0)).length,
    valeur: Math.round(siteProducts.reduce((a,p)=>a+getStock(p)*(p.prix||0),0)),
  };
  const alertes = siteProducts.filter(p=>getStock(p)>0&&(p.min||0)>0&&getStock(p)<(p.min||0)).slice(0,6);
  const orOuverts = ordres.filter(o=>o.statut!=="termine"&&o.statut!=="annule");
  const mouvJour = mouvements.filter(m=>new Date(m.created_at||m.date).toDateString()===new Date().toDateString());

  return (
    <div style={{display:"flex",flexDirection:"column",gap:22}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontSize:26,fontWeight:900,color:"#111827",margin:0}}>Tableau de bord</h1>
          <p style={{color:"#6b7280",margin:"4px 0 0",fontSize:13}}>{time.toLocaleDateString("fr-FR",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {user?.role==="admin"&&navigateTo&&(
            <button onClick={()=>navigateTo("admin")} style={{padding:"7px 14px",borderRadius:8,border:"1px solid #e5e7eb",background:"#fff",color:"#374151",fontWeight:600,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",gap:6}}>
              🛡️ Administration
            </button>
          )}
          <div style={{background:"#111827",color:"#fff",borderRadius:10,padding:"8px 16px",fontFamily:"monospace",fontSize:16,fontWeight:700}}>{time.toLocaleTimeString("fr-FR")}</div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:12}}>
        {[
          {label:"Références",value:stats.total.toLocaleString("fr-FR"),icon:"🗂",color:"#111827"},
          {label:"En stock",value:stats.ok.toLocaleString("fr-FR"),icon:"✅",color:"#059669"},
          {label:"Rupture",value:stats.rupture.toLocaleString("fr-FR"),icon:"🔴",color:"#dc2626"},
          {label:"Faible",value:stats.faible,icon:"⚠️",color:"#d97706"},
          {label:"Valeur stock",value:stats.valeur.toLocaleString("fr-FR")+" €",icon:"💶",color:"#3b82f6"},
          {label:"OR en cours",value:orOuverts.length,icon:"🔧",color:"#7c3aed"},
          {label:"Mouvements/jour",value:mouvJour.length,icon:"📥",color:"#0891b2"},
        ].map((k,i)=>(
          <div key={i} style={{background:"#fff",borderRadius:14,padding:"16px 18px",border:"1px solid #e5e7eb",boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
            <div style={{fontSize:22,marginBottom:6}}>{k.icon}</div>
            <div style={{fontSize:22,fontWeight:900,color:k.color,letterSpacing:-0.5}}>{k.value}</div>
            <div style={{fontSize:12,color:"#6b7280",marginTop:4}}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
        <div style={{background:"#111827",borderRadius:16,padding:22,color:"#fff"}}>
          <h3 style={{margin:"0 0 4px",fontWeight:800,fontSize:15}}>⚠️ Stock faible / critique</h3>
          <p style={{margin:"0 0 14px",fontSize:12,color:"#9ca3af"}}>Articles sous le seuil minimum</p>
          {alertes.length===0
            ? <div style={{color:"#9ca3af",fontSize:13}}>✅ Aucune alerte</div>
            : alertes.map(p=>(
              <div key={p.id} style={{padding:"9px 12px",background:"rgba(255,255,255,0.06)",borderRadius:9,marginBottom:7,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:600,fontSize:12,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                  <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>{p.fournisseur||"—"}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontWeight:800,color:"#fbbf24",fontSize:16}}>{getStock(p)}</div>
                  <div style={{fontSize:10,color:"#6b7280"}}>min: {p.min}</div>
                </div>
              </div>
            ))
          }
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{background:"#fff",borderRadius:16,padding:20,border:"1px solid #e5e7eb"}}>
            <h3 style={{margin:"0 0 14px",fontWeight:800,fontSize:15,color:"#111827"}}>🔧 Derniers OR</h3>
            {orOuverts.length===0
              ? <div style={{color:"#9ca3af",fontSize:13}}>Aucun OR en cours</div>
              : orOuverts.slice(0,4).map(o=>(
                <div key={o.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:"#f9fafb",borderRadius:9,marginBottom:7}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,color:"#111827"}}>{o.numero}</div>
                    <div style={{fontSize:11,color:"#6b7280"}}>{o.machine}</div>
                  </div>
                  <Badge status={o.statut} map={OR_STATUTS}/>
                </div>
              ))
            }
          </div>
          <div style={{background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",borderRadius:16,padding:20,color:"#fff"}}>
            <h3 style={{margin:"0 0 14px",fontWeight:800,fontSize:14}}>📥 Mouvements du jour</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[
                {l:"Entrées",v:mouvJour.filter(m=>m.type==="entree").length,c:"#a7f3d0"},
                {l:"Sorties",v:mouvJour.filter(m=>m.type==="sortie").length,c:"#fca5a5"},
                {l:"Total semaine",v:mouvements.filter(m=>{const d=new Date(m.created_at||m.date);const now=new Date();return(now-d)<7*86400000;}).length,c:"#bfdbfe"},
                {l:"Total mois",v:mouvements.filter(m=>{const d=new Date(m.created_at||m.date);const now=new Date();return d.getMonth()===now.getMonth();}).length,c:"#ddd6fe"},
              ].map(s=>(
                <div key={s.l} style={{background:"rgba(255,255,255,0.12)",borderRadius:10,padding:"10px 12px"}}>
                  <div style={{fontSize:20,fontWeight:900,color:s.c}}>{s.v}</div>
                  <div style={{fontSize:11,opacity:0.8,marginTop:2}}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── STOCK ─────────────────────────────────────────────────────────────────────
const PAGE_SIZE = 50;

// Stockage local des modifications
const STOCK_EDITS_KEY = "logiwms_stock_edits";
function loadStockEdits() { try { return JSON.parse(localStorage.getItem(STOCK_EDITS_KEY)||"{}"); } catch { return {}; } }
function saveStockEdits(d) { localStorage.setItem(STOCK_EDITS_KEY, JSON.stringify(d)); }

function Stock({ stockOverrides, setStockOverrides, products, user, siteId, customArticles=[], setCustomArticles, autoOpenNewArticle, setAutoOpenNewArticle }) {
  const [search,setSearch]=useState("");
  const [status,setStatus]=useState("tous");
  const [fourn,setFourn]=useState("");
  const [page,setPage]=useState(1);
  const [editArticle,setEditArticle]=useState(null);
  const [editForm,setEditForm]=useState({});
  const [stockEdits,setStockEdits]=useState(loadStockEdits);
  const [saving,setSaving]=useState(false);
  const [confirmDelete,setConfirmDelete]=useState(null);
  const [showNewArticle,setShowNewArticle]=useState(false);
  const [newArticleForm,setNewArticleForm]=useState({id:"",name:"",fournisseur:"",stock:0,min:0,prix:0,location:"",unit:"pcs"});
  const [savingNew,setSavingNew]=useState(false);

  // Auto-ouvrir le formulaire si demandé depuis Entrées/Sorties
  useEffect(()=>{
    if(autoOpenNewArticle){
      setNewArticleForm(f=>({...f, id:autoOpenNewArticle.id||"", name:autoOpenNewArticle.name||""}));
      setShowNewArticle(true);
      if(setAutoOpenNewArticle) setAutoOpenNewArticle(null);
    }
  },[autoOpenNewArticle]);

  const canDelete = user && (user.role==="admin" || user.role==="magasinier" || user.role==="magasinier_preparateur");
  const isAdmin = user && ["admin","magasinier","magasinier_preparateur"].includes(user.role);

  // Fusionner produits statiques + articles custom
  const allProducts = [...(products||ALL_PRODUCTS), ...(customArticles||[])];

  const handleAddNewArticle = async () => {
    if(!newArticleForm.id||!newArticleForm.name) return;
    setSavingNew(true);
    const article = {
      ...newArticleForm,
      id: newArticleForm.id.toUpperCase().trim(),
      stock: parseInt(newArticleForm.stock)||0,
      min: parseInt(newArticleForm.min)||0,
      prix: parseFloat(newArticleForm.prix)||0,
    };
    const saved = await addCatalogueArticle(siteId, article);
    if(saved) {
      const newCustom = {
        id: article.id, name: article.name, fournisseur: article.fournisseur,
        stock: article.stock, min: article.min, prix: article.prix,
        location: article.location, unit: article.unit, category:'',
        status: article.stock===0?'rupture':'ok',
      };
      setCustomArticles(prev=>[...prev, newCustom]);
      setNewArticleForm({id:"",name:"",fournisseur:"",stock:0,min:0,prix:0,location:"",unit:"pcs"});
      setShowNewArticle(false);
    } else {
      alert("Erreur lors de la création de l'article");
    }
    setSavingNew(false);
  };

  const handleDeleteStock = async (p) => {
    const newEdits = {...stockEdits};
    delete newEdits[p.id];
    setStockEdits(newEdits);
    saveStockEdits(newEdits);
    await deleteStockOverride(p.id);
    setStockOverrides(prev => { const n={...prev}; delete n[p.id]; return n; });
    // Si c'est un article custom (dans catalogues), le supprimer vraiment
    const isCustom = customArticles && customArticles.some(a=>a.id===p.id);
    if(isCustom && siteId) {
      await deleteCatalogueArticle(siteId, p.id);
      if(setCustomArticles) setCustomArticles(prev=>prev.filter(a=>a.id!==p.id));
    }
    setConfirmDelete(null);
  };

  // Fusionner les données de base avec les modifications locales
  const getArticle = p => ({ ...p, ...(stockEdits[p.id]||{}) });
  const getStock = p => {
    if (stockOverrides[p.id]!==undefined) return stockOverrides[p.id];
    const edit = stockEdits[p.id];
    return edit?.stock !== undefined ? edit.stock : p.stock;
  };

  const getStatus = p => {
    const s=getStock(p);
    const art=getArticle(p);
    if(s===0) return "rupture";
    if(art.min>0&&s<art.min*0.3) return "critical";
    if(art.min>0&&s<art.min) return "warning";
    return "ok";
  };

  const uniqueFourns=[...new Set(allProducts.map(p=>getArticle(p).fournisseur||p.fournisseur).filter(f=>f&&f!=="0"&&f!==","))].sort();

  const filtered=allProducts.filter(p=>{
    const art=getArticle(p);
    const s=search.toLowerCase();
    const ok=!s||(art.name||"").toLowerCase().includes(s)||(p.id||"").toLowerCase().includes(s)||(art.fournisseur||"").toLowerCase().includes(s)||(art.location||"").toLowerCase().includes(s);
    const st=getStatus(p);
    const okS=status==="tous"||st===status;
    const okF=!fourn||(art.fournisseur||p.fournisseur)===fourn;
    return ok&&okS&&okF;
  });

  const counts={ok:0,warning:0,critical:0,rupture:0};
  allProducts.forEach(p=>{counts[getStatus(p)]=(counts[getStatus(p)]||0)+1;});

  const totalPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const safe=Math.min(page,totalPages);
  const rows=filtered.slice((safe-1)*PAGE_SIZE,safe*PAGE_SIZE);

  const openEdit = (p) => {
    const art = getArticle(p);
    setEditArticle(p);
    setEditForm({
      fournisseur: art.fournisseur||p.fournisseur||"",
      location: art.location||p.location||"",
      stock: getStock(p),
      min: art.min||p.min||0,
      prix: art.prix||p.prix||0,
    });
  };

  const handleSave = async () => {
    if (!editArticle) return;
    setSaving(true);
    const newStock = parseInt(editForm.stock)||0;
    const updates = {
      fournisseur: editForm.fournisseur,
      location: editForm.location,
      stock: newStock,
      min: parseInt(editForm.min)||0,
      prix: parseFloat(editForm.prix)||0,
    };
    // Sauvegarder localement
    const newEdits = { ...stockEdits, [editArticle.id]: updates };
    setStockEdits(newEdits);
    saveStockEdits(newEdits);
    // Mettre à jour le stock override dans Supabase
    if (newStock !== getStock(editArticle)) {
      await setStockOverride(editArticle.id, newStock);
      setStockOverrides(prev => ({...prev,[editArticle.id]:newStock}));
    }
    setEditArticle(null);
    setSaving(false);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <h1 style={{fontSize:22,fontWeight:900,color:"#111827",margin:0}}>Stocks — <span style={{color:"#3b82f6"}}>{filtered.length.toLocaleString("fr-FR")}</span> références</h1>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {isAdmin&&<button onClick={()=>setShowNewArticle(true)} style={{background:"#111827",color:"#fff",border:"none",borderRadius:10,padding:"9px 16px",fontWeight:700,cursor:"pointer",fontSize:13}}>+ Nouvelle référence</button>}
          <div style={{fontSize:13,color:"#6b7280",background:"#f3f4f6",padding:"6px 14px",borderRadius:8}}>Page {safe}/{totalPages}</div>
        </div>
      </div>

      {/* Formulaire nouvelle référence */}
      {showNewArticle&&(
        <div style={{background:"#f0f9ff",borderRadius:14,border:"2px solid #bae6fd",padding:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <h3 style={{margin:0,fontWeight:800,color:"#0369a1",fontSize:15}}>➕ Nouvelle référence</h3>
            <button onClick={()=>setShowNewArticle(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#6b7280"}}>✕</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10,marginBottom:14}}>
            {[
              {l:"Référence (ID) *",k:"id",ph:"EX: AI407"},
              {l:"Désignation *",k:"name",ph:"Filtre à air..."},
              {l:"Fournisseur",k:"fournisseur",ph:"MANN, BOSCH..."},
              {l:"Stock initial",k:"stock",ph:"0",t:"number"},
              {l:"Stock minimum",k:"min",ph:"0",t:"number"},
              {l:"Prix unitaire (€)",k:"prix",ph:"0.00",t:"number"},
              {l:"Emplacement",k:"location",ph:"A1-B2..."},
              {l:"Unité",k:"unit",ph:"pcs"},
            ].map(f=>(
              <div key={f.k}>
                <label style={{fontSize:11,fontWeight:600,color:"#374151",display:"block",marginBottom:4}}>{f.l}</label>
                <input type={f.t||"text"} value={newArticleForm[f.k]} onChange={e=>setNewArticleForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} style={{width:"100%",padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
              </div>
            ))}
          </div>
          <button onClick={handleAddNewArticle} disabled={savingNew||!newArticleForm.id||!newArticleForm.name} style={{padding:"10px 24px",background:savingNew||!newArticleForm.id||!newArticleForm.name?"#e5e7eb":"#0369a1",color:savingNew||!newArticleForm.id||!newArticleForm.name?"#9ca3af":"#fff",border:"none",borderRadius:10,fontWeight:700,cursor:"pointer",fontSize:13}}>
            {savingNew?"⏳ Création…":"💾 Créer l'article"}
          </button>
        </div>
      )}
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="🔍  Rechercher article, SKU, fournisseur, emplacement…" style={{flex:1,minWidth:260,padding:"10px 16px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:14,outline:"none"}}/>
        <select value={fourn} onChange={e=>{setFourn(e.target.value);setPage(1);}} style={{padding:"10px 12px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",minWidth:160}}>
          <option value="">Tous fournisseurs</option>
          {uniqueFourns.map(f=><option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
        {[{v:"tous",l:`Tous (${allProducts.length})`},{v:"ok",l:`En stock (${counts.ok})`},{v:"rupture",l:`Rupture (${counts.rupture})`},{v:"critical",l:`Critique (${counts.critical})`},{v:"warning",l:`Faible (${counts.warning})`}].map(btn=>(
          <button key={btn.v} onClick={()=>{setStatus(btn.v);setPage(1);}} style={{padding:"7px 14px",borderRadius:9,border:`2px solid ${status===btn.v?"#111827":"#e5e7eb"}`,background:status===btn.v?"#111827":"#fff",color:status===btn.v?"#fff":"#374151",fontWeight:600,cursor:"pointer",fontSize:12}}>{btn.l}</button>
        ))}
      </div>
      <div style={{background:"#fff",borderRadius:14,border:"1px solid #e5e7eb",overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:"#111827"}}>
              {["SKU","Désignation","Fournisseur","Emplacement","Stock","Min.","Prix HT","Statut",""].map(h=>(
                <th key={h} style={{padding:"11px 14px",textAlign:"left",fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:0.5,whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {rows.map((p,i)=>{
                const art=getArticle(p);
                const s=getStock(p); const st=getStatus(p);
                const isEdited=!!stockEdits[p.id];
                return (
                  <tr key={p.id+i} style={{borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                    <td style={{padding:"10px 14px",fontFamily:"monospace",fontSize:11,color:"#6b7280",maxWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {p.id}
                      {isEdited&&<span style={{marginLeft:4,background:"#dbeafe",color:"#1e40af",fontSize:9,padding:"1px 5px",borderRadius:99,fontWeight:700}}>✏️</span>}
                    </td>
                    <td style={{padding:"10px 14px",maxWidth:230}}><div style={{fontWeight:600,fontSize:13,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{art.name||p.name}</div></td>
                    <td style={{padding:"10px 14px",fontSize:12,color:"#6b7280",whiteSpace:"nowrap"}}>{art.fournisseur||p.fournisseur||"—"}</td>
                    <td style={{padding:"10px 14px",fontFamily:"monospace",fontSize:12,fontWeight:600,color:"#374151"}}>{art.location||p.location}</td>
                    <td style={{padding:"10px 14px",textAlign:"center"}}><span style={{fontSize:16,fontWeight:900,color:s===0?"#dc2626":s<(art.min||p.min)&&(art.min||p.min)>0?"#d97706":"#111827"}}>{s}</span></td>
                    <td style={{padding:"10px 14px",textAlign:"center",fontSize:12,color:"#9ca3af"}}>{art.min||p.min}</td>
                    <td style={{padding:"10px 14px",textAlign:"right",fontSize:12,fontWeight:600,color:"#374151",whiteSpace:"nowrap"}}>{(art.prix||p.prix)>0?(art.prix||p.prix).toLocaleString("fr-FR",{minimumFractionDigits:2})+" €":"—"}</td>
                    <td style={{padding:"10px 14px"}}><Badge status={st}/></td>
                    <td style={{padding:"10px 14px"}}>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>openEdit(p)} style={{padding:"5px 12px",background:"#f3f4f6",border:"none",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:600,color:"#374151",whiteSpace:"nowrap"}}>✏️ Modifier</button>
                        {canDelete&&(
                          <button onClick={()=>setConfirmDelete(p)} style={{padding:"5px 10px",background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:8,cursor:"pointer",fontSize:12,color:"#dc2626",fontWeight:600}}>🗑</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:6,padding:"12px",borderTop:"1px solid #f3f4f6"}}>
          {[{l:"«",a:()=>setPage(1),d:safe===1},{l:"‹",a:()=>setPage(p=>Math.max(1,p-1)),d:safe===1}].map((b,i)=>(
            <button key={i} onClick={b.a} disabled={b.d} style={{padding:"6px 11px",borderRadius:7,border:"1px solid #e5e7eb",background:"#fff",cursor:b.d?"not-allowed":"pointer",color:b.d?"#d1d5db":"#374151",fontWeight:600,fontSize:13}}>{b.l}</button>
          ))}
          {Array.from({length:Math.min(5,totalPages)},(_,i)=>{const pg=Math.max(1,Math.min(safe-2+i,totalPages-4+i));return <button key={pg} onClick={()=>setPage(pg)} style={{padding:"6px 11px",borderRadius:7,border:`2px solid ${pg===safe?"#111827":"#e5e7eb"}`,background:pg===safe?"#111827":"#fff",color:pg===safe?"#fff":"#374151",fontWeight:700,fontSize:13,cursor:"pointer"}}>{pg}</button>;}).filter((_,i)=>{ const pg=Math.max(1,Math.min(safe-2+i,totalPages-4+i)); return pg>=1&&pg<=totalPages; })}
          {[{l:"›",a:()=>setPage(p=>Math.min(totalPages,p+1)),d:safe===totalPages},{l:"»",a:()=>setPage(totalPages),d:safe===totalPages}].map((b,i)=>(
            <button key={i} onClick={b.a} disabled={b.d} style={{padding:"6px 11px",borderRadius:7,border:"1px solid #e5e7eb",background:"#fff",cursor:b.d?"not-allowed":"pointer",color:b.d?"#d1d5db":"#374151",fontWeight:600,fontSize:13}}>{b.l}</button>
          ))}
        </div>
      </div>

      {/* Modal édition article */}
      {editArticle && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,backdropFilter:"blur(2px)"}}>
          <div style={{background:"#fff",borderRadius:20,padding:30,width:"min(96vw,480px)",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h2 style={{fontSize:17,fontWeight:800,color:"#111827",margin:0}}>✏️ Modifier l'article</h2>
              <button onClick={()=>setEditArticle(null)} style={{background:"#f3f4f6",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:15}}>✕</button>
            </div>
            <div style={{background:"#f9fafb",borderRadius:10,padding:"10px 14px",marginBottom:18,border:"1px solid #e5e7eb"}}>
              <div style={{fontWeight:700,fontSize:13,color:"#111827"}}>{editArticle.name}</div>
              <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>{editArticle.id}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:13}}>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>Fournisseur</label>
                <input value={editForm.fournisseur} onChange={e=>setEditForm(f=>({...f,fournisseur:e.target.value}))}
                  placeholder="Nom du fournisseur"
                  style={{width:"100%",padding:"10px 13px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>Emplacement</label>
                <input value={editForm.location} onChange={e=>setEditForm(f=>({...f,location:e.target.value}))}
                  placeholder="Ex: A-01-02"
                  style={{width:"100%",padding:"10px 13px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"monospace",letterSpacing:1}}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>Stock actuel</label>
                  <input type="number" min="0" value={editForm.stock} onChange={e=>setEditForm(f=>({...f,stock:e.target.value}))}
                    style={{width:"100%",padding:"10px 13px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:16,fontWeight:700,outline:"none",boxSizing:"border-box",color:"#059669"}}/>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>Stock minimum</label>
                  <input type="number" min="0" value={editForm.min} onChange={e=>setEditForm(f=>({...f,min:e.target.value}))}
                    style={{width:"100%",padding:"10px 13px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:16,fontWeight:700,outline:"none",boxSizing:"border-box",color:"#d97706"}}/>
                </div>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>Prix HT (€)</label>
                <input type="number" step="0.01" min="0" value={editForm.prix} onChange={e=>setEditForm(f=>({...f,prix:e.target.value}))}
                  style={{width:"100%",padding:"10px 13px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:14,fontWeight:700,outline:"none",boxSizing:"border-box",color:"#3b82f6"}}/>
              </div>
              <div style={{display:"flex",gap:10,marginTop:4}}>
                <button onClick={()=>setEditArticle(null)} style={{flex:1,padding:"12px",background:"#f3f4f6",border:"none",borderRadius:10,fontWeight:600,cursor:"pointer"}}>Annuler</button>
                <button onClick={handleSave} disabled={saving} style={{flex:2,padding:"12px",background:saving?"#9ca3af":"#111827",color:"#fff",border:"none",borderRadius:10,fontWeight:700,cursor:"pointer",fontSize:14}}>
                  {saving?"⏳ Enregistrement…":"💾 Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal confirmation suppression stock */}
      {confirmDelete&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
          <div style={{background:"#fff",borderRadius:20,padding:28,width:"min(96vw,400px)",boxShadow:"0 20px 60px rgba(0,0,0,0.2)",textAlign:"center"}}>
            <div style={{fontSize:44,marginBottom:12}}>🗑️</div>
            <h3 style={{fontSize:17,fontWeight:800,color:"#111827",marginBottom:8}}>Réinitialiser cet article ?</h3>
            <p style={{fontSize:13,color:"#374151",fontWeight:600,marginBottom:6}}>{confirmDelete.name}</p>
            <p style={{fontSize:12,color:"#9ca3af",marginBottom:20}}>Les modifications de stock, emplacement et prix seront supprimées. L'article reviendra à ses valeurs d'origine du catalogue.</p>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setConfirmDelete(null)} style={{flex:1,padding:"12px",background:"#f3f4f6",border:"none",borderRadius:10,fontWeight:600,cursor:"pointer",fontSize:14}}>Annuler</button>
              <button onClick={()=>handleDeleteStock(confirmDelete)} style={{flex:1,padding:"12px",background:"#dc2626",color:"#fff",border:"none",borderRadius:10,fontWeight:700,cursor:"pointer",fontSize:14}}>🗑 Réinitialiser</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── INLINE DELETE ─────────────────────────────────────────────────────────────
function InlineDelete({ onDelete }) {
  const [confirm, setConfirm] = useState(false);
  if (confirm) return (
    <div style={{display:"flex",gap:4,alignItems:"center"}}>
      <button
        onClick={()=>setConfirm(false)}
        style={{padding:"4px 8px",background:"#f3f4f6",border:"none",borderRadius:6,cursor:"pointer",fontSize:11,color:"#6b7280"}}>
        Non
      </button>
      <button
        onClick={()=>{ setConfirm(false); onDelete(); }}
        style={{padding:"4px 8px",background:"#dc2626",color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:700}}>
        Oui
      </button>
    </div>
  );
  return (
    <button
      onClick={()=>setConfirm(true)}
      style={{padding:"5px 10px",background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:8,cursor:"pointer",fontSize:13,color:"#dc2626",fontWeight:700,pointerEvents:"auto"}}>
      🗑
    </button>
  );
}

// ── ENTRÉES/SORTIES ───────────────────────────────────────────────────────────
function EntreesSorties({ mouvements, setMouvements, stockOverrides, setStockOverrides, siteId, products, user, navigateTo, setAutoOpenNewArticle }) {
  const [type,setType]=useState("entree");
  const [search,setSearch]=useState("");
  const [suggestions,setSuggestions]=useState([]);
  const [selectedArticle,setSelectedArticle]=useState(null);
  const [quantite,setQuantite]=useState("");
  const [prixUnitaire,setPrixUnitaire]=useState("");
  const [motif,setMotif]=useState("");
  const [reference,setReference]=useState("");
  const [bdc,setBdc]=useState("");
  const [filterType,setFilterType]=useState("tous");
  const [filterSearch,setFilterSearch]=useState("");
  const [showConfirm,setShowConfirm]=useState(false);
  const [saving,setSaving]=useState(false);
  const [page,setPage]=useState(1);
  const [fifoLots,setFifoLots]=useState([]);
  const [fifoResult,setFifoResult]=useState(null);
  const [confirmDeleteMouv,setConfirmDeleteMouv]=useState(null);
  const PAGE=20;

  const canDelete = user && (user.role==="admin" || user.role==="magasinier");

  const handleDeleteMouvement = async (m) => {
    await deleteMouvement(m.id);
    setMouvements(prev => prev.filter(x => String(x.id) !== String(m.id)));
    setConfirmDeleteMouv(null);
  };

  const getStock = p => stockOverrides[p.id]!==undefined ? stockOverrides[p.id] : p.stock;

  // Charger les lots FIFO quand on sélectionne un article
  const loadFifoLots = async (articleId) => {
    const lots = await getLotsArticle(articleId);
    setFifoLots(lots.filter(l => !l.clos && l.qty_restante > 0));
  };

  const handleSearch = v => {
    setSearch(v); setSelectedArticle(null); setFifoLots([]); setFifoResult(null);
    if(v.length<2){setSuggestions([]);return;}
    const s=v.toLowerCase();
    setSuggestions((products||ALL_PRODUCTS).filter(p=>(p.name||"").toLowerCase().includes(s)||(p.id||"").toLowerCase().includes(s)||(p.fournisseur||"").toLowerCase().includes(s)).slice(0,8));
  };

  // Re-déclencher la recherche quand les produits changent (ex: nouvel article créé)
  useEffect(()=>{
    if(search.length>=2 && !selectedArticle){
      const s=search.toLowerCase();
      setSuggestions((products||ALL_PRODUCTS).filter(p=>(p.name||"").toLowerCase().includes(s)||(p.id||"").toLowerCase().includes(s)||(p.fournisseur||"").toLowerCase().includes(s)).slice(0,8));
    }
  },[products]);

  const selectArticle = async (p) => {
    setSelectedArticle(p); setSearch(p.name); setSuggestions([]);
    setPrixUnitaire(p.prix > 0 ? String(p.prix) : "");
    setFifoResult(null);
    await loadFifoLots(p.id);
  };

  // Calculer le coût FIFO estimé pour la quantité saisie
  const calcFifoEstimate = (qty) => {
    if (!qty || fifoLots.length === 0) return null;
    let remaining = parseInt(qty);
    let totalCout = 0;
    const detail = [];
    for (const lot of fifoLots) {
      if (remaining <= 0) break;
      const pris = Math.min(remaining, lot.qty_restante);
      totalCout += pris * lot.prix_unitaire;
      detail.push({ qty: pris, prix: lot.prix_unitaire, date: lot.date_achat, fournisseur: lot.fournisseur });
      remaining -= pris;
    }
    return { totalCout: Math.round(totalCout * 10000) / 10000, detail, qtyManquante: remaining };
  };

  const fifoEstimate = type === "sortie" && quantite && parseInt(quantite) > 0 ? calcFifoEstimate(quantite) : null;

  const filtered = mouvements.filter(m=>{
    const okT=filterType==="tous"||m.type===filterType;
    const s=filterSearch.toLowerCase();
    const okS=!s||(m.article_name||m.articleName||"").toLowerCase().includes(s)||(m.article_id||m.articleId||"").toLowerCase().includes(s)||(m.motif||"").toLowerCase().includes(s);
    return okT&&okS;
  });
  const totalPages=Math.max(1,Math.ceil(filtered.length/PAGE));
  const rows=filtered.slice((page-1)*PAGE,page*PAGE);

  const handleConfirm = async () => {
    if(!selectedArticle||!quantite) return;
    setSaving(true);
    const qty=parseInt(quantite);
    const stockActuel=getStock(selectedArticle);
    const newStock=type==="entree"?stockActuel+qty:stockActuel-qty;

    // Appliquer FIFO si sortie et lots disponibles
    let coutFifo = null;
    if (type === "sortie" && fifoLots.length > 0) {
      const result = await consommerFIFO(selectedArticle.id, qty);
      coutFifo = result.totalCout;
      setFifoResult(result);
      // Recharger les lots
      await loadFifoLots(selectedArticle.id);
    }
    // Si entrée, créer un lot d'achat automatiquement si prix saisi
    if (type === "entree" && prixUnitaire && parseFloat(prixUnitaire) > 0) {
      await addLotAchat({
        articleId: selectedArticle.id,
        articleName: selectedArticle.name,
        fournisseur: selectedArticle.fournisseur || "",
        dateAchat: new Date().toISOString().split("T")[0],
        qty,
        prixUnitaire: parseFloat(prixUnitaire),
        referenceBon: reference || "",
        notes: motif || "",
      });
      await loadFifoLots(selectedArticle.id);
    }

    const mouvement={
      type, articleId:selectedArticle.id, articleName:selectedArticle.name,
      fournisseur:selectedArticle.fournisseur, quantite:qty,
      stockAvant:stockActuel, stockApres:newStock,
      motif:motif||(type==="entree"?"Réception fournisseur":"Consommation"),
      reference:reference||"",
      num_bdc: bdc||"",
      cout_fifo: coutFifo,
      prix_unitaire: prixUnitaire ? parseFloat(prixUnitaire) : null,
    };
    const saved = await addMouvementSite(mouvement, siteId);
    await setStockOverrideSite(selectedArticle.id, newStock, siteId);
    setMouvements(prev => [saved||{...mouvement,id:Date.now(),created_at:new Date().toISOString()}, ...prev]);
    setStockOverrides(prev => ({...prev,[selectedArticle.id]:newStock}));
    setSelectedArticle(null); setSearch(""); setQuantite(""); setPrixUnitaire(""); setMotif(""); setReference(""); setBdc(""); setShowConfirm(false);
    setSaving(false);
  };

  const totalEntrees=mouvements.filter(m=>m.type==="entree").reduce((a,m)=>a+m.quantite,0);
  const totalSorties=mouvements.filter(m=>m.type==="sortie").reduce((a,m)=>a+m.quantite,0);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div><h1 style={{fontSize:22,fontWeight:900,color:"#111827",margin:0}}>Entrées / Sorties de stock</h1>
        <p style={{color:"#6b7280",fontSize:13,margin:"4px 0 0"}}>{mouvements.length} mouvement{mouvements.length!==1?"s":""} · synchronisé en temps réel</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12}}>
        {[{label:"Total",value:mouvements.length,icon:"🔄",color:"#111827"},{label:"Entrées",value:totalEntrees.toLocaleString("fr-FR"),icon:"📥",color:"#059669"},{label:"Sorties",value:totalSorties.toLocaleString("fr-FR"),icon:"📤",color:"#dc2626"},{label:"Aujourd'hui",value:mouvements.filter(m=>new Date(m.created_at||m.date).toDateString()===new Date().toDateString()).length,icon:"📅",color:"#3b82f6"}].map((k,i)=>(
          <div key={i} style={{background:"#fff",borderRadius:14,padding:"16px 18px",border:"1px solid #e5e7eb"}}>
            <div style={{fontSize:22,marginBottom:6}}>{k.icon}</div>
            <div style={{fontSize:22,fontWeight:900,color:k.color}}>{k.value}</div>
            <div style={{fontSize:12,color:"#6b7280",marginTop:3}}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"360px 1fr",gap:20,alignItems:"start"}}>
        {/* Formulaire */}
        <div style={{background:"#fff",borderRadius:16,border:"1px solid #e5e7eb",padding:22,position:"sticky",top:0}}>
          <h3 style={{fontSize:15,fontWeight:800,color:"#111827",marginBottom:16}}>➕ Nouveau mouvement</h3>
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            {[{v:"entree",l:"📥 Entrée",bg:"#d1fae5",c:"#065f46",bc:"#059669"},{v:"sortie",l:"📤 Sortie",bg:"#fee2e2",c:"#991b1b",bc:"#dc2626"}].map(t=>(
              <button key={t.v} onClick={()=>setType(t.v)} style={{flex:1,padding:"11px",borderRadius:10,border:`2px solid ${type===t.v?t.bc:"#e5e7eb"}`,background:type===t.v?t.bg:"#fff",color:type===t.v?t.c:"#6b7280",fontWeight:700,cursor:"pointer",fontSize:14}}>{t.l}</button>
            ))}
          </div>
          <div style={{marginBottom:12,position:"relative"}}>
            <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>Article *</label>
            <input value={search} onChange={e=>handleSearch(e.target.value)} placeholder="Rechercher un article…" style={{width:"100%",padding:"10px 14px",border:`1px solid ${selectedArticle?"#10b981":"#e5e7eb"}`,borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
            {suggestions.length>0&&(
              <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,boxShadow:"0 8px 24px rgba(0,0,0,0.1)",zIndex:100,overflow:"hidden",marginTop:4}}>
                {suggestions.map(p=>(
                  <div key={p.id} onClick={()=>{setSelectedArticle(p);setSearch(p.name);setSuggestions([]);}} style={{padding:"9px 14px",cursor:"pointer",borderBottom:"1px solid #f3f4f6",display:"flex",justifyContent:"space-between"}}
                    onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"} onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                    <div><div style={{fontWeight:600,fontSize:13}}>{p.name}</div><div style={{fontSize:11,color:"#6b7280"}}>{p.id} · Stock : <strong style={{color:getStock(p)===0?"#dc2626":"#059669"}}>{getStock(p)}</strong></div></div>
                    <span style={{color:"#3b82f6",fontSize:12,fontWeight:600,alignSelf:"center"}}>+ Sélectionner</span>
                  </div>
                ))}
              </div>
            )}
            {/* Bouton "Ajouter un nouvel article" si aucun résultat */}
            {search.length>=2&&suggestions.length===0&&!selectedArticle&&(
              <div style={{marginTop:8,background:"#f0f9ff",border:"1px dashed #7dd3fc",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:"#0369a1"}}>"{search}" introuvable dans le catalogue</div>
                  <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>Voulez-vous créer ce nouvel article ?</div>
                </div>
                <button onClick={()=>{
                  setAutoOpenNewArticle({name:search, id:search.toUpperCase().replace(/\s+/g,"_").trim()});
                  navigateTo("stock");
                }} style={{padding:"8px 14px",background:"#0369a1",color:"#fff",border:"none",borderRadius:9,cursor:"pointer",fontWeight:700,fontSize:12,whiteSpace:"nowrap",marginLeft:12}}>
                  ➕ Créer l'article
                </button>
              </div>
            )}
          </div>
          {selectedArticle&&(
            <div style={{background:"#f9fafb",borderRadius:10,padding:"10px 14px",marginBottom:12,border:"1px solid #e5e7eb",fontSize:12}}>
              <div style={{fontWeight:700,color:"#111827"}}>{selectedArticle.name}</div>
              <div style={{color:"#6b7280",marginTop:3}}>📍 {selectedArticle.location} · Stock actuel : <strong style={{color:getStock(selectedArticle)===0?"#dc2626":"#059669"}}>{getStock(selectedArticle)}</strong></div>
            </div>
          )}
          <div style={{marginBottom:12}}>
            <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>Quantité *</label>
            <input type="number" min="1" value={quantite} onChange={e=>setQuantite(e.target.value)} placeholder="0" style={{width:"100%",padding:"10px 14px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:16,outline:"none",boxSizing:"border-box",fontWeight:700}}/>
            {selectedArticle&&quantite&&parseInt(quantite)>0&&(
              <div style={{fontSize:12,color:"#6b7280",marginTop:5,padding:"5px 10px",background:type==="entree"?"#f0fdf4":"#fff1f2",borderRadius:7}}>
                Stock après : <strong style={{color:type==="entree"?"#059669":"#dc2626",fontSize:14}}>{type==="entree"?getStock(selectedArticle)+parseInt(quantite):getStock(selectedArticle)-parseInt(quantite)}</strong>
              </div>
            )}
          </div>

          {/* PRIX — affiché toujours */}
          <div style={{marginBottom:12}}>
            <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>
              {type==="entree" ? "💶 Prix unitaire HT (€)" : "💶 Prix unitaire HT (€)"}
              {type==="entree" && <span style={{fontSize:10,color:"#3b82f6",marginLeft:6}}>→ créera un lot FIFO automatiquement</span>}
            </label>
            <input type="number" step="0.0001" min="0" value={prixUnitaire} onChange={e=>setPrixUnitaire(e.target.value)} placeholder="Ex: 15.0000"
              style={{width:"100%",padding:"10px 14px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:15,fontWeight:700,color:"#3b82f6",outline:"none",boxSizing:"border-box"}}/>
            {prixUnitaire && quantite && parseInt(quantite)>0 && (
              <div style={{fontSize:12,color:"#6b7280",marginTop:5,padding:"5px 10px",background:"#eff6ff",borderRadius:7}}>
                Valeur totale : <strong style={{color:"#3b82f6"}}>{(parseFloat(prixUnitaire||0)*parseInt(quantite||0)).toFixed(2)} €</strong>
              </div>
            )}
          </div>

          {/* FIFO — affiché seulement pour les sorties si des lots existent */}
          {type==="sortie" && fifoLots.length>0 && quantite && parseInt(quantite)>0 && fifoEstimate && (
            <div style={{marginBottom:12,padding:"12px 14px",background:"#fef3c7",borderRadius:10,border:"1px solid #fde68a"}}>
              <div style={{fontWeight:700,fontSize:12,color:"#92400e",marginBottom:8}}>⏭ Calcul FIFO automatique</div>
              {fifoEstimate.detail.map((d,i)=>(
                <div key={i} style={{fontSize:12,color:"#78350f",marginBottom:3,display:"flex",justifyContent:"space-between"}}>
                  <span>• {d.qty} unité{d.qty>1?"s":""} — lot du {new Date(d.date).toLocaleDateString("fr-FR")} {d.fournisseur&&`(${d.fournisseur})`}</span>
                  <span style={{fontWeight:700}}>{parseFloat(d.prix).toFixed(4)} €/u</span>
                </div>
              ))}
              {fifoEstimate.qtyManquante>0 && (
                <div style={{fontSize:12,color:"#dc2626",marginTop:4,fontWeight:600}}>⚠️ {fifoEstimate.qtyManquante} unité(s) sans lot FIFO</div>
              )}
              <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #fcd34d",display:"flex",justifyContent:"space-between",fontWeight:800,fontSize:13,color:"#92400e"}}>
                <span>💶 Coût FIFO total</span>
                <span>{fifoEstimate.totalCout.toFixed(2)} € ({(fifoEstimate.totalCout/parseInt(quantite)).toFixed(4)} €/u)</span>
              </div>
            </div>
          )}
          {type==="sortie" && fifoLots.length===0 && selectedArticle && (
            <div style={{marginBottom:12,padding:"10px 13px",background:"#f9fafb",borderRadius:9,border:"1px solid #e5e7eb",fontSize:12,color:"#9ca3af"}}>
              ℹ️ Aucun lot FIFO pour cet article — ajoutez des lots dans <strong>🏷️ Lots FIFO</strong>
            </div>
          )}
          <div style={{marginBottom:12}}>
            <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>Motif</label>
            <select value={motif} onChange={e=>setMotif(e.target.value)} style={{width:"100%",padding:"10px 14px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box"}}>
              {type==="entree"?<><option value="">Réception fournisseur</option><option>Retour client</option><option>Correction inventaire</option><option>Transfert interne</option><option>Autre</option></>
              :<><option value="">Consommation chantier</option><option>Ordre de réparation</option><option>Perte / Casse</option><option>Correction inventaire</option><option>Autre</option></>}
            </select>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>
              {type==="sortie"&&motif==="Ordre de réparation"?"N° OR":"N° bon / référence"}
            </label>
            <input value={reference} onChange={e=>setReference(e.target.value)} placeholder={type==="sortie"&&motif==="Ordre de réparation"?"OR-2026-0001…":"BL-2026-001, OR-2026-0001…"} style={{width:"100%",padding:"10px 14px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
          </div>
          <div style={{marginBottom:18}}>
            <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>
              {type==="sortie"?"N° chantier":"N° BDC"} <span style={{fontSize:10,color:"#9ca3af",fontWeight:400}}>{type==="sortie"?"":"(Bon de commande)"}</span>
            </label>
            <input value={bdc} onChange={e=>setBdc(e.target.value)} placeholder={type==="sortie"?"CH-2026-001…":"BDC-2026-001…"} style={{width:"100%",padding:"10px 14px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"monospace",letterSpacing:0.5}}/>
          </div>
          <button onClick={()=>setShowConfirm(true)} disabled={!selectedArticle||!quantite||parseInt(quantite)<=0} style={{width:"100%",padding:"13px",borderRadius:11,border:"none",cursor:selectedArticle&&quantite&&parseInt(quantite)>0?"pointer":"not-allowed",background:!selectedArticle||!quantite||parseInt(quantite)<=0?"#e5e7eb":type==="entree"?"#059669":"#dc2626",color:!selectedArticle||!quantite||parseInt(quantite)<=0?"#9ca3af":"#fff",fontWeight:800,fontSize:15}}>
            {type==="entree"?"📥 Valider l'entrée":"📤 Valider la sortie"}
          </button>
        </div>

        {/* Historique */}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <input value={filterSearch} onChange={e=>{setFilterSearch(e.target.value);setPage(1);}} placeholder="🔍  Rechercher dans l'historique…" style={{flex:1,minWidth:200,padding:"9px 14px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none"}}/>
            {["tous","entree","sortie"].map(f=>(
              <button key={f} onClick={()=>{setFilterType(f);setPage(1);}} style={{padding:"8px 14px",borderRadius:9,border:`2px solid ${filterType===f?"#111827":"#e5e7eb"}`,background:filterType===f?"#111827":"#fff",color:filterType===f?"#fff":"#374151",fontWeight:600,cursor:"pointer",fontSize:12}}>
                {f==="tous"?`Tous (${mouvements.length})`:f==="entree"?`📥 Entrées (${mouvements.filter(m=>m.type==="entree").length})`:`📤 Sorties (${mouvements.filter(m=>m.type==="sortie").length})`}
              </button>
            ))}
          </div>
          <div style={{background:"#fff",borderRadius:14,border:"1px solid #e5e7eb",overflow:"hidden"}}>
            {rows.length===0
              ? <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}><div style={{fontSize:36,marginBottom:10}}>📋</div><div style={{fontWeight:700,color:"#374151",marginBottom:6}}>Aucun mouvement</div><div style={{fontSize:13}}>Utilisez le formulaire pour enregistrer une entrée ou sortie.</div></div>
              : <>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{background:"#111827"}}>
                    {["Date","Type","Article","Qté","Avant","Après","Motif","Réf.","BDC",""].map(h=>(
                      <th key={h} style={{padding:"10px 12px",textAlign:"left",fontSize:10,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:0.5,whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {rows.map((m,i)=>{
                      const name=m.article_name||m.articleName||"";
                      const id=m.article_id||m.articleId||"";
                      const dt=new Date(m.created_at||m.date);
                      return (
                        <tr key={m.id||i} style={{borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                          <td style={{padding:"9px 12px",fontSize:11,color:"#6b7280",whiteSpace:"nowrap"}}>{dt.toLocaleDateString("fr-FR")}<br/><span style={{fontSize:10}}>{dt.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</span></td>
                          <td style={{padding:"9px 12px"}}><span style={{padding:"3px 8px",borderRadius:99,fontSize:10,fontWeight:700,background:m.type==="entree"?"#d1fae5":"#fee2e2",color:m.type==="entree"?"#065f46":"#991b1b"}}>{m.type==="entree"?"📥 Entrée":"📤 Sortie"}</span></td>
                          <td style={{padding:"9px 12px",maxWidth:180}}><div style={{fontWeight:600,fontSize:12,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div><div style={{fontSize:10,color:"#9ca3af"}}>{id}</div></td>
                          <td style={{padding:"9px 12px",textAlign:"center"}}><span style={{fontSize:15,fontWeight:900,color:m.type==="entree"?"#059669":"#dc2626"}}>{m.type==="entree"?"+":"-"}{m.quantite}</span></td>
                          <td style={{padding:"9px 12px",textAlign:"center",fontSize:12,color:"#6b7280",fontWeight:600}}>{m.stock_avant??m.stockAvant}</td>
                          <td style={{padding:"9px 12px",textAlign:"center"}}><span style={{fontSize:14,fontWeight:800,color:(m.stock_apres??m.stockApres)===0?"#dc2626":"#059669"}}>{m.stock_apres??m.stockApres}</span></td>
                          <td style={{padding:"9px 12px",fontSize:11,color:"#374151"}}>{m.motif||"—"}</td>
                          <td style={{padding:"9px 12px",fontSize:11,fontFamily:"monospace",color:"#6b7280"}}>{m.reference||"—"}</td>
                          <td style={{padding:"9px 12px",fontSize:11,fontFamily:"monospace",color:"#7c3aed",fontWeight:600}}>{m.num_bdc||"—"}</td>
                          <td style={{padding:"9px 12px",minWidth:90}}>
                            <InlineDelete onDelete={async()=>{
                              await deleteMouvement(m.id);
                              setMouvements(prev=>prev.filter(x=>String(x.id)!==String(m.id)));
                            }}/>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{display:"flex",justifyContent:"center",gap:6,padding:"12px",borderTop:"1px solid #f3f4f6"}}>
                  <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{padding:"5px 12px",borderRadius:7,border:"1px solid #e5e7eb",background:"#fff",cursor:page===1?"not-allowed":"pointer",color:page===1?"#d1d5db":"#374151",fontWeight:600}}>‹ Préc.</button>
                  <span style={{fontSize:13,color:"#6b7280",padding:"5px 8px"}}>Page {page}/{totalPages}</span>
                  <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{padding:"5px 12px",borderRadius:7,border:"1px solid #e5e7eb",background:"#fff",cursor:page===totalPages?"not-allowed":"pointer",color:page===totalPages?"#d1d5db":"#374151",fontWeight:600}}>Suiv. ›</button>
                </div>
              </>
            }
          </div>
        </div>
      </div>

      {showConfirm&&selectedArticle&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
          <div style={{background:"#fff",borderRadius:20,padding:32,width:"min(96vw,420px)",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:44,marginBottom:10}}>{type==="entree"?"📥":"📤"}</div>
              <h2 style={{fontSize:18,fontWeight:800,color:"#111827",margin:"0 0 6px"}}>Confirmer la {type==="entree"?"entrée":"sortie"}</h2>
            </div>
            <div style={{background:"#f9fafb",borderRadius:12,padding:16,marginBottom:20,display:"flex",flexDirection:"column",gap:8}}>
              {[
                {l:"Article",v:selectedArticle.name},{l:"Quantité",v:<span style={{fontWeight:900,fontSize:18,color:type==="entree"?"#059669":"#dc2626"}}>{type==="entree"?"+":"-"}{quantite}</span>},
                {l:"Stock avant",v:getStock(selectedArticle)},{l:"Stock après",v:<strong style={{color:type==="entree"?"#059669":"#dc2626",fontSize:16}}>{type==="entree"?getStock(selectedArticle)+parseInt(quantite):getStock(selectedArticle)-parseInt(quantite)}</strong>},
                ...(prixUnitaire?[{l:"Prix unitaire",v:<span style={{color:"#3b82f6",fontWeight:700}}>{parseFloat(prixUnitaire).toFixed(4)} €</span>}]:[]),
                ...(fifoEstimate&&type==="sortie"?[{l:"Coût FIFO",v:<span style={{color:"#92400e",fontWeight:800}}>{fifoEstimate.totalCout.toFixed(2)} €</span>}]:[]),
                {l:"Motif",v:motif||(type==="entree"?"Réception fournisseur":"Consommation chantier")},
                ...(reference?[{l:"Référence",v:reference}]:[]),
                ...(bdc?[{l:"N° BDC",v:<span style={{fontFamily:"monospace",fontWeight:700,color:"#7c3aed"}}>{bdc}</span>}]:[]),
              ].map(r=>(
                <div key={r.l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #e5e7eb",fontSize:13}}>
                  <span style={{color:"#6b7280"}}>{r.l}</span>
                  <span style={{fontWeight:600,color:"#111827",maxWidth:200,textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.v}</span>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setShowConfirm(false)} style={{flex:1,padding:"12px",background:"#f3f4f6",border:"none",borderRadius:10,fontWeight:600,cursor:"pointer"}}>Annuler</button>
              <button onClick={handleConfirm} disabled={saving} style={{flex:2,padding:"12px",background:saving?"#9ca3af":type==="entree"?"#059669":"#dc2626",color:"#fff",border:"none",borderRadius:10,fontWeight:800,cursor:saving?"not-allowed":"pointer",fontSize:14}}>
                {saving?"⏳ Enregistrement…":"✅ Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── GESTION FIFO ──────────────────────────────────────────────────────────────
function GestionFIFO() {
  const [onglet, setOnglet] = useState("lots");
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [lots, setLots] = useState([]);
  const [allLots, setAllLots] = useState([]);
  const [loadingLots, setLoadingLots] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ dateAchat: new Date().toISOString().split("T")[0], qty: "", prixUnitaire: "", fournisseur: "", referenceBon: "", notes: "" });
  const [showConso, setShowConso] = useState(false);
  const [qtyConso, setQtyConso] = useState("");
  const [consoResult, setConsoResult] = useState(null);
  const [filterSearch, setFilterSearch] = useState("");

  useEffect(() => {
    getAllLots().then(data => setAllLots(data));
  }, []);

  const handleSearch = v => {
    setSearch(v); setSelectedArticle(null); setLots([]);
    if (v.length < 2) { setSuggestions([]); return; }
    const s = v.toLowerCase();
    setSuggestions((products||ALL_PRODUCTS).filter(p => (p.name||"").toLowerCase().includes(s) || (p.id||"").toLowerCase().includes(s)).slice(0, 8));
  };

  const selectArticle = async p => {
    setSelectedArticle(p); setSearch(p.name); setSuggestions([]);
    setLoadingLots(true);
    const data = await getLotsArticle(p.id);
    setLots(data); setLoadingLots(false);
  };

  const handleAddLot = async () => {
    if (!selectedArticle || !form.qty || !form.prixUnitaire || !form.dateAchat) return;
    setSaving(true);
    const saved = await addLotAchat({
      articleId: selectedArticle.id,
      articleName: selectedArticle.name,
      fournisseur: form.fournisseur || selectedArticle.fournisseur,
      dateAchat: form.dateAchat,
      qty: parseInt(form.qty),
      prixUnitaire: parseFloat(form.prixUnitaire),
      devise: "EUR",
      referenceBon: form.referenceBon,
      notes: form.notes,
    });
    if (saved) {
      setLots(prev => [...prev, saved].sort((a, b) => new Date(a.date_achat) - new Date(b.date_achat)));
      setAllLots(prev => [saved, ...prev]);
    }
    setForm({ dateAchat: new Date().toISOString().split("T")[0], qty: "", prixUnitaire: "", fournisseur: "", referenceBon: "", notes: "" });
    setShowForm(false); setSaving(false);
  };

  const handleConsommer = async () => {
    if (!selectedArticle || !qtyConso) return;
    setSaving(true);
    const result = await consommerFIFO(selectedArticle.id, parseInt(qtyConso));
    setConsoResult(result);
    const updated = await getLotsArticle(selectedArticle.id);
    setLots(updated);
    const allUpdated = await getAllLots();
    setAllLots(allUpdated);
    setSaving(false);
    setQtyConso("");
  };

  const handleDelete = async (id) => {
    if (!confirm("Supprimer ce lot ?")) return;
    await deleteLotAchat(id);
    setLots(prev => prev.filter(l => l.id !== id));
    setAllLots(prev => prev.filter(l => l.id !== id));
  };

  // Stats FIFO de l'article sélectionné
  const lotsOuverts = lots.filter(l => !l.clos && l.qty_restante > 0);
  const lotsClos = lots.filter(l => l.clos || l.qty_restante === 0);
  const qtyDisponible = lotsOuverts.reduce((a, l) => a + l.qty_restante, 0);
  const valeurStock = lotsOuverts.reduce((a, l) => a + l.qty_restante * l.prix_unitaire, 0);
  const prixMoyen = qtyDisponible > 0 ? valeurStock / qtyDisponible : 0;
  const prochainLot = lotsOuverts[0];

  // Stats globales
  const totalLots = allLots.filter(l => !l.clos).length;
  const filteredAll = allLots.filter(l => {
    if (!filterSearch) return true;
    const s = filterSearch.toLowerCase();
    return l.article_name.toLowerCase().includes(s) || l.article_id.toLowerCase().includes(s) || (l.fournisseur || "").toLowerCase().includes(s);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#111827", margin: 0 }}>Lots d'achat — Méthode FIFO</h1>
          <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>Premier Entré, Premier Sorti · {totalLots} lots ouverts</p>
        </div>
        {selectedArticle && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowConso(true)} style={{ padding: "9px 16px", background: "#fee2e2", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 13, color: "#dc2626" }}>📤 Consommer FIFO</button>
            <button onClick={() => setShowForm(true)} style={{ background: "#111827", color: "#fff", border: "none", borderRadius: 10, padding: "9px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>+ Nouveau lot d'achat</button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        {[{ v: "lots", l: "🏷️ Par référence" }, { v: "global", l: "📋 Tous les lots" }].map(t => (
          <button key={t.v} onClick={() => setOnglet(t.v)} style={{ flex: 1, padding: "11px", border: "none", background: onglet === t.v ? "#111827" : "transparent", color: onglet === t.v ? "#fff" : "#6b7280", fontWeight: onglet === t.v ? 700 : 500, cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>{t.l}</button>
        ))}
      </div>

      {/* PAR RÉFÉRENCE */}
      {onglet === "lots" && (
        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 18, alignItems: "start" }}>
          {/* Sélecteur article */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 14 }}>🔍 Choisir une référence</h3>
            <div style={{ position: "relative", marginBottom: 14 }}>
              <input value={search} onChange={e => handleSearch(e.target.value)} placeholder="Rechercher SKU, nom…"
                style={{ width: "100%", padding: "10px 13px", border: `1px solid ${selectedArticle ? "#10b981" : "#e5e7eb"}`, borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              {suggestions.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", zIndex: 100, overflow: "hidden", marginTop: 4 }}>
                  {suggestions.map(p => (
                    <div key={p.id} onClick={() => selectArticle(p)} style={{ padding: "9px 14px", cursor: "pointer", borderBottom: "1px solid #f3f4f6" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>{p.id} · {p.fournisseur || "—"}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedArticle && (
              <>
                <div style={{ background: "#f9fafb", borderRadius: 10, padding: "12px 14px", marginBottom: 16, border: "1px solid #e5e7eb" }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: "#111827", marginBottom: 6 }}>{selectedArticle.name}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{selectedArticle.id} · {selectedArticle.fournisseur || "—"}</div>
                </div>

                {/* Stats FIFO */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                  {[
                    { l: "Qté disponible", v: qtyDisponible, c: "#059669" },
                    { l: "Valeur stock", v: valeurStock.toFixed(2) + " €", c: "#3b82f6" },
                    { l: "Prix moyen FIFO", v: prixMoyen.toFixed(4) + " €", c: "#7c3aed" },
                    { l: "Lots ouverts", v: lotsOuverts.length, c: "#d97706" },
                  ].map(s => (
                    <div key={s.l} style={{ background: "#f9fafb", borderRadius: 9, padding: "10px 12px", border: "1px solid #e5e7eb" }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: s.c }}>{s.v}</div>
                      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{s.l}</div>
                    </div>
                  ))}
                </div>

                {prochainLot && (
                  <div style={{ background: "#fef3c7", borderRadius: 10, padding: "10px 13px", border: "1px solid #fde68a", fontSize: 12 }}>
                    <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 3 }}>⏭ Prochain lot FIFO à consommer</div>
                    <div style={{ color: "#78350f" }}>📅 {new Date(prochainLot.date_achat).toLocaleDateString("fr-FR")} · <strong>{prochainLot.qty_restante}</strong> unités à <strong>{parseFloat(prochainLot.prix_unitaire).toFixed(4)} €</strong></div>
                    <div style={{ color: "#92400e", marginTop: 2 }}>{prochainLot.fournisseur || "—"} {prochainLot.reference_bon && `· ${prochainLot.reference_bon}`}</div>
                  </div>
                )}
              </>
            )}

            {!selectedArticle && (
              <div style={{ textAlign: "center", padding: 30, color: "#9ca3af", fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🏷️</div>
                Recherchez une référence pour voir ses lots d'achat
              </div>
            )}
          </div>

          {/* Liste des lots */}
          <div>
            {!selectedArticle ? (
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: 40, textAlign: "center", color: "#9ca3af" }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📦</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#374151" }}>Sélectionnez une référence</div>
              </div>
            ) : loadingLots ? <Spinner /> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {lots.length === 0 ? (
                  <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: 40, textAlign: "center" }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>🏷️</div>
                    <div style={{ fontWeight: 700, color: "#374151", marginBottom: 8 }}>Aucun lot d'achat</div>
                    <div style={{ color: "#9ca3af", fontSize: 13, marginBottom: 16 }}>Ajoutez le premier lot d'achat pour cette référence</div>
                    <button onClick={() => setShowForm(true)} style={{ padding: "10px 20px", background: "#111827", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>+ Ajouter un lot</button>
                  </div>
                ) : lots.map((lot, i) => {
                  const isClos = lot.clos || lot.qty_restante === 0;
                  const pctRestant = Math.round((lot.qty_restante / lot.qty_initiale) * 100);
                  const valeur = lot.qty_restante * lot.prix_unitaire;
                  const isNext = !isClos && i === lots.findIndex(l => !l.clos && l.qty_restante > 0);
                  return (
                    <div key={lot.id} style={{ background: "#fff", borderRadius: 14, border: `2px solid ${isNext ? "#f59e0b" : isClos ? "#f3f4f6" : "#e5e7eb"}`, padding: "16px 20px", opacity: isClos ? 0.65 : 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                            {isNext && <span style={{ background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700 }}>⏭ PROCHAIN FIFO</span>}
                            {isClos && <span style={{ background: "#f3f4f6", color: "#9ca3af", padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700 }}>✅ ÉPUISÉ</span>}
                            <span style={{ fontFamily: "monospace", fontSize: 12, color: "#6b7280" }}>📅 {new Date(lot.date_achat).toLocaleDateString("fr-FR")}</span>
                          </div>
                          <div style={{ fontSize: 13, color: "#374151" }}>
                            {lot.fournisseur && <span>🏭 {lot.fournisseur}</span>}
                            {lot.reference_bon && <span style={{ marginLeft: 8 }}>📄 {lot.reference_bon}</span>}
                          </div>
                          {lot.notes && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2, fontStyle: "italic" }}>{lot.notes}</div>}
                        </div>
                        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 22, fontWeight: 900, color: isClos ? "#9ca3af" : "#059669" }}>{lot.qty_restante}</div>
                            <div style={{ fontSize: 10, color: "#9ca3af" }}>/ {lot.qty_initiale} restantes</div>
                          </div>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 18, fontWeight: 900, color: "#3b82f6" }}>{parseFloat(lot.prix_unitaire).toFixed(4)} €</div>
                            <div style={{ fontSize: 10, color: "#9ca3af" }}>prix unitaire</div>
                          </div>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#7c3aed" }}>{valeur.toFixed(2)} €</div>
                            <div style={{ fontSize: 10, color: "#9ca3af" }}>valeur restante</div>
                          </div>
                          {!isClos && <button onClick={() => handleDelete(lot.id)} style={{ padding: "5px 9px", background: "#fee2e2", border: "none", borderRadius: 7, cursor: "pointer", color: "#dc2626", fontSize: 12 }}>🗑</button>}
                        </div>
                      </div>
                      <div style={{ background: "#f3f4f6", borderRadius: 99, height: 8, overflow: "hidden" }}>
                        <div style={{ width: `${pctRestant}%`, height: "100%", borderRadius: 99, background: isClos ? "#d1d5db" : isNext ? "#f59e0b" : "#3b82f6", transition: "width 0.5s" }} />
                      </div>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{pctRestant}% restant · Acheté {lot.qty_initiale} unités</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TOUS LES LOTS */}
      {onglet === "global" && (
        <div>
          <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)} placeholder="🔍 Rechercher article, fournisseur…"
            style={{ width: "100%", padding: "10px 16px", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", marginBottom: 14 }} />
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "#111827" }}>
                {["Date achat", "Article", "Fournisseur", "Qté achetée", "Qté restante", "Prix unitaire", "Valeur restante", "Statut"].map(h => (
                  <th key={h} style={{ padding: "10px 13px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filteredAll.map((lot, i) => {
                  const isClos = lot.clos || lot.qty_restante === 0;
                  const valeur = lot.qty_restante * lot.prix_unitaire;
                  return (
                    <tr key={lot.id} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa", opacity: isClos ? 0.6 : 1 }}>
                      <td style={{ padding: "10px 13px", fontSize: 12, color: "#374151", whiteSpace: "nowrap" }}>{new Date(lot.date_achat).toLocaleDateString("fr-FR")}</td>
                      <td style={{ padding: "10px 13px", maxWidth: 220 }}>
                        <div style={{ fontWeight: 600, fontSize: 12, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lot.article_name}</div>
                        <div style={{ fontSize: 10, color: "#9ca3af" }}>{lot.article_id}</div>
                      </td>
                      <td style={{ padding: "10px 13px", fontSize: 12, color: "#6b7280" }}>{lot.fournisseur || "—"}</td>
                      <td style={{ padding: "10px 13px", textAlign: "center", fontWeight: 700, color: "#374151" }}>{lot.qty_initiale}</td>
                      <td style={{ padding: "10px 13px", textAlign: "center" }}>
                        <span style={{ fontWeight: 900, fontSize: 15, color: isClos ? "#9ca3af" : "#059669" }}>{lot.qty_restante}</span>
                      </td>
                      <td style={{ padding: "10px 13px", textAlign: "right", fontWeight: 700, color: "#3b82f6" }}>{parseFloat(lot.prix_unitaire).toFixed(4)} €</td>
                      <td style={{ padding: "10px 13px", textAlign: "right", fontWeight: 600, color: "#7c3aed" }}>{valeur.toFixed(2)} €</td>
                      <td style={{ padding: "10px 13px" }}>
                        <span style={{ background: isClos ? "#f3f4f6" : "#d1fae5", color: isClos ? "#9ca3af" : "#065f46", padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700 }}>
                          {isClos ? "✅ Épuisé" : "🟢 Ouvert"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredAll.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>Aucun lot trouvé</div>}
          </div>
        </div>
      )}

      {/* Modal Nouveau lot */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(2px)" }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 30, width: "min(96vw,480px)", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111827", margin: 0 }}>🏷️ Nouveau lot d'achat</h2>
              <button onClick={() => setShowForm(false)} style={{ background: "#f3f4f6", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 15 }}>✕</button>
            </div>
            <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#065f46", fontWeight: 600 }}>
              📦 {selectedArticle?.name}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Date d'achat *</label>
                  <input type="date" value={form.dateAchat} onChange={e => setForm(p => ({ ...p, dateAchat: e.target.value }))}
                    style={{ width: "100%", padding: "10px 13px", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Quantité achetée *</label>
                  <input type="number" min="1" value={form.qty} onChange={e => setForm(p => ({ ...p, qty: e.target.value }))} placeholder="Ex: 5"
                    style={{ width: "100%", padding: "10px 13px", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 16, fontWeight: 700, outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Prix unitaire HT (€) *</label>
                <input type="number" step="0.0001" min="0" value={form.prixUnitaire} onChange={e => setForm(p => ({ ...p, prixUnitaire: e.target.value }))} placeholder="Ex: 15.00"
                  style={{ width: "100%", padding: "12px 13px", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 18, fontWeight: 900, color: "#3b82f6", outline: "none", boxSizing: "border-box" }} />
                {form.qty && form.prixUnitaire && (
                  <div style={{ marginTop: 5, fontSize: 12, color: "#059669", fontWeight: 600 }}>
                    💶 Valeur totale du lot : {(parseFloat(form.qty || 0) * parseFloat(form.prixUnitaire || 0)).toFixed(2)} €
                  </div>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Fournisseur</label>
                  <input value={form.fournisseur} onChange={e => setForm(p => ({ ...p, fournisseur: e.target.value }))} placeholder={selectedArticle?.fournisseur || "Fournisseur"}
                    style={{ width: "100%", padding: "10px 13px", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>N° bon de commande</label>
                  <input value={form.referenceBon} onChange={e => setForm(p => ({ ...p, referenceBon: e.target.value }))} placeholder="BC-2026-001"
                    style={{ width: "100%", padding: "10px 13px", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Notes</label>
                <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Remarques, conditions…"
                  style={{ width: "100%", padding: "10px 13px", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: "12px", background: "#f3f4f6", border: "none", borderRadius: 10, fontWeight: 600, cursor: "pointer" }}>Annuler</button>
                <button onClick={handleAddLot} disabled={saving || !form.qty || !form.prixUnitaire || !form.dateAchat}
                  style={{ flex: 2, padding: "12px", background: form.qty && form.prixUnitaire ? "#111827" : "#e5e7eb", color: form.qty && form.prixUnitaire ? "#fff" : "#9ca3af", border: "none", borderRadius: 10, fontWeight: 700, cursor: form.qty && form.prixUnitaire ? "pointer" : "not-allowed", fontSize: 14 }}>
                  {saving ? "⏳ Enregistrement…" : "🏷️ Ajouter ce lot"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Consommer FIFO */}
      {showConso && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 30, width: "min(96vw,440px)", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111827", margin: 0 }}>📤 Consommer FIFO</h2>
              <button onClick={() => { setShowConso(false); setConsoResult(null); }} style={{ background: "#f3f4f6", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 15 }}>✕</button>
            </div>
            {!consoResult ? (
              <>
                <div style={{ background: "#fef3c7", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#92400e" }}>
                  ⚡ Les unités seront prélevées sur les lots les plus anciens en premier (FIFO).
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Quantité à consommer</label>
                  <input type="number" min="1" value={qtyConso} onChange={e => setQtyConso(e.target.value)} placeholder="Ex: 3"
                    style={{ width: "100%", padding: "14px", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 22, fontWeight: 900, outline: "none", textAlign: "center", boxSizing: "border-box" }} />
                  {qtyConso && qtyDisponible > 0 && (
                    <div style={{ marginTop: 6, fontSize: 12, color: parseInt(qtyConso) > qtyDisponible ? "#dc2626" : "#059669", fontWeight: 600 }}>
                      {parseInt(qtyConso) > qtyDisponible ? `⚠️ Stock insuffisant (disponible: ${qtyDisponible})` : `✅ ${qtyDisponible - parseInt(qtyConso)} unités resteront après consommation`}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => { setShowConso(false); setConsoResult(null); }} style={{ flex: 1, padding: "12px", background: "#f3f4f6", border: "none", borderRadius: 10, fontWeight: 600, cursor: "pointer" }}>Annuler</button>
                  <button onClick={handleConsommer} disabled={saving || !qtyConso || parseInt(qtyConso) > qtyDisponible}
                    style={{ flex: 2, padding: "12px", background: qtyConso && parseInt(qtyConso) <= qtyDisponible ? "#dc2626" : "#e5e7eb", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                    {saving ? "⏳ Traitement…" : "📤 Consommer"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ background: "#d1fae5", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontWeight: 800, color: "#065f46", marginBottom: 8 }}>✅ Consommation FIFO effectuée</div>
                  {consoResult.consumed.map((c, i) => (
                    <div key={i} style={{ fontSize: 13, color: "#047857", marginBottom: 4 }}>
                      • {c.qtyPrise} unité{c.qtyPrise > 1 ? "s" : ""} à {parseFloat(c.prixUnit).toFixed(4)} € — lot du {new Date(c.lot.date_achat).toLocaleDateString("fr-FR")}
                    </div>
                  ))}
                  <div style={{ marginTop: 10, padding: "8px 12px", background: "#f0fdf4", borderRadius: 8, fontWeight: 700, color: "#065f46" }}>
                    💶 Coût total FIFO : <strong>{consoResult.totalCout.toFixed(2)} €</strong>
                    {consoResult.consumed.length > 0 && <span style={{ fontWeight: 400, fontSize: 12, marginLeft: 8 }}>({(consoResult.totalCout / consoResult.consumed.reduce((a, c) => a + c.qtyPrise, 0)).toFixed(4)} €/u)</span>}
                  </div>
                  {consoResult.qtyManquante > 0 && (
                    <div style={{ marginTop: 8, color: "#dc2626", fontWeight: 600, fontSize: 13 }}>⚠️ {consoResult.qtyManquante} unité(s) manquante(s) — stock insuffisant</div>
                  )}
                </div>
                <button onClick={() => { setShowConso(false); setConsoResult(null); }} style={{ width: "100%", padding: "12px", background: "#111827", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Fermer</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal confirmation suppression mouvement */}
      {confirmDeleteMouv&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
          <div style={{background:"#fff",borderRadius:20,padding:28,width:"min(96vw,400px)",boxShadow:"0 20px 60px rgba(0,0,0,0.2)",textAlign:"center"}}>
            <div style={{fontSize:44,marginBottom:12}}>🗑️</div>
            <h3 style={{fontSize:17,fontWeight:800,color:"#111827",marginBottom:8}}>Supprimer ce mouvement ?</h3>
            <div style={{background:"#f9fafb",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13}}>
              <div style={{fontWeight:600,color:confirmDeleteMouv.type==="entree"?"#059669":"#dc2626"}}>{confirmDeleteMouv.type==="entree"?"📥 Entrée":"📤 Sortie"} · {confirmDeleteMouv.quantite} unité{confirmDeleteMouv.quantite>1?"s":""}</div>
              <div style={{color:"#6b7280",marginTop:3}}>{confirmDeleteMouv.article_name||confirmDeleteMouv.articleName}</div>
              <div style={{color:"#9ca3af",fontSize:11,marginTop:2}}>{new Date(confirmDeleteMouv.created_at).toLocaleString("fr-FR")}</div>
            </div>
            <p style={{fontSize:12,color:"#9ca3af",marginBottom:20}}>⚠️ Cette action ne modifie pas le stock — uniquement l'historique.</p>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setConfirmDeleteMouv(null)} style={{flex:1,padding:"12px",background:"#f3f4f6",border:"none",borderRadius:10,fontWeight:600,cursor:"pointer"}}>Annuler</button>
              <button onClick={()=>handleDeleteMouvement(confirmDeleteMouv)} style={{flex:1,padding:"12px",background:"#dc2626",color:"#fff",border:"none",borderRadius:10,fontWeight:700,cursor:"pointer"}}>🗑 Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ORDRES DE RÉPARATION ──────────────────────────────────────────────────────
// ── ÉQUIVALENCES ──────────────────────────────────────────────────────────────
// ── GESTION DES PRIX ──────────────────────────────────────────────────────────
function GestionPrix({ prixFournisseurs, setPrixFournisseurs, historiquePrix, setHistoriquePrix, products }) {
  const [onglet,setOnglet]=useState("comparaison");
  const [search,setSearch]=useState("");
  const [selectedArticle,setSelectedArticle]=useState(null);
  const [suggestions,setSuggestions]=useState([]);
  const [showForm,setShowForm]=useState(false);
  const [showImport,setShowImport]=useState(false);
  const [saving,setSaving]=useState(false);
  const [filterSearch,setFilterSearch]=useState("");
  const [form,setForm]=useState({fournisseur:"",prixHT:"",devise:"EUR",delaiLivraison:"",quantiteMin:"1",notes:""});

  const handleSearchArticle = v => {
    setSearch(v); setSelectedArticle(null);
    if(v.length<2){setSuggestions([]);return;}
    const s=v.toLowerCase();
    setSuggestions((products||ALL_PRODUCTS).filter(p=>(p.name||"").toLowerCase().includes(s)||(p.id||"").toLowerCase().includes(s)).slice(0,7));
  };

  const handleAddPrix = async () => {
    if(!selectedArticle||!form.fournisseur||!form.prixHT) return;
    setSaving(true);
    const nouveauPrix=parseFloat(form.prixHT);
    const existing=prixFournisseurs.find(p=>p.article_id===selectedArticle.id&&p.fournisseur===form.fournisseur);
    if(existing) {
      await addHistoriquePrix({articleId:selectedArticle.id,articleName:selectedArticle.name,fournisseur:form.fournisseur,ancienPrix:existing.prix_ht,nouveauPrix,motif:"Mise à jour manuelle"});
      await updatePrixFournisseur(existing.id,{prix_ht:nouveauPrix,devise:form.devise,delai_livraison:parseInt(form.delaiLivraison)||0,quantite_min:parseInt(form.quantiteMin)||1,notes:form.notes});
      setPrixFournisseurs(prev=>prev.map(p=>p.id===existing.id?{...p,prix_ht:nouveauPrix,devise:form.devise,delai_livraison:parseInt(form.delaiLivraison)||0,quantite_min:parseInt(form.quantiteMin)||1,notes:form.notes}:p));
      setHistoriquePrix(prev=>[{id:Date.now(),created_at:new Date().toISOString(),article_id:selectedArticle.id,article_name:selectedArticle.name,fournisseur:form.fournisseur,ancien_prix:existing.prix_ht,nouveau_prix:nouveauPrix,motif:"Mise à jour manuelle"},...prev]);
    } else {
      const saved=await addPrixFournisseur({articleId:selectedArticle.id,articleName:selectedArticle.name,fournisseur:form.fournisseur,prixHT:nouveauPrix,devise:form.devise,delaiLivraison:parseInt(form.delaiLivraison)||0,quantiteMin:parseInt(form.quantiteMin)||1,notes:form.notes});
      setPrixFournisseurs(prev=>[saved||{id:Date.now(),created_at:new Date().toISOString(),article_id:selectedArticle.id,article_name:selectedArticle.name,fournisseur:form.fournisseur,prix_ht:nouveauPrix,devise:form.devise,delai_livraison:parseInt(form.delaiLivraison)||0,quantite_min:parseInt(form.quantiteMin)||1,notes:form.notes,actif:true},...prev]);
      await addHistoriquePrix({articleId:selectedArticle.id,articleName:selectedArticle.name,fournisseur:form.fournisseur,ancienPrix:null,nouveauPrix,motif:"Nouveau prix saisi"});
      setHistoriquePrix(prev=>[{id:Date.now(),created_at:new Date().toISOString(),article_id:selectedArticle.id,article_name:selectedArticle.name,fournisseur:form.fournisseur,ancien_prix:null,nouveau_prix:nouveauPrix,motif:"Nouveau prix saisi"},...prev]);
    }
    setForm({fournisseur:"",prixHT:"",devise:"EUR",delaiLivraison:"",quantiteMin:"1",notes:""});
    setShowForm(false); setSaving(false);
  };

  const handleDelete = async (id) => {
    if(!confirm("Supprimer ce prix ?")) return;
    await deletePrixFournisseur(id);
    setPrixFournisseurs(prev=>prev.filter(p=>p.id!==id));
  };

  const handleImportExcel = (e) => {
    const file=e.target.files[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=async(ev)=>{
      try {
        const XLSX=window.XLSX;
        if(!XLSX){alert("Bibliothèque Excel non chargée. Rechargez la page.");return;}
        const wb=XLSX.read(ev.target.result,{type:"array"});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const data=XLSX.utils.sheet_to_json(ws);
        let imported=0;
        for(const row of data) {
          const articleId=String(row["SKU"]||row["ID"]||row["Référence"]||"").trim();
          const fournisseur=String(row["Fournisseur"]||"").trim();
          const prixHT=parseFloat(row["Prix HT"]||row["Prix"]||0);
          if(!articleId||!fournisseur||!prixHT) continue;
          const prod=(products||ALL_PRODUCTS).find(p=>p.id===articleId||(p.name||"").toLowerCase()===articleId.toLowerCase());
          if(!prod) continue;
          const saved=await addPrixFournisseur({articleId:prod.id,articleName:prod.name,fournisseur,prixHT,devise:String(row["Devise"]||"EUR"),delaiLivraison:parseInt(row["Délai (j)"]||0),quantiteMin:parseInt(row["Qté min"]||1),notes:String(row["Notes"]||"")});
          setPrixFournisseurs(prev=>[saved||{id:Date.now()+imported,created_at:new Date().toISOString(),article_id:prod.id,article_name:prod.name,fournisseur,prix_ht:prixHT,devise:"EUR",delai_livraison:0,quantite_min:1,notes:"",actif:true},...prev]);
          imported++;
        }
        alert(`✅ ${imported} prix importés avec succès !`);
        setShowImport(false);
      } catch(err) { alert("Erreur lors de l'import : "+err.message); }
    };
    reader.readAsArrayBuffer(file);
  };

  // Grouper les prix par article pour comparaison
  const grouped={};
  prixFournisseurs.forEach(p=>{
    if(!grouped[p.article_id]) grouped[p.article_id]={articleId:p.article_id,articleName:p.article_name,prix:[]};
    grouped[p.article_id].prix.push(p);
  });

  const groupesFiltres=Object.values(grouped).filter(g=>{
    if(!filterSearch) return true;
    const s=filterSearch.toLowerCase();
    return g.articleName.toLowerCase().includes(s)||g.articleId.toLowerCase().includes(s)||g.prix.some(p=>p.fournisseur.toLowerCase().includes(s));
  });

  const histFiltre=historiquePrix.filter(h=>{
    if(!filterSearch) return true;
    const s=filterSearch.toLowerCase();
    return h.article_name.toLowerCase().includes(s)||h.fournisseur.toLowerCase().includes(s);
  }).slice(0,100);

  const totalPrix=prixFournisseurs.length;
  const articlesAvecMultiPrix=Object.values(grouped).filter(g=>g.prix.length>1).length;
  const economiesPotentielles=Object.values(grouped).filter(g=>g.prix.length>1).reduce((acc,g)=>{
    const prices=g.prix.map(p=>p.prix_ht);
    return acc+(Math.max(...prices)-Math.min(...prices));
  },0);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:900,color:"#111827",margin:0}}>Gestion des prix</h1>
          <p style={{color:"#6b7280",fontSize:13,margin:"4px 0 0"}}>{totalPrix} prix enregistrés · {articlesAvecMultiPrix} articles avec plusieurs fournisseurs</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setShowImport(true)} style={{padding:"9px 16px",background:"#f3f4f6",border:"none",borderRadius:10,fontWeight:600,cursor:"pointer",fontSize:13,color:"#374151"}}>📊 Import Excel</button>
          <button onClick={()=>setShowForm(true)} style={{background:"#111827",color:"#fff",border:"none",borderRadius:10,padding:"9px 18px",fontWeight:700,cursor:"pointer",fontSize:13}}>+ Ajouter un prix</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12}}>
        {[
          {label:"Prix enregistrés",value:totalPrix,icon:"💶",color:"#111827"},
          {label:"Articles multi-fourn.",value:articlesAvecMultiPrix,icon:"🏭",color:"#3b82f6"},
          {label:"Écart max potentiel",value:economiesPotentielles.toFixed(2)+" €",icon:"📉",color:"#059669"},
          {label:"Variations historiques",value:historiquePrix.length,icon:"📈",color:"#7c3aed"},
        ].map((k,i)=>(
          <div key={i} style={{background:"#fff",borderRadius:14,padding:"16px 18px",border:"1px solid #e5e7eb"}}>
            <div style={{fontSize:22,marginBottom:6}}>{k.icon}</div>
            <div style={{fontSize:20,fontWeight:900,color:k.color}}>{k.value}</div>
            <div style={{fontSize:12,color:"#6b7280",marginTop:3}}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Onglets */}
      <div style={{display:"flex",gap:8,borderBottom:"2px solid #e5e7eb",paddingBottom:0}}>
        {[{v:"comparaison",l:"🏭 Comparaison fournisseurs"},{v:"historique",l:"📈 Historique des prix"}].map(t=>(
          <button key={t.v} onClick={()=>setOnglet(t.v)} style={{padding:"10px 18px",borderRadius:"10px 10px 0 0",border:"none",background:onglet===t.v?"#111827":"transparent",color:onglet===t.v?"#fff":"#6b7280",fontWeight:onglet===t.v?700:500,cursor:"pointer",fontSize:13,marginBottom:-2,borderBottom:onglet===t.v?"2px solid #111827":"none"}}>{t.l}</button>
        ))}
      </div>

      <input value={filterSearch} onChange={e=>setFilterSearch(e.target.value)} placeholder="🔍  Rechercher article, fournisseur…" style={{padding:"10px 16px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none"}}/>

      {/* Comparaison fournisseurs */}
      {onglet==="comparaison"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {groupesFiltres.length===0?(
            <div style={{background:"#fff",borderRadius:14,border:"1px solid #e5e7eb",padding:50,textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:12}}>💶</div>
              <div style={{fontWeight:700,fontSize:16,color:"#374151",marginBottom:8}}>Aucun prix enregistré</div>
              <div style={{color:"#9ca3af",fontSize:13,marginBottom:20}}>Ajoutez des prix manuellement ou importez un fichier Excel.</div>
              <button onClick={()=>setShowForm(true)} style={{padding:"10px 24px",background:"#111827",color:"#fff",border:"none",borderRadius:10,fontWeight:700,cursor:"pointer",fontSize:14}}>+ Ajouter un prix</button>
            </div>
          ):groupesFiltres.map(g=>{
            const minPrix=Math.min(...g.prix.map(p=>p.prix_ht));
            const maxPrix=Math.max(...g.prix.map(p=>p.prix_ht));
            const ecart=maxPrix-minPrix;
            const meilleurfournisseur=g.prix.find(p=>p.prix_ht===minPrix);
            return (
              <div key={g.articleId} style={{background:"#fff",borderRadius:14,border:"1px solid #e5e7eb",padding:"18px 22px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,flexWrap:"wrap",gap:10}}>
                  <div>
                    <div style={{fontWeight:800,fontSize:14,color:"#111827"}}>{g.articleName}</div>
                    <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>{g.articleId} · {g.prix.length} fournisseur{g.prix.length>1?"s":""}</div>
                  </div>
                  {g.prix.length>1&&(
                    <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:"8px 14px",textAlign:"center"}}>
                      <div style={{fontSize:11,color:"#6b7280"}}>Meilleur prix</div>
                      <div style={{fontSize:18,fontWeight:900,color:"#059669"}}>{minPrix.toFixed(2)} €</div>
                      <div style={{fontSize:11,color:"#059669"}}>{meilleurfournisseur?.fournisseur}</div>
                    </div>
                  )}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {g.prix.sort((a,b)=>a.prix_ht-b.prix_ht).map((p,i)=>{
                    const isBest=p.prix_ht===minPrix&&g.prix.length>1;
                    const isWorst=p.prix_ht===maxPrix&&g.prix.length>1;
                    const barPct=maxPrix>0?Math.round((p.prix_ht/maxPrix)*100):100;
                    return (
                      <div key={p.id} style={{padding:"12px 14px",borderRadius:10,background:isBest?"#f0fdf4":isWorst?"#fff1f2":"#f9fafb",border:`1px solid ${isBest?"#bbf7d0":isWorst?"#fecaca":"#e5e7eb"}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <div style={{fontWeight:700,fontSize:13,color:"#111827"}}>{p.fournisseur}</div>
                            {isBest&&<span style={{background:"#d1fae5",color:"#065f46",padding:"2px 8px",borderRadius:99,fontSize:10,fontWeight:700}}>✅ Meilleur prix</span>}
                            {isWorst&&g.prix.length>1&&<span style={{background:"#fee2e2",color:"#991b1b",padding:"2px 8px",borderRadius:99,fontSize:10,fontWeight:700}}>⚠️ Plus cher</span>}
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:12}}>
                            <div style={{textAlign:"right"}}>
                              <div style={{fontSize:20,fontWeight:900,color:isBest?"#059669":isWorst?"#dc2626":"#111827"}}>{p.prix_ht.toFixed(2)} <span style={{fontSize:12}}>{p.devise}</span></div>
                              {g.prix.length>1&&!isBest&&<div style={{fontSize:11,color:"#dc2626"}}>+{(p.prix_ht-minPrix).toFixed(2)} € vs meilleur</div>}
                            </div>
                            <button onClick={()=>handleDelete(p.id)} style={{padding:"5px 8px",background:"#fee2e2",border:"none",borderRadius:7,cursor:"pointer",color:"#dc2626",fontSize:12}}>🗑</button>
                          </div>
                        </div>
                        <div style={{background:"#e5e7eb",borderRadius:99,height:5,overflow:"hidden"}}>
                          <div style={{width:`${barPct}%`,height:"100%",borderRadius:99,background:isBest?"#059669":isWorst?"#dc2626":"#3b82f6",transition:"width 0.5s"}}/>
                        </div>
                        <div style={{display:"flex",gap:16,marginTop:6,fontSize:11,color:"#9ca3af"}}>
                          {p.delai_livraison>0&&<span>🚚 Délai : {p.delai_livraison} j</span>}
                          {p.quantite_min>1&&<span>📦 Min : {p.quantite_min} unités</span>}
                          {p.notes&&<span>💬 {p.notes}</span>}
                          <span>Mis à jour : {new Date(p.created_at).toLocaleDateString("fr-FR")}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {g.prix.length>1&&ecart>0&&(
                  <div style={{marginTop:10,padding:"8px 12px",background:"#eff6ff",borderRadius:8,fontSize:12,color:"#1e40af"}}>
                    💡 Économie potentielle en choisissant le meilleur fournisseur : <strong>{ecart.toFixed(2)} €</strong> par unité
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Historique des prix */}
      {onglet==="historique"&&(
        <div style={{background:"#fff",borderRadius:14,border:"1px solid #e5e7eb",overflow:"hidden"}}>
          {histFiltre.length===0?(
            <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>
              <div style={{fontSize:36,marginBottom:10}}>📈</div>
              <div style={{fontWeight:700,color:"#374151",marginBottom:6}}>Aucun historique</div>
              <div style={{fontSize:13}}>Les variations de prix apparaîtront ici automatiquement.</div>
            </div>
          ):(
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{background:"#111827"}}>
                {["Date","Article","Fournisseur","Ancien prix","Nouveau prix","Variation","Motif"].map(h=>(
                  <th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:0.5,whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {histFiltre.map((h,i)=>{
                  const variation=h.ancien_prix?((h.nouveau_prix-h.ancien_prix)/h.ancien_prix*100):null;
                  const hausse=variation&&variation>0;
                  return (
                    <tr key={h.id||i} style={{borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                      <td style={{padding:"10px 14px",fontSize:11,color:"#6b7280",whiteSpace:"nowrap"}}>{new Date(h.created_at).toLocaleDateString("fr-FR")}</td>
                      <td style={{padding:"10px 14px",maxWidth:200}}>
                        <div style={{fontWeight:600,fontSize:12,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.article_name}</div>
                        <div style={{fontSize:10,color:"#9ca3af"}}>{h.article_id}</div>
                      </td>
                      <td style={{padding:"10px 14px",fontSize:12,color:"#374151"}}>{h.fournisseur}</td>
                      <td style={{padding:"10px 14px",textAlign:"right",fontSize:13,color:"#6b7280"}}>{h.ancien_prix!=null?h.ancien_prix.toFixed(2)+" €":"—"}</td>
                      <td style={{padding:"10px 14px",textAlign:"right"}}><span style={{fontSize:15,fontWeight:800,color:"#111827"}}>{h.nouveau_prix.toFixed(2)} €</span></td>
                      <td style={{padding:"10px 14px",textAlign:"center"}}>
                        {variation!=null?(
                          <span style={{background:hausse?"#fee2e2":"#d1fae5",color:hausse?"#991b1b":"#065f46",padding:"3px 8px",borderRadius:99,fontSize:11,fontWeight:700}}>
                            {hausse?"↑":"↓"} {Math.abs(variation).toFixed(1)}%
                          </span>
                        ):<span style={{color:"#9ca3af",fontSize:12}}>Nouveau</span>}
                      </td>
                      <td style={{padding:"10px 14px",fontSize:12,color:"#6b7280"}}>{h.motif||"—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal Ajouter prix */}
      {showForm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,backdropFilter:"blur(2px)"}}>
          <div style={{background:"#fff",borderRadius:20,padding:32,width:"min(96vw,520px)",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
              <h2 style={{fontSize:18,fontWeight:800,color:"#111827",margin:0}}>💶 Ajouter / modifier un prix</h2>
              <button onClick={()=>setShowForm(false)} style={{background:"#f3f4f6",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:16}}>✕</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {/* Recherche article */}
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>Article *</label>
                <div style={{position:"relative"}}>
                  <input value={search} onChange={e=>handleSearchArticle(e.target.value)} placeholder="Rechercher par nom ou SKU…"
                    style={{width:"100%",padding:"10px 14px",border:`1px solid ${selectedArticle?"#10b981":"#e5e7eb"}`,borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                  {suggestions.length>0&&(
                    <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,boxShadow:"0 8px 24px rgba(0,0,0,0.1)",zIndex:100,overflow:"hidden",marginTop:4}}>
                      {suggestions.map(p=>(
                        <div key={p.id} onClick={()=>{setSelectedArticle(p);setSearch(p.name);setSuggestions([]);setForm(f=>({...f,fournisseur:p.fournisseur||"",prixHT:p.prix>0?String(p.prix):""}));}}
                          style={{padding:"9px 14px",cursor:"pointer",borderBottom:"1px solid #f3f4f6",display:"flex",justifyContent:"space-between"}}
                          onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"} onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                          <div><div style={{fontWeight:600,fontSize:13}}>{p.name}</div><div style={{fontSize:11,color:"#6b7280"}}>{p.id} · Prix actuel : {p.prix>0?p.prix.toFixed(2)+" €":"—"}</div></div>
                          <span style={{color:"#3b82f6",fontSize:12,fontWeight:600,alignSelf:"center"}}>Sélectionner</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {selectedArticle&&<div style={{marginTop:8,padding:"8px 12px",background:"#f0fdf4",borderRadius:8,fontSize:12,color:"#065f46"}}>✅ {selectedArticle.name} · Prix catalogue : {selectedArticle.prix>0?selectedArticle.prix.toFixed(2)+" €":"—"}</div>}
              </div>
              {/* Fournisseur */}
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>Fournisseur *</label>
                <input value={form.fournisseur} onChange={e=>setForm(p=>({...p,fournisseur:e.target.value}))} placeholder="Nom du fournisseur"
                  style={{width:"100%",padding:"10px 14px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
              </div>
              {/* Prix + devise */}
              <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10}}>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>Prix HT *</label>
                  <input type="number" step="0.01" min="0" value={form.prixHT} onChange={e=>setForm(p=>({...p,prixHT:e.target.value}))} placeholder="0.00"
                    style={{width:"100%",padding:"10px 14px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:16,fontWeight:700,outline:"none",boxSizing:"border-box"}}/>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>Devise</label>
                  <select value={form.devise} onChange={e=>setForm(p=>({...p,devise:e.target.value}))} style={{padding:"10px 14px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",height:42}}>
                    {["EUR","USD","GBP","CHF","MAD"].map(d=><option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              {/* Délai + qté min */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>Délai livraison (jours)</label>
                  <input type="number" min="0" value={form.delaiLivraison} onChange={e=>setForm(p=>({...p,delaiLivraison:e.target.value}))} placeholder="0"
                    style={{width:"100%",padding:"10px 14px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>Quantité minimum</label>
                  <input type="number" min="1" value={form.quantiteMin} onChange={e=>setForm(p=>({...p,quantiteMin:e.target.value}))} placeholder="1"
                    style={{width:"100%",padding:"10px 14px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                </div>
              </div>
              {/* Notes */}
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>Notes</label>
                <input value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Conditions, remises, validité…"
                  style={{width:"100%",padding:"10px 14px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
              </div>
              <div style={{display:"flex",gap:10,marginTop:6}}>
                <button onClick={()=>setShowForm(false)} style={{flex:1,padding:"12px",background:"#f3f4f6",border:"none",borderRadius:10,fontWeight:600,cursor:"pointer"}}>Annuler</button>
                <button onClick={handleAddPrix} disabled={!selectedArticle||!form.fournisseur||!form.prixHT||saving}
                  style={{flex:2,padding:"12px",background:selectedArticle&&form.fournisseur&&form.prixHT?"#111827":"#e5e7eb",color:selectedArticle&&form.fournisseur&&form.prixHT?"#fff":"#9ca3af",border:"none",borderRadius:10,fontWeight:700,cursor:selectedArticle&&form.fournisseur&&form.prixHT?"pointer":"not-allowed",fontSize:14}}>
                  {saving?"⏳ Enregistrement…":"💾 Enregistrer le prix"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Import Excel */}
      {showImport&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
          <div style={{background:"#fff",borderRadius:20,padding:32,width:"min(96vw,480px)",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
              <h2 style={{fontSize:18,fontWeight:800,color:"#111827",margin:0}}>📊 Import Excel</h2>
              <button onClick={()=>setShowImport(false)} style={{background:"#f3f4f6",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:16}}>✕</button>
            </div>
            <div style={{background:"#f9fafb",borderRadius:12,padding:16,marginBottom:20,fontSize:13}}>
              <div style={{fontWeight:700,color:"#111827",marginBottom:10}}>Format attendu du fichier Excel :</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                {["SKU *","Fournisseur *","Prix HT *","Devise","Délai (j)","Qté min","Notes"].map(col=>(
                  <div key={col} style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:6,padding:"6px 10px",fontSize:12,fontWeight:col.includes("*")?"700":"400",color:col.includes("*")?"#111827":"#6b7280"}}>{col}</div>
                ))}
              </div>
              <div style={{marginTop:10,fontSize:12,color:"#6b7280"}}>* Colonnes obligatoires. Le SKU doit correspondre à votre catalogue.</div>
            </div>
            <label style={{display:"block",padding:"16px",background:"#eff6ff",border:"2px dashed #3b82f6",borderRadius:12,textAlign:"center",cursor:"pointer",color:"#1e40af",fontWeight:600,fontSize:14}}>
              📁 Cliquez pour sélectionner votre fichier Excel
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImportExcel} style={{display:"none"}}/>
            </label>
            <div style={{marginTop:12,textAlign:"center"}}>
              <button onClick={()=>setShowImport(false)} style={{padding:"8px 20px",background:"#f3f4f6",border:"none",borderRadius:9,fontWeight:600,cursor:"pointer",fontSize:13}}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Equivalences({ equivalences, setEquivalences, products }) {
  const [search, setSearch] = useState("");
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [searchEq, setSearchEq] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggEq, setSuggEq] = useState([]);

  const handleSearchArticle = v => {
    setSearch(v); setSelectedArticle(null);
    if(v.length<2){setSuggestions([]);return;}
    const s=v.toLowerCase();
    setSuggestions((products||ALL_PRODUCTS).filter(p=>(p.name||"").toLowerCase().includes(s)||(p.id||"").toLowerCase().includes(s)).slice(0,7));
  };

  const handleSearchEq = v => {
    setSearchEq(v);
    if(!selectedArticle||v.length<2){setSuggEq([]);return;}
    const s=v.toLowerCase();
    const eqIds=equivalences[selectedArticle.id]||[];
    setSuggEq((products||ALL_PRODUCTS).filter(p=>p.id!==selectedArticle.id&&!eqIds.includes(p.id)&&((p.name||"").toLowerCase().includes(s)||(p.id||"").toLowerCase().includes(s))).slice(0,7));
  };

  const handleAdd = async (p) => {
    await addEquivalence(selectedArticle.id, p.id);
    const updated={...equivalences};
    updated[selectedArticle.id]=[...(updated[selectedArticle.id]||[]),p.id];
    updated[p.id]=[...(updated[p.id]||[]),selectedArticle.id];
    setEquivalences(updated);
    setSearchEq(""); setSuggEq([]);
  };

  const handleRemove = async (articleId, eqId) => {
    await removeEquivalence(articleId, eqId);
    const updated={...equivalences};
    updated[articleId]=(updated[articleId]||[]).filter(x=>x!==eqId);
    updated[eqId]=(updated[eqId]||[]).filter(x=>x!==articleId);
    setEquivalences(updated);
  };

  const eqIds = selectedArticle ? (equivalences[selectedArticle.id]||[]) : [];
  const eqProducts = eqIds.map(id=>(products||ALL_PRODUCTS).find(p=>p.id===id)).filter(Boolean);
  const totalGroupes = Object.keys(equivalences).filter(id=>equivalences[id].length>0).length;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div>
        <h1 style={{fontSize:22,fontWeight:900,color:"#111827",margin:0}}>Références équivalentes</h1>
        <p style={{color:"#6b7280",fontSize:13,margin:"4px 0 0"}}>{totalGroupes} article{totalGroupes!==1?"s":""} avec équivalences · synchronisé Supabase 🔄</p>
      </div>

      <div style={{background:"#dbeafe",borderRadius:12,padding:"14px 18px",fontSize:13,color:"#1e40af"}}>
        💡 Recherchez un article, puis ajoutez ses équivalents. En cas de rupture, le logiciel suggère automatiquement les équivalents disponibles.
      </div>

      <div style={{display:"grid",gridTemplateColumns:"360px 1fr",gap:20,alignItems:"start"}}>
        {/* Recherche article */}
        <div style={{background:"#fff",borderRadius:16,border:"1px solid #e5e7eb",padding:22}}>
          <h3 style={{fontSize:15,fontWeight:800,color:"#111827",marginBottom:14}}>🔍 Sélectionner un article</h3>
          <div style={{position:"relative",marginBottom:16}}>
            <input value={search} onChange={e=>handleSearchArticle(e.target.value)}
              placeholder="Rechercher par nom, SKU…"
              style={{width:"100%",padding:"10px 14px",border:`1px solid ${selectedArticle?"#10b981":"#e5e7eb"}`,borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
            {suggestions.length>0&&(
              <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,boxShadow:"0 8px 24px rgba(0,0,0,0.1)",zIndex:100,overflow:"hidden",marginTop:4}}>
                {suggestions.map(p=>(
                  <div key={p.id} onClick={()=>{setSelectedArticle(p);setSearch(p.name);setSuggestions([]);setSearchEq("");setSuggEq([]);}}
                    style={{padding:"9px 14px",cursor:"pointer",borderBottom:"1px solid #f3f4f6",display:"flex",justifyContent:"space-between"}}
                    onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"} onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                    <div><div style={{fontWeight:600,fontSize:13,color:"#111827"}}>{p.name}</div><div style={{fontSize:11,color:"#6b7280"}}>{p.id}</div></div>
                    <span style={{color:"#3b82f6",fontSize:12,fontWeight:600,alignSelf:"center"}}>Sélectionner</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedArticle&&(
            <>
              <div style={{background:"#f9fafb",borderRadius:10,padding:"12px 14px",marginBottom:16,border:"1px solid #e5e7eb"}}>
                <div style={{fontWeight:700,fontSize:13,color:"#111827",marginBottom:4}}>{selectedArticle.name}</div>
                <div style={{fontSize:12,color:"#6b7280"}}>
                  {selectedArticle.id} · {selectedArticle.fournisseur||"—"}<br/>
                  Stock : <strong style={{color:selectedArticle.stock===0?"#dc2626":"#059669"}}>{selectedArticle.stock}</strong> · {selectedArticle.location}
                </div>
              </div>

              <h3 style={{fontSize:14,fontWeight:700,color:"#111827",marginBottom:10}}>➕ Ajouter un équivalent</h3>
              <div style={{position:"relative"}}>
                <input value={searchEq} onChange={e=>handleSearchEq(e.target.value)}
                  placeholder="Rechercher l'article équivalent…"
                  style={{width:"100%",padding:"10px 14px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                {suggEq.length>0&&(
                  <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,boxShadow:"0 8px 24px rgba(0,0,0,0.1)",zIndex:100,overflow:"hidden",marginTop:4}}>
                    {suggEq.map(p=>(
                      <div key={p.id} onClick={()=>handleAdd(p)}
                        style={{padding:"9px 14px",cursor:"pointer",borderBottom:"1px solid #f3f4f6",display:"flex",justifyContent:"space-between"}}
                        onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"} onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                        <div><div style={{fontWeight:600,fontSize:13}}>{p.name}</div><div style={{fontSize:11,color:"#6b7280"}}>{p.id} · stock : <strong style={{color:p.stock===0?"#dc2626":"#059669"}}>{p.stock}</strong></div></div>
                        <span style={{color:"#3b82f6",fontSize:12,fontWeight:600,alignSelf:"center"}}>+ Ajouter</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Équivalences de l'article sélectionné */}
        <div style={{background:"#fff",borderRadius:16,border:"1px solid #e5e7eb",padding:22}}>
          {!selectedArticle?(
            <div style={{textAlign:"center",padding:40,color:"#9ca3af"}}>
              <div style={{fontSize:40,marginBottom:12}}>↔️</div>
              <div style={{fontWeight:700,fontSize:15,color:"#374151",marginBottom:6}}>Sélectionnez un article</div>
              <div style={{fontSize:13}}>Recherchez un article à gauche pour voir et gérer ses équivalences.</div>
            </div>
          ):(
            <>
              <h3 style={{fontSize:15,fontWeight:800,color:"#111827",marginBottom:4}}>
                Équivalences de : {selectedArticle.name.slice(0,40)}{selectedArticle.name.length>40?"…":""}
              </h3>
              <p style={{fontSize:12,color:"#6b7280",marginBottom:16}}>{eqProducts.length} équivalent{eqProducts.length!==1?"s":""} défini{eqProducts.length!==1?"s":""}</p>
              {eqProducts.length===0?(
                <div style={{padding:24,textAlign:"center",background:"#f9fafb",borderRadius:10,color:"#9ca3af",fontSize:13}}>
                  Aucune équivalence — utilisez la recherche à gauche pour en ajouter
                </div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {eqProducts.map(p=>(
                    <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",borderRadius:10,background:p.stock>0?"#f0fdf4":"#fff1f2",border:`1px solid ${p.stock>0?"#bbf7d0":"#fecaca"}`}}>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:13,color:"#111827"}}>{p.name}</div>
                        <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>{p.id} · {p.fournisseur||"—"} · {p.location}</div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontWeight:800,fontSize:18,color:p.stock===0?"#dc2626":"#059669"}}>{p.stock}</div>
                          <div style={{fontSize:10,color:"#9ca3af"}}>en stock</div>
                        </div>
                        <button onClick={()=>handleRemove(selectedArticle.id,p.id)} style={{padding:"5px 10px",background:"#fee2e2",border:"none",borderRadius:8,cursor:"pointer",color:"#dc2626",fontSize:12,fontWeight:600}}>✕ Retirer</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function OrdresReparation({ ordres, setOrdres, mouvements, setMouvements, stockOverrides, setStockOverrides, user, siteId, products }) {
  const [showForm,setShowForm]=useState(false);
  const [ficheOrdre,setFicheOrdre]=useState(null);
  const [filterStatut,setFilterStatut]=useState("tous");
  const [filterSearch,setFilterSearch]=useState("");
  const [saving,setSaving]=useState(false);
  const [confirmDeleteOR,setConfirmDeleteOR]=useState(null);
  const [parcSearch,setParcSearch]=useState("");
  const [parcSugg,setParcSugg]=useState([]);

  const canDelete = user && (user.role==="admin" || user.role==="magasinier");
  const [selectedVehicle,setSelectedVehicle]=useState(null);
  const [form,setForm]=useState({machine:"",immat:"",typePanne:"",technicien:"",priorite:"normale",description:""});

  const handleParcSearch = v => {
    setParcSearch(v); setSelectedVehicle(null);
    setForm(f=>({...f,machine:v,immat:""}));
    if(v.length<2){setParcSugg([]);return;}
    const s=v.toLowerCase();
    setParcSugg(PARC_VEHICULES.filter(p=>
      p.name.toLowerCase().includes(s)||
      p.num.toLowerCase().includes(s)||
      p.immat.toLowerCase().includes(s)||
      p.marque.toLowerCase().includes(s)||
      p.modele.toLowerCase().includes(s)
    ).slice(0,8));
  };

  const selectVehicle = v => {
    setSelectedVehicle(v);
    setParcSearch(`${v.num} — ${v.name}`);
    setParcSugg([]);
    setForm(f=>({...f, machine:`${v.num} — ${v.name}`, immat:v.immat||""}));
  };

  const handleCreate = async () => {
    if(!form.machine||!form.typePanne) return;
    setSaving(true);
    const newOrdre={
      numero:`OR-${new Date().getFullYear()}-${String(ordres.length+1).padStart(4,"0")}`,
      dateOuverture:new Date().toISOString(), dateCloture:null, statut:"ouvert",
      ...form, pieces:[], notes:"",
    };
    const saved = await createOrdre(newOrdre);
    const ordreAvecId = saved ? {...newOrdre, id:saved.id} : {...newOrdre, id:Date.now()};
    setOrdres(prev=>[ordreAvecId,...prev]);
    setShowForm(false);
    setForm({machine:"",immat:"",typePanne:"",technicien:"",priorite:"normale",description:""});
    setParcSearch(""); setSelectedVehicle(null);
    setFicheOrdre(ordreAvecId);
    setSaving(false);
  };

  const handleUpdate = async (updated) => {
    await updateOrdre(updated);
    setOrdres(prev=>prev.map(o=>o.id===updated.id?updated:o));
    setFicheOrdre(updated);
  };

  const handleDelete = async (id) => {
    if(!confirm("Supprimer cet OR ?")) return;
    await deleteOrdre(id);
    setOrdres(prev=>prev.filter(o=>o.id!==id));
  };

  const getStock = p => stockOverrides[p.id]!==undefined ? stockOverrides[p.id] : p.stock;

  const handleSortirPiece = async (ordre, piece) => {
    const prod=(products||ALL_PRODUCTS).find(p=>p.id===piece.id);
    if(!prod) return;
    const stockActuel=getStock(prod);
    if(stockActuel<piece.qte){alert(`Stock insuffisant ! Disponible : ${stockActuel}`);return;}
    const newStock=stockActuel-piece.qte;
    const mouvement={type:"sortie",articleId:prod.id,articleName:prod.name,fournisseur:prod.fournisseur,
      quantite:piece.qte,stockAvant:stockActuel,stockApres:newStock,
      motif:`OR ${ordre.numero} — ${ordre.machine}`,reference:ordre.numero};
    const saved=await addMouvement(mouvement);
    await setStockOverride(prod.id,newStock);
    setMouvements(prev=>[saved||{...mouvement,id:Date.now(),created_at:new Date().toISOString()},...prev]);
    setStockOverrides(prev=>({...prev,[prod.id]:newStock}));
    const updatedOrdre={...ordre,pieces:ordre.pieces.map(p=>p.id===piece.id?{...p,sortie:true,dateSortie:new Date().toISOString()}:p)};
    handleUpdate(updatedOrdre);
  };

  const filtered=ordres.filter(o=>{
    const okS=filterStatut==="tous"||o.statut===filterStatut;
    const s=filterSearch.toLowerCase();
    const okSearch=!s||o.numero.toLowerCase().includes(s)||o.machine.toLowerCase().includes(s)||(o.immat||"").toLowerCase().includes(s)||o.typePanne.toLowerCase().includes(s)||(o.technicien||"").toLowerCase().includes(s);
    return okS&&okSearch;
  });

  const stats={total:ordres.length,ouvert:ordres.filter(o=>o.statut==="ouvert").length,en_cours:ordres.filter(o=>o.statut==="en_cours").length,en_attente:ordres.filter(o=>o.statut==="en_attente").length,termine:ordres.filter(o=>o.statut==="termine").length};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div><h1 style={{fontSize:22,fontWeight:900,color:"#111827",margin:0}}>Ordres de réparation</h1>
          <p style={{color:"#6b7280",fontSize:13,margin:"4px 0 0"}}>{ordres.length} OR · synchronisé en temps réel 🔄</p></div>
        <button onClick={()=>setShowForm(true)} style={{background:"#111827",color:"#fff",border:"none",borderRadius:10,padding:"11px 20px",fontWeight:700,cursor:"pointer",fontSize:14}}>+ Nouvel OR</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:12}}>
        {[{label:"Total",value:stats.total,icon:"🔧",color:"#111827"},{label:"Ouverts",value:stats.ouvert,icon:"📂",color:"#1e40af"},{label:"En cours",value:stats.en_cours,icon:"⚙️",color:"#d97706"},{label:"En attente",value:stats.en_attente,icon:"⏳",color:"#7c3aed"},{label:"Terminés",value:stats.termine,icon:"✅",color:"#059669"}].map((k,i)=>(
          <div key={i} style={{background:"#fff",borderRadius:14,padding:"16px 18px",border:"1px solid #e5e7eb"}}>
            <div style={{fontSize:22,marginBottom:6}}>{k.icon}</div>
            <div style={{fontSize:24,fontWeight:900,color:k.color}}>{k.value}</div>
            <div style={{fontSize:12,color:"#6b7280",marginTop:3}}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <input value={filterSearch} onChange={e=>setFilterSearch(e.target.value)} placeholder="🔍  Rechercher numéro, machine, immat, technicien…" style={{flex:1,minWidth:250,padding:"10px 16px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none"}}/>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {[{v:"tous",l:"Tous"},...Object.entries(OR_STATUTS).map(([k,v])=>({v:k,l:v.label}))].map(f=>(
            <button key={f.v} onClick={()=>setFilterStatut(f.v)} style={{padding:"8px 14px",borderRadius:9,border:`2px solid ${filterStatut===f.v?"#111827":"#e5e7eb"}`,background:filterStatut===f.v?"#111827":"#fff",color:filterStatut===f.v?"#fff":"#374151",fontWeight:600,cursor:"pointer",fontSize:12}}>{f.l}</button>
          ))}
        </div>
      </div>

      {filtered.length===0?(
        <div style={{background:"#fff",borderRadius:14,border:"1px solid #e5e7eb",padding:50,textAlign:"center"}}>
          <div style={{fontSize:44,marginBottom:12}}>🔧</div>
          <div style={{fontWeight:700,fontSize:16,color:"#374151",marginBottom:8}}>Aucun ordre de réparation</div>
          <div style={{color:"#9ca3af",fontSize:13,marginBottom:20}}>Créez votre premier OR</div>
          <button onClick={()=>setShowForm(true)} style={{padding:"10px 24px",background:"#111827",color:"#fff",border:"none",borderRadius:10,fontWeight:700,cursor:"pointer",fontSize:14}}>+ Créer un OR</button>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filtered.map(o=>{
            const nbPieces=o.pieces.length;
            const nbSorties=o.pieces.filter(p=>p.sortie).length;
            const totalCout=o.pieces.reduce((a,p)=>a+(p.prix||0)*p.qte,0);
            return (
              <div key={o.id} style={{background:"#fff",borderRadius:14,border:`1px solid ${o.priorite==="urgente"?"#fca5a5":"#e5e7eb"}`,padding:"18px 22px",cursor:"pointer"}}
                onClick={()=>setFicheOrdre(o)} onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"} onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:5,flexWrap:"wrap"}}>
                      <span style={{fontFamily:"monospace",fontWeight:800,fontSize:15,color:"#111827"}}>{o.numero}</span>
                      <Badge status={o.statut} map={OR_STATUTS}/><Badge status={o.priorite} map={OR_PRIORITES}/>
                    </div>
                    <div style={{fontWeight:700,fontSize:15,color:"#111827",marginBottom:3}}>🚗 {o.machine}{o.immat?` — ${o.immat}`:""}</div>
                    <div style={{fontSize:13,color:"#6b7280"}}>🔧 {o.typePanne}{o.technicien?` · 👤 ${o.technicien}`:""}</div>
                    {o.description&&<div style={{fontSize:12,color:"#9ca3af",marginTop:3,fontStyle:"italic"}}>{o.description.slice(0,80)}{o.description.length>80?"…":""}</div>}
                  </div>
                  <div style={{display:"flex",gap:14,alignItems:"center",flexWrap:"wrap"}}>
                    {nbPieces>0&&<><div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:900,color:"#3b82f6"}}>{nbPieces}</div><div style={{fontSize:11,color:"#9ca3af"}}>pièces</div></div>
                    <div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:900,color:nbSorties===nbPieces?"#059669":"#d97706"}}>{nbSorties}/{nbPieces}</div><div style={{fontSize:11,color:"#9ca3af"}}>sorties</div></div></>}
                    {totalCout>0&&<div style={{textAlign:"center"}}><div style={{fontSize:14,fontWeight:800,color:"#111827"}}>{totalCout.toFixed(0)} €</div><div style={{fontSize:11,color:"#9ca3af"}}>coût</div></div>}
                    <div style={{textAlign:"right"}}><div style={{fontSize:11,color:"#9ca3af"}}>Ouvert le</div><div style={{fontSize:12,fontWeight:600,color:"#374151"}}>{new Date(o.dateOuverture).toLocaleDateString("fr-FR")}</div></div>
                    {canDelete&&<button onClick={e=>{e.stopPropagation();setConfirmDeleteOR(o);}} style={{padding:"6px 10px",background:"#fee2e2",border:"none",borderRadius:8,cursor:"pointer",color:"#dc2626",fontSize:13}}>🗑</button>}
                  </div>
                </div>
                {nbPieces>0&&<div style={{marginTop:10,height:5,background:"#f3f4f6",borderRadius:99,overflow:"hidden"}}><div style={{width:`${Math.round((nbSorties/nbPieces)*100)}%`,height:"100%",background:nbSorties===nbPieces?"#059669":"#3b82f6",borderRadius:99,transition:"width 0.4s"}}/></div>}
              </div>
            );
          })}
        </div>
      )}

      {/* Fiche OR détaillée */}
      {ficheOrdre&&(
        <FicheOR ordre={ficheOrdre} onClose={()=>setFicheOrdre(null)} onUpdate={handleUpdate} onSortir={handleSortirPiece} stockOverrides={stockOverrides} getStock={p=>stockOverrides[p.id]!==undefined?stockOverrides[p.id]:p.stock}/>
      )}

      {/* Modal confirmation suppression OR */}
      {confirmDeleteOR&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
          <div style={{background:"#fff",borderRadius:20,padding:28,width:"min(96vw,400px)",boxShadow:"0 20px 60px rgba(0,0,0,0.2)",textAlign:"center"}}>
            <div style={{fontSize:44,marginBottom:12}}>🗑️</div>
            <h3 style={{fontSize:17,fontWeight:800,color:"#111827",marginBottom:8}}>Supprimer cet OR ?</h3>
            <div style={{background:"#f9fafb",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13}}>
              <div style={{fontWeight:700,color:"#111827",fontFamily:"monospace"}}>{confirmDeleteOR.numero}</div>
              <div style={{color:"#6b7280",marginTop:3}}>🚗 {confirmDeleteOR.machine}</div>
              <div style={{color:"#9ca3af",fontSize:11,marginTop:2}}>{confirmDeleteOR.typePanne}</div>
            </div>
            <p style={{fontSize:12,color:"#9ca3af",marginBottom:20}}>⚠️ Cette action est irréversible.</p>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setConfirmDeleteOR(null)} style={{flex:1,padding:"12px",background:"#f3f4f6",border:"none",borderRadius:10,fontWeight:600,cursor:"pointer"}}>Annuler</button>
              <button onClick={async()=>{await handleDelete(confirmDeleteOR.id);setConfirmDeleteOR(null);}} style={{flex:1,padding:"12px",background:"#dc2626",color:"#fff",border:"none",borderRadius:10,fontWeight:700,cursor:"pointer"}}>🗑 Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nouvel OR */}
      {showForm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
          <div style={{background:"#fff",borderRadius:20,padding:32,width:"min(96vw,500px)",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
              <h2 style={{fontSize:18,fontWeight:800,color:"#111827",margin:0}}>🔧 Nouvel OR</h2>
              <button onClick={()=>setShowForm(false)} style={{background:"#f3f4f6",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:16}}>✕</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {/* Sélecteur parc véhicules */}
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>Véhicule / Engin du parc *</label>
                <div style={{position:"relative"}}>
                  <input value={parcSearch} onChange={e=>handleParcSearch(e.target.value)}
                    placeholder="🔍 N° parc, désignation, immat, marque…"
                    style={{width:"100%",padding:"10px 13px",border:`1px solid ${selectedVehicle?"#10b981":"#e5e7eb"}`,borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                  {parcSugg.length>0&&(
                    <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,boxShadow:"0 8px 24px rgba(0,0,0,0.12)",zIndex:200,overflow:"hidden",marginTop:4,maxHeight:260,overflowY:"auto"}}>
                      {parcSugg.map((v,i)=>(
                        <div key={i} onClick={()=>selectVehicle(v)} style={{padding:"9px 14px",cursor:"pointer",borderBottom:"1px solid #f3f4f6",display:"flex",justifyContent:"space-between",alignItems:"center"}}
                          onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"} onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                          <div>
                            <div style={{fontWeight:700,fontSize:13,color:"#111827"}}>{v.num} — {v.name}</div>
                            <div style={{fontSize:11,color:"#6b7280",marginTop:1}}>{v.marque} {v.modele}{v.immat&&` · ${v.immat}`}{v.affectation&&` · ${v.affectation}`}</div>
                          </div>
                          <span style={{color:"#3b82f6",fontSize:12,fontWeight:600,flexShrink:0,marginLeft:8}}>Sélect.</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {selectedVehicle&&(
                  <div style={{marginTop:6,padding:"8px 12px",background:"#f0fdf4",borderRadius:8,fontSize:12,color:"#065f46",border:"1px solid #bbf7d0"}}>
                    ✅ <strong>{selectedVehicle.num}</strong> — {selectedVehicle.name}
                    {selectedVehicle.immat&&<span> · <strong>{selectedVehicle.immat}</strong></span>}
                    {selectedVehicle.chauffeur&&<span> · {selectedVehicle.chauffeur}</span>}
                  </div>
                )}
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>Immatriculation</label>
                <input value={form.immat} onChange={e=>setForm(p=>({...p,immat:e.target.value}))} placeholder="AB-123-CD"
                  style={{width:"100%",padding:"10px 13px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"monospace",letterSpacing:1}}/>
              </div>
              {[{l:"Type de panne *",k:"typePanne",ph:"Ex: Fuite hydraulique, moteur, électrique…"},{l:"Technicien",k:"technicien",ph:"Nom du technicien"}].map(f=>(
                <div key={f.k}><label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>{f.l}</label>
                  <input value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} style={{width:"100%",padding:"10px 14px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box"}}/></div>
              ))}
              <div><label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>Priorité</label>
                <div style={{display:"flex",gap:8}}>
                  {[{v:"urgente",l:"🔴 Urgente"},{v:"haute",l:"🟡 Haute"},{v:"normale",l:"⚪ Normale"}].map(p=>(
                    <button key={p.v} onClick={()=>setForm(f=>({...f,priorite:p.v}))} style={{flex:1,padding:"9px",borderRadius:9,border:`2px solid ${form.priorite===p.v?"#111827":"#e5e7eb"}`,background:form.priorite===p.v?"#111827":"#fff",color:form.priorite===p.v?"#fff":"#374151",fontWeight:600,cursor:"pointer",fontSize:12}}>{p.l}</button>
                  ))}
                </div>
              </div>
              <div><label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>Description</label>
                <textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} placeholder="Décrivez le problème…" rows={3} style={{width:"100%",padding:"10px 14px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",resize:"vertical",boxSizing:"border-box",fontFamily:"inherit"}}/></div>
              <div style={{display:"flex",gap:10,marginTop:6}}>
                <button onClick={()=>setShowForm(false)} style={{flex:1,padding:"12px",background:"#f3f4f6",border:"none",borderRadius:10,fontWeight:600,cursor:"pointer"}}>Annuler</button>
                <button onClick={handleCreate} disabled={!form.machine||!form.typePanne||saving} style={{flex:2,padding:"12px",background:form.machine&&form.typePanne?"#111827":"#e5e7eb",color:form.machine&&form.typePanne?"#fff":"#9ca3af",border:"none",borderRadius:10,fontWeight:700,cursor:form.machine&&form.typePanne?"pointer":"not-allowed",fontSize:14}}>
                  {saving?"⏳ Création…":"🔧 Créer l'OR"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FicheOR({ ordre, onClose, onUpdate, onSortir, getStock, products }) {
  const [searchPiece,setSearchPiece]=useState("");
  const [suggPieces,setSuggPieces]=useState([]);
  const [note,setNote]=useState(ordre.notes||"");

  const handleSearchPiece = v => {
    setSearchPiece(v);
    if(v.length<2){setSuggPieces([]);return;}
    const s=v.toLowerCase();
    setSuggPieces((products||ALL_PRODUCTS).filter(p=>!ordre.pieces.find(x=>x.id===p.id)&&((p.name||"").toLowerCase().includes(s)||(p.id||"").toLowerCase().includes(s))).slice(0,6));
  };
  const addPiece = p => {
    onUpdate({...ordre,pieces:[...ordre.pieces,{id:p.id,name:p.name,fournisseur:p.fournisseur,location:p.location,prix:p.prix,qte:1,sortie:false}]});
    setSearchPiece(""); setSuggPieces([]);
  };
  const removePiece = id => onUpdate({...ordre,pieces:ordre.pieces.filter(p=>p.id!==id)});
  const updateQte = (id,qte) => onUpdate({...ordre,pieces:ordre.pieces.map(p=>p.id===id?{...p,qte:parseInt(qte)||1}:p)});
  const allSorties=ordre.pieces.length>0&&ordre.pieces.every(p=>p.sortie);
  const totalCout=ordre.pieces.reduce((a,p)=>a+(p.prix||0)*p.qte,0);

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,backdropFilter:"blur(2px)"}}>
      <div style={{background:"#fff",borderRadius:20,width:"min(98vw,760px)",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 24px 64px rgba(0,0,0,0.25)"}}>
        <div style={{padding:"20px 26px",borderBottom:"1px solid #e5e7eb",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#111827",borderRadius:"20px 20px 0 0"}}>
          <div><div style={{color:"#9ca3af",fontSize:11,fontWeight:600,marginBottom:3}}>ORDRE DE RÉPARATION</div>
            <div style={{color:"#fff",fontWeight:900,fontSize:20}}>{ordre.numero}</div></div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}><Badge status={ordre.statut} map={OR_STATUTS}/><button onClick={onClose} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:16,color:"#fff"}}>✕</button></div>
        </div>
        <div style={{padding:"22px 26px",display:"flex",flexDirection:"column",gap:20}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:10}}>
            {[{l:"Machine",v:ordre.machine},{l:"Immat.",v:ordre.immat||"—"},{l:"Panne",v:ordre.typePanne},{l:"Technicien",v:ordre.technicien||"—"},{l:"Ouvert le",v:new Date(ordre.dateOuverture).toLocaleDateString("fr-FR")},{l:"Priorité",v:<Badge status={ordre.priorite} map={OR_PRIORITES}/>}].map(r=>(
              <div key={r.l} style={{background:"#f9fafb",borderRadius:10,padding:"10px 14px"}}>
                <div style={{fontSize:11,color:"#9ca3af",marginBottom:3}}>{r.l}</div>
                <div style={{fontWeight:700,fontSize:13,color:"#111827"}}>{r.v}</div>
              </div>
            ))}
          </div>
          {ordre.description&&<div style={{background:"#fef3c7",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#92400e"}}>📋 {ordre.description}</div>}

          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <h3 style={{fontWeight:800,fontSize:15,color:"#111827",margin:0}}>🔧 Pièces nécessaires</h3>
              {totalCout>0&&<div style={{fontSize:13,fontWeight:700,color:"#3b82f6"}}>Total : {totalCout.toFixed(2)} €</div>}
            </div>
            {ordre.pieces.length===0?(
              <div style={{padding:16,textAlign:"center",background:"#f9fafb",borderRadius:10,color:"#9ca3af",fontSize:13,marginBottom:12}}>Aucune pièce — recherchez ci-dessous</div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:12}}>
                {ordre.pieces.map(p=>{
                  const prod=(products||ALL_PRODUCTS).find(x=>x.id===p.id);
                  const stock=prod?getStock(prod):0;
                  return (
                    <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderRadius:10,background:p.sortie?"#f0fdf4":stock<p.qte?"#fff1f2":"#fff",border:`1px solid ${p.sortie?"#bbf7d0":stock<p.qte?"#fecaca":"#e5e7eb"}`}}>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:13,color:"#111827"}}>{p.name}</div>
                        <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>{p.id} · {p.location} · Dispo : <strong style={{color:stock===0?"#dc2626":"#059669"}}>{stock}</strong>{p.prix>0&&` · ${p.prix.toFixed(2)} €`}</div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <input type="number" min="1" value={p.qte} onChange={e=>updateQte(p.id,e.target.value)} disabled={p.sortie} style={{width:55,padding:"5px 7px",border:"1px solid #e5e7eb",borderRadius:7,fontSize:13,fontWeight:700,textAlign:"center",outline:"none"}}/>
                        {p.sortie
                          ? <span style={{background:"#d1fae5",color:"#065f46",padding:"5px 10px",borderRadius:8,fontSize:11,fontWeight:700}}>✅ Sorti</span>
                          : <button onClick={()=>onSortir(ordre,p)} disabled={stock<p.qte} style={{padding:"6px 12px",background:stock<p.qte?"#f3f4f6":"#111827",color:stock<p.qte?"#9ca3af":"#fff",border:"none",borderRadius:8,cursor:stock<p.qte?"not-allowed":"pointer",fontSize:12,fontWeight:600}}>{stock<p.qte?"Stock insuf.":"📤 Sortir"}</button>
                        }
                        {!p.sortie&&<button onClick={()=>removePiece(p.id)} style={{padding:"5px 8px",background:"#fee2e2",border:"none",borderRadius:7,cursor:"pointer",color:"#dc2626",fontSize:12}}>✕</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{position:"relative"}}>
              <input value={searchPiece} onChange={e=>handleSearchPiece(e.target.value)} placeholder="🔍  Ajouter une pièce…" style={{width:"100%",padding:"10px 14px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
              {suggPieces.length>0&&(
                <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,boxShadow:"0 8px 24px rgba(0,0,0,0.1)",zIndex:100,overflow:"hidden",marginTop:4}}>
                  {suggPieces.map(p=>{const s=getStock(p);return(
                    <div key={p.id} onClick={()=>addPiece(p)} style={{padding:"9px 14px",cursor:"pointer",borderBottom:"1px solid #f3f4f6",display:"flex",justifyContent:"space-between"}}
                      onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"} onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                      <div><div style={{fontWeight:600,fontSize:13}}>{p.name}</div><div style={{fontSize:11,color:"#6b7280"}}>{p.id} · {p.fournisseur||"—"}</div></div>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{fontWeight:700,color:s===0?"#dc2626":"#059669",fontSize:14}}>{s}</span>{p.prix>0&&<span style={{fontSize:11,color:"#9ca3af"}}>{p.prix.toFixed(2)} €</span>}<span style={{color:"#3b82f6",fontSize:12,fontWeight:600}}>+ Ajouter</span></div>
                    </div>
                  );})}
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 style={{fontWeight:800,fontSize:15,color:"#111827",margin:"0 0 8px"}}>📝 Notes technicien</h3>
            <textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} placeholder="Observations, travaux effectués…" style={{width:"100%",padding:"10px 14px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",resize:"vertical",boxSizing:"border-box",fontFamily:"inherit"}}/>
            <button onClick={()=>onUpdate({...ordre,notes:note})} style={{marginTop:7,padding:"7px 16px",background:"#f3f4f6",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:13}}>💾 Sauvegarder</button>
          </div>

          <div style={{display:"flex",gap:8,flexWrap:"wrap",paddingTop:8,borderTop:"1px solid #e5e7eb"}}>
            <div style={{fontSize:13,fontWeight:600,color:"#374151",alignSelf:"center"}}>Statut :</div>
            {Object.entries(OR_STATUTS).map(([k,v])=>(
              <button key={k} onClick={()=>onUpdate({...ordre,statut:k,dateCloture:k==="termine"?new Date().toISOString():ordre.dateCloture})} style={{padding:"7px 14px",borderRadius:9,border:`2px solid ${ordre.statut===k?"#111827":"#e5e7eb"}`,background:ordre.statut===k?v.bg:"#fff",color:ordre.statut===k?v.text:"#6b7280",fontWeight:600,cursor:"pointer",fontSize:12}}>{v.label}</button>
            ))}
          </div>

          {allSorties&&ordre.statut!=="termine"&&(
            <div style={{background:"#d1fae5",borderRadius:10,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:13,color:"#065f46",fontWeight:600}}>✅ Toutes les pièces ont été sorties du stock !</div>
              <button onClick={()=>onUpdate({...ordre,statut:"termine",dateCloture:new Date().toISOString()})} style={{padding:"8px 16px",background:"#059669",color:"#fff",border:"none",borderRadius:9,fontWeight:700,cursor:"pointer",fontSize:13}}>Clôturer l'OR</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
// ── GÉNÉRATEUR DE CODES-BARRES ────────────────────────────────────────────────

// Encodage CODE128B pur JS — pas de dépendance externe
function encodeCode128(text) {
  const START_B = 104;
  const STOP = 106;
  const CODE128_CHARS = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';

  let checksum = START_B;
  const codes = [START_B];
  for (let i = 0; i < text.length; i++) {
    const idx = CODE128_CHARS.indexOf(text[i]);
    if (idx === -1) continue;
    codes.push(idx + 32);
    checksum += (idx + 32) * (i + 1);
  }
  codes.push(checksum % 103);
  codes.push(STOP);

  // Patterns CODE128
  const PATTERNS = [
    "11011001100","11001101100","11001100110","10010011000","10010001100","10001001100","10011001000","10011000100","10001100100","11001001000",
    "11001000100","11000100100","10110011100","10011011100","10011001110","10111001100","10011101100","10011100110","11001110010","11001011100",
    "11001001110","11011100100","11001110100","11101101110","11101001100","11100101100","11100100110","11101100100","11100110100","11100110010",
    "11011011000","11011000110","11000110110","10100011000","10001011000","10001000110","10110001000","10001101000","10001100010","11010001000",
    "11000101000","11000100010","10110111000","10110001110","10001101110","10111011000","10111000110","10001110110","11101110110","11010001110",
    "11000101110","11011101000","11011100010","11011101110","11101011000","11101000110","11100010110","11101101000","11101100010","11100011010",
    "11101111010","11001000010","11110001010","10100110000","10100001100","10010110000","10010000110","10000101100","10000100110","10110010000",
    "10110000100","10011010000","10011000010","10000110100","10000110010","11000010010","11001010000","11110111010","11000010100","10001111010",
    "10100111100","10010111100","10010011110","10111100100","10011110100","10011110010","11110100100","11110010100","11110010010","11011011110",
    "11011110110","11110110110","10101111000","10100011110","10001011110","10111101000","10111100010","11110101000","11110100010","10111011110",
    "10111101110","11101011110","11110101110","11010000100","11010010000","11010011100","1100011101011",
  ];

  let bars = "";
  codes.forEach(c => { if (PATTERNS[c]) bars += PATTERNS[c]; });
  return bars;
}

function BarcodeDisplay({ value, width = 200, height = 60, showValue = true, fontSize = 11 }) {
  const ref = useCallback(node => {
    if (!node || !value) return;
    try {
      const bars = encodeCode128(value.toUpperCase());
      if (!bars) return;

      const barW = Math.max(1, Math.floor(width / bars.length));
      const totalW = barW * bars.length;
      const svgH = showValue ? height + fontSize + 6 : height;

      let rects = "";
      let x = 0;
      for (let i = 0; i < bars.length; i++) {
        if (bars[i] === "1") {
          rects += `<rect x="${x}" y="0" width="${barW}" height="${height}" fill="#000"/>`;
        }
        x += barW;
      }

      node.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${svgH}" viewBox="0 0 ${totalW} ${svgH}" style="max-width:100%;height:auto;">
          <rect width="${totalW}" height="${svgH}" fill="#fff"/>
          ${rects}
          ${showValue ? `<text x="${totalW/2}" y="${height + fontSize + 2}" text-anchor="middle" font-family="monospace" font-size="${fontSize}" fill="#000">${value}</text>` : ""}
        </svg>`;
    } catch(e) {
      node.innerHTML = `<div style="border:1px dashed #ccc;padding:10px;font-size:11px;color:#999;text-align:center">${value}</div>`;
    }
  }, [value, width, height, showValue, fontSize]);

  return <div ref={ref} style={{display:"inline-block"}}/>;
}

function GenerateurCodebarres({ products, stockOverrides }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [qtyParEtiquette, setQtyParEtiquette] = useState(1);
  const [showName, setShowName] = useState(true);
  const [showPrice, setShowPrice] = useState(false);
  const [showLocation, setShowLocation] = useState(true);
  const [taille, setTaille] = useState("medium");

  const tailles = {
    small:  { w: 160, h: 45, fs: 10 },
    medium: { w: 200, h: 60, fs: 12 },
    large:  { w: 260, h: 80, fs: 14 },
  };
  const t = tailles[taille];

  const filtered = products.filter(p => {
    if (search.length < 2) return false;
    const s = search.toLowerCase();
    return p.name.toLowerCase().includes(s) || p.id.toLowerCase().includes(s) || (p.fournisseur||"").toLowerCase().includes(s);
  }).slice(0, 30);

  const toggleSelect = p => setSelected(prev =>
    prev.find(x => x.id === p.id) ? prev.filter(x => x.id !== p.id) : [...prev, p]
  );
  const isSelected = p => selected.some(x => x.id === p.id);

  const handlePrint = () => {
    const printW = window.open("", "_blank");
    const etiquettes = selected.flatMap(p => {
      const bars = encodeCode128(p.id.toUpperCase());
      const barW = Math.max(1, Math.floor(t.w / bars.length));
      const totalW = barW * bars.length;
      let rects = "";
      let x = 0;
      for (let i = 0; i < bars.length; i++) {
        if (bars[i] === "1") rects += `<rect x="${x}" y="0" width="${barW}" height="${t.h}" fill="#000"/>`;
        x += barW;
      }
      const svgH = t.h + (showName || showPrice || showLocation ? t.fs + 8 : 0);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${svgH}" viewBox="0 0 ${totalW} ${svgH}"><rect width="${totalW}" height="${svgH}" fill="#fff"/>${rects}<text x="${totalW/2}" y="${t.h+t.fs+2}" text-anchor="middle" font-family="monospace" font-size="${t.fs}" fill="#000">${p.id}</text></svg>`;
      return Array(parseInt(qtyParEtiquette)||1).fill(null).map(() => `
        <div class="etiquette">
          ${svg}
          ${showName ? `<div class="nom">${p.name.slice(0,38)}${p.name.length>38?"…":""}</div>` : ""}
          ${showLocation&&p.location ? `<div class="loc">📍 ${p.location}</div>` : ""}
          ${showPrice&&p.prix>0 ? `<div class="prix">${p.prix.toFixed(2)} €</div>` : ""}
        </div>`);
    }).join("");

    printW.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Codes-barres</title>
      <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif}
      .grid{display:flex;flex-wrap:wrap;gap:8px;padding:10px}
      .etiquette{border:1px solid #ddd;border-radius:4px;padding:8px;text-align:center;page-break-inside:avoid;width:${t.w+20}px}
      .etiquette svg{max-width:100%;height:auto}
      .nom{font-size:${t.fs-1}px;font-weight:600;margin-top:3px;line-height:1.2}
      .loc{font-size:${t.fs-2}px;color:#666;margin-top:2px}
      .prix{font-size:${t.fs}px;font-weight:700;color:#1e40af;margin-top:2px}
      @media print{@page{margin:6mm}}</style></head>
      <body><div class="grid">${etiquettes}</div>
      <script>window.onload=()=>{window.print()}<\/script></body></html>`);
    printW.document.close();
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:900,color:"#111827",margin:0}}>🔲 Codes-barres</h1>
          <p style={{color:"#6b7280",fontSize:13,margin:"4px 0 0"}}>{selected.length} article{selected.length>1?"s":""} sélectionné{selected.length>1?"s":""}</p>
        </div>
        {selected.length>0&&(
          <button onClick={handlePrint} style={{background:"#111827",color:"#fff",border:"none",borderRadius:10,padding:"11px 22px",fontWeight:700,cursor:"pointer",fontSize:14}}>
            🖨️ Imprimer {selected.length*(parseInt(qtyParEtiquette)||1)} étiquette{selected.length*(parseInt(qtyParEtiquette)||1)>1?"s":""}
          </button>
        )}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"320px 1fr",gap:18,alignItems:"start"}}>

        {/* Panneau gauche */}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>

          {/* Recherche */}
          <div style={{background:"#fff",borderRadius:14,border:"1px solid #e5e7eb",padding:18}}>
            <h3 style={{fontSize:14,fontWeight:800,color:"#111827",marginBottom:12}}>🔍 Sélectionner des articles</h3>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher SKU, nom…"
              style={{width:"100%",padding:"10px 14px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box",marginBottom:10}}/>
            {search.length>=2&&filtered.length===0&&<div style={{fontSize:12,color:"#9ca3af",textAlign:"center",padding:"10px 0"}}>Aucun article trouvé</div>}
            {filtered.map(p=>(
              <div key={p.id} onClick={()=>toggleSelect(p)} style={{padding:"9px 12px",borderRadius:9,marginBottom:5,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",background:isSelected(p)?"#dbeafe":"#f9fafb",border:`1px solid ${isSelected(p)?"#3b82f6":"#e5e7eb"}`}}>
                <div>
                  <div style={{fontWeight:600,fontSize:12,color:"#111827"}}>{p.name.slice(0,32)}{p.name.length>32?"…":""}</div>
                  <div style={{fontSize:10,color:"#9ca3af",fontFamily:"monospace",marginTop:2}}>{p.id}</div>
                </div>
                <div style={{width:20,height:20,borderRadius:5,border:`2px solid ${isSelected(p)?"#3b82f6":"#d1d5db"}`,background:isSelected(p)?"#3b82f6":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {isSelected(p)&&<span style={{color:"#fff",fontSize:12,fontWeight:900}}>✓</span>}
                </div>
              </div>
            ))}
            {selected.length>0&&<button onClick={()=>setSelected([])} style={{width:"100%",marginTop:8,padding:"7px",background:"#fee2e2",border:"none",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:600,color:"#dc2626"}}>✕ Tout désélectionner</button>}
          </div>

          {/* Options */}
          <div style={{background:"#fff",borderRadius:14,border:"1px solid #e5e7eb",padding:18}}>
            <h3 style={{fontSize:14,fontWeight:800,color:"#111827",marginBottom:14}}>⚙️ Options</h3>

            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:6}}>Quantité par article</label>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <button onClick={()=>setQtyParEtiquette(q=>Math.max(1,q-1))} style={{width:36,height:36,background:"#f3f4f6",border:"1px solid #e5e7eb",borderRadius:8,fontSize:18,cursor:"pointer",fontWeight:700}}>−</button>
                <input type="number" min="1" max="100" value={qtyParEtiquette} onChange={e=>setQtyParEtiquette(parseInt(e.target.value)||1)}
                  style={{flex:1,padding:"8px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:16,fontWeight:700,textAlign:"center",outline:"none"}}/>
                <button onClick={()=>setQtyParEtiquette(q=>Math.min(100,q+1))} style={{width:36,height:36,background:"#f3f4f6",border:"1px solid #e5e7eb",borderRadius:8,fontSize:18,cursor:"pointer",fontWeight:700}}>+</button>
              </div>
            </div>

            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:6}}>Taille étiquette</label>
              <div style={{display:"flex",gap:6}}>
                {[{v:"small",l:"Petite"},{v:"medium",l:"Moyenne"},{v:"large",l:"Grande"}].map(s=>(
                  <button key={s.v} onClick={()=>setTaille(s.v)} style={{flex:1,padding:"7px",borderRadius:8,border:`2px solid ${taille===s.v?"#111827":"#e5e7eb"}`,background:taille===s.v?"#111827":"#fff",color:taille===s.v?"#fff":"#374151",fontWeight:600,cursor:"pointer",fontSize:11}}>{s.l}</button>
                ))}
              </div>
            </div>

            <div>
              <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:8}}>Informations à afficher</label>
              {[{label:"Nom de l'article",val:showName,set:setShowName},{label:"Emplacement",val:showLocation,set:setShowLocation},{label:"Prix HT",val:showPrice,set:setShowPrice}].map(opt=>(
                <div key={opt.label} onClick={()=>opt.set(v=>!v)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",cursor:"pointer",borderBottom:"1px solid #f3f4f6"}}>
                  <div style={{width:20,height:20,borderRadius:5,border:`2px solid ${opt.val?"#111827":"#d1d5db"}`,background:opt.val?"#111827":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    {opt.val&&<span style={{color:"#fff",fontSize:12,fontWeight:900}}>✓</span>}
                  </div>
                  <span style={{fontSize:13,color:"#374151"}}>{opt.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Aperçu */}
        <div style={{background:"#fff",borderRadius:14,border:"1px solid #e5e7eb",padding:20,minHeight:300}}>
          {selected.length===0?(
            <div style={{textAlign:"center",padding:60,color:"#9ca3af"}}>
              <div style={{fontSize:48,marginBottom:14}}>🔲</div>
              <div style={{fontWeight:700,fontSize:16,color:"#374151",marginBottom:8}}>Aucun article sélectionné</div>
              <div style={{fontSize:13}}>Recherchez et sélectionnez des articles à gauche</div>
            </div>
          ):(
            <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <h3 style={{fontSize:14,fontWeight:800,color:"#111827"}}>Aperçu des étiquettes</h3>
                <div style={{fontSize:12,color:"#6b7280"}}>{selected.length*(parseInt(qtyParEtiquette)||1)} étiquette{selected.length*(parseInt(qtyParEtiquette)||1)>1?"s":""} au total</div>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
                {selected.map(p=>(
                  <div key={p.id} style={{border:"1px solid #e5e7eb",borderRadius:10,padding:12,textAlign:"center",background:"#fafafa",position:"relative",maxWidth:t.w+24}}>
                    <button onClick={()=>toggleSelect(p)} style={{position:"absolute",top:4,right:4,width:18,height:18,background:"#fee2e2",border:"none",borderRadius:4,cursor:"pointer",fontSize:10,color:"#dc2626",lineHeight:"18px",fontWeight:700}}>✕</button>
                    <BarcodeDisplay value={p.id} width={t.w} height={t.h} fontSize={t.fs}/>
                    {showName&&<div style={{fontSize:t.fs-1,fontWeight:600,color:"#111827",marginTop:4,maxWidth:t.w,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>}
                    {showLocation&&p.location&&<div style={{fontSize:t.fs-2,color:"#6b7280",marginTop:2}}>📍 {p.location}</div>}
                    {showPrice&&p.prix>0&&<div style={{fontSize:t.fs-1,fontWeight:700,color:"#1e40af",marginTop:2}}>{p.prix.toFixed(2)} €</div>}
                    {qtyParEtiquette>1&&<div style={{fontSize:10,color:"#9ca3af",marginTop:4,fontStyle:"italic"}}>×{qtyParEtiquette} exemplaires</div>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


// ── SCANNER ARTICLES ──────────────────────────────────────────────────────────
function ScannerArticles({ products, stockOverrides, setStockOverrides, mouvements, setMouvements, siteId }) {
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [foundArticle, setFoundArticle] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [scanHistory, setScanHistory] = useState([]);
  const [actionMode, setActionMode] = useState(null);
  const [quantite, setQuantite] = useState("1");
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(null);
  const [scanError, setScanError] = useState("");
  const streamRef = { current: null };
  const animFrameRef = { current: null };

  const getStock = p => stockOverrides[p.id] !== undefined ? stockOverrides[p.id] : p.stock;

  const searchByCode = (code) => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    // Recherche exacte sur ID/SKU d'abord, puis partielle sur nom
    const found = products.find(p => p.id.toUpperCase() === c)
      || products.find(p => p.sku && p.sku.toUpperCase() === c)
      || products.find(p => p.id.toUpperCase().includes(c) && c.length >= 4);
    if (found) {
      setFoundArticle(found);
      setNotFound(false);
      setActionMode(null);
      setQuantite("1");
      setScanHistory(prev => [{
        id: found.id, name: found.name,
        stock: getStock(found), time: new Date().toLocaleTimeString("fr-FR")
      }, ...prev.slice(0, 9)]);
    } else {
      setFoundArticle(null);
      setNotFound(true);
    }
    setManualCode("");
  };

  const handleManualSearch = () => searchByCode(manualCode);
  const handleKeyDown = e => { if (e.key === "Enter") handleManualSearch(); };

  // Démarrer le scanner caméra
  const startScanner = async () => {
    setScanError("");
    try {
      // Vérifier support BarcodeDetector
      const hasBarcodeDetector = "BarcodeDetector" in window;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      setScanning(true);

      // Attendre que le DOM soit prêt
      setTimeout(async () => {
        const video = document.getElementById("scanner-video");
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute("playsinline", true);
        await video.play();

        if (hasBarcodeDetector) {
          // Méthode native BarcodeDetector (Chrome Android, Edge)
          try {
            const detector = new BarcodeDetector({
              formats: ["code_128","code_39","ean_13","ean_8","qr_code","upc_a","upc_e","itf","codabar","data_matrix","aztec","pdf417"]
            });
            const scanLoop = async () => {
              if (!streamRef.current) return;
              try {
                const barcodes = await detector.detect(video);
                if (barcodes.length > 0) {
                  const code = barcodes[0].rawValue;
                  stopScanner();
                  searchByCode(code);
                  return;
                }
              } catch(e) {}
              animFrameRef.current = requestAnimationFrame(scanLoop);
            };
            animFrameRef.current = requestAnimationFrame(scanLoop);
          } catch(e) {
            setScanError("BarcodeDetector non disponible. Utilisez la saisie manuelle.");
          }
        } else {
          // Fallback: charger ZXing depuis CDN
          setScanError("⚠️ Scan caméra non supporté sur ce navigateur. Utilisez Chrome sur Android ou saisissez le code manuellement.");
        }
      }, 300);

    } catch(e) {
      setScanError("Impossible d'accéder à la caméra : " + (e.message || "Permission refusée"));
      setScanning(false);
    }
  };

  const stopScanner = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  // Cleanup on unmount
  useEffect(() => { return () => stopScanner(); }, []);

  const handleAction = async () => {
    if (!foundArticle || !quantite || !actionMode) return;
    setSaving(true);
    const qty = parseInt(quantite);
    const stockActuel = getStock(foundArticle);
    if (actionMode === "sortie" && qty > stockActuel) {
      alert(`Stock insuffisant ! Disponible : ${stockActuel}`);
      setSaving(false);
      return;
    }
    const newStock = actionMode === "entree" ? stockActuel + qty : stockActuel - qty;
    const mouvement = {
      type: actionMode,
      articleId: foundArticle.id,
      articleName: foundArticle.name,
      fournisseur: foundArticle.fournisseur || "",
      quantite: qty,
      stockAvant: stockActuel,
      stockApres: newStock,
      motif: actionMode === "entree" ? "Réception via scanner" : "Sortie via scanner",
      reference: "",
    };
    const savedMouv = await addMouvementSite(mouvement, siteId);
    await setStockOverrideSite(foundArticle.id, newStock, siteId);
    setMouvements(prev => [savedMouv||{ ...mouvement, id: Date.now(), created_at: new Date().toISOString() }, ...prev]);
    setStockOverrides(prev => ({ ...prev, [foundArticle.id]: newStock }));
    setShowSuccess({ type: actionMode, qty, newStock });
    setActionMode(null);
    setQuantite("1");
    setSaving(false);
    setTimeout(() => setShowSuccess(null), 3000);
  };

  const s = foundArticle ? getStock(foundArticle) : 0;
  const st = foundArticle ? (s === 0 ? "rupture" : foundArticle.min > 0 && s < foundArticle.min ? "warning" : "ok") : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 600, margin: "0 auto" }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#111827", margin: 0 }}>📷 Scanner articles</h1>
        <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>Scannez un code-barres ou saisissez un code manuellement</p>
      </div>

      {/* Bouton scanner caméra */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        {!scanning ? (
          <button onClick={startScanner} style={{ width: "100%", padding: "28px", background: "linear-gradient(135deg,#111827,#1f2937)", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 52 }}>📷</div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>Scanner avec la caméra</div>
            <div style={{ color: "#9ca3af", fontSize: 13 }}>Pointez vers un code-barres EAN / Code-128 / QR</div>
          </button>
        ) : (
          <div style={{ position: "relative" }}>
            <video id="scanner-video" style={{ width: "100%", maxHeight: 300, objectFit: "cover", display: "block", background: "#000" }} playsInline muted autoPlay/>
            {/* Viseur */}
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <div style={{ position: "relative", width: 220, height: 110 }}>
                <div style={{ position: "absolute", inset: 0, border: "none", boxShadow: "0 0 0 2000px rgba(0,0,0,0.45)" }}/>
                <div style={{position:"absolute",top:0,left:0,width:24,height:24,borderTop:"4px solid #3b82f6",borderLeft:"4px solid #3b82f6",borderRadius:"8px 0 0 0"}}/>
                <div style={{position:"absolute",top:0,right:0,width:24,height:24,borderTop:"4px solid #3b82f6",borderRight:"4px solid #3b82f6",borderRadius:"0 8px 0 0"}}/>
                <div style={{position:"absolute",bottom:0,left:0,width:24,height:24,borderBottom:"4px solid #3b82f6",borderLeft:"4px solid #3b82f6",borderRadius:"0 0 0 8px"}}/>
                <div style={{position:"absolute",bottom:0,right:0,width:24,height:24,borderBottom:"4px solid #3b82f6",borderRight:"4px solid #3b82f6",borderRadius:"0 0 8px 0"}}/>
                {/* Ligne de scan animée */}
                <div style={{position:"absolute",top:"50%",left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,#3b82f6,transparent)",animation:"scanline 1.5s ease-in-out infinite"}}/>
              </div>
            </div>
            <div style={{ position: "absolute", top: 10, right: 10 }}>
              <button onClick={stopScanner} style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>✕ Arrêter</button>
            </div>
            <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, textAlign: "center" }}>
              <span style={{ background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 99 }}>🔍 Scan en cours…</span>
            </div>
          </div>
        )}
        {scanError && (
          <div style={{ padding: "12px 18px", background: "#fef3c7", fontSize: 12, color: "#92400e", fontWeight: 600 }}>
            {scanError}
          </div>
        )}
      </div>

      {/* Saisie manuelle */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 10 }}>⌨️ Saisie manuelle</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={manualCode} onChange={e => setManualCode(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="SKU, ID article, code-barres…"
            style={{ flex: 1, padding: "11px 14px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "monospace", letterSpacing: 1 }}
          />
          <button onClick={handleManualSearch} disabled={!manualCode} style={{ padding: "11px 18px", background: manualCode ? "#111827" : "#e5e7eb", color: manualCode ? "#fff" : "#9ca3af", border: "none", borderRadius: 10, fontWeight: 700, cursor: manualCode ? "pointer" : "not-allowed", fontSize: 14 }}>
            🔍
          </button>
        </div>
      </div>

      {/* Résultat scan */}
      {notFound && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 14, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>❌</div>
          <div style={{ fontWeight: 700, color: "#991b1b", fontSize: 15 }}>Article non trouvé</div>
          <div style={{ fontSize: 13, color: "#dc2626", marginTop: 4 }}>Vérifiez le code ou recherchez manuellement dans Stocks</div>
        </div>
      )}

      {showSuccess && (
        <div style={{ background: "#d1fae5", border: "1px solid #6ee7b7", borderRadius: 14, padding: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 32 }}>{showSuccess.type === "entree" ? "📥" : "📤"}</div>
          <div>
            <div style={{ fontWeight: 800, color: "#065f46", fontSize: 15 }}>✅ {showSuccess.type === "entree" ? "Entrée" : "Sortie"} enregistrée !</div>
            <div style={{ fontSize: 13, color: "#047857", marginTop: 2 }}>{showSuccess.qty} unité{showSuccess.qty > 1 ? "s" : ""} · Nouveau stock : <strong>{showSuccess.newStock}</strong></div>
          </div>
        </div>
      )}

      {foundArticle && (
        <div style={{ background: "#fff", borderRadius: 16, border: `2px solid ${st === "rupture" ? "#fca5a5" : st === "warning" ? "#fde68a" : "#6ee7b7"}`, overflow: "hidden" }}>
          {/* Header fiche */}
          <div style={{ background: st === "rupture" ? "#fee2e2" : st === "warning" ? "#fef3c7" : "#d1fae5", padding: "16px 20px" }}>
            <div style={{ fontWeight: 900, fontSize: 16, color: "#111827", marginBottom: 4 }}>{foundArticle.name}</div>
            <div style={{ fontSize: 12, color: "#6b7280", fontFamily: "monospace" }}>{foundArticle.id} {foundArticle.sku && foundArticle.sku !== foundArticle.id ? `· ${foundArticle.sku}` : ""}</div>
          </div>

          {/* Infos */}
          <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div style={{ textAlign: "center", padding: "12px 8px", background: "#f9fafb", borderRadius: 10 }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: s === 0 ? "#dc2626" : s < foundArticle.min ? "#d97706" : "#059669" }}>{s}</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>En stock</div>
            </div>
            <div style={{ textAlign: "center", padding: "12px 8px", background: "#f9fafb", borderRadius: 10 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#374151" }}>{foundArticle.min || 0}</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Minimum</div>
            </div>
            <div style={{ textAlign: "center", padding: "12px 8px", background: "#f9fafb", borderRadius: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#3b82f6" }}>{foundArticle.prix > 0 ? foundArticle.prix.toFixed(2) + " €" : "—"}</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Prix HT</div>
            </div>
          </div>

          <div style={{ padding: "0 20px 12px", display: "flex", gap: 12, fontSize: 13, color: "#6b7280" }}>
            {foundArticle.location && <span>📍 {foundArticle.location}</span>}
            {foundArticle.fournisseur && <span>🏭 {foundArticle.fournisseur}</span>}
          </div>

          {/* Actions */}
          <div style={{ padding: "0 20px 20px" }}>
            {!actionMode ? (
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setActionMode("entree")} style={{ flex: 1, padding: "13px", background: "#059669", color: "#fff", border: "none", borderRadius: 11, fontWeight: 800, cursor: "pointer", fontSize: 15 }}>📥 Entrée</button>
                <button onClick={() => setActionMode("sortie")} disabled={s === 0} style={{ flex: 1, padding: "13px", background: s === 0 ? "#e5e7eb" : "#dc2626", color: s === 0 ? "#9ca3af" : "#fff", border: "none", borderRadius: 11, fontWeight: 800, cursor: s === 0 ? "not-allowed" : "pointer", fontSize: 15 }}>📤 Sortie</button>
              </div>
            ) : (
              <div style={{ background: actionMode === "entree" ? "#f0fdf4" : "#fff1f2", borderRadius: 12, padding: 16, border: `1px solid ${actionMode === "entree" ? "#bbf7d0" : "#fecaca"}` }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#111827", marginBottom: 12 }}>
                  {actionMode === "entree" ? "📥 Quantité à ajouter" : "📤 Quantité à retirer"}
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
                  <button onClick={() => setQuantite(q => String(Math.max(1, parseInt(q) - 1)))} style={{ width: 44, height: 44, background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 20, fontWeight: 700, cursor: "pointer" }}>−</button>
                  <input type="number" min="1" value={quantite} onChange={e => setQuantite(e.target.value)}
                    style={{ flex: 1, padding: "10px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 22, fontWeight: 900, textAlign: "center", outline: "none" }} />
                  <button onClick={() => setQuantite(q => String(parseInt(q) + 1))} style={{ width: 44, height: 44, background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 20, fontWeight: 700, cursor: "pointer" }}>+</button>
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12, padding: "6px 10px", background: "#fff", borderRadius: 8 }}>
                  Stock après : <strong style={{ color: actionMode === "entree" ? "#059669" : "#dc2626", fontSize: 16 }}>
                    {actionMode === "entree" ? s + (parseInt(quantite) || 0) : s - (parseInt(quantite) || 0)}
                  </strong>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setActionMode(null)} style={{ flex: 1, padding: "11px", background: "#f3f4f6", border: "none", borderRadius: 10, fontWeight: 600, cursor: "pointer" }}>Annuler</button>
                  <button onClick={handleAction} disabled={saving} style={{ flex: 2, padding: "11px", background: saving ? "#9ca3af" : actionMode === "entree" ? "#059669" : "#dc2626", color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", fontSize: 14 }}>
                    {saving ? "⏳…" : actionMode === "entree" ? "✅ Confirmer l'entrée" : "✅ Confirmer la sortie"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Équivalents si rupture */}
          {s === 0 && (
            <div style={{ padding: "0 20px 20px" }}>
              <div style={{ background: "#fef3c7", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#92400e", fontWeight: 600 }}>
                ⚠️ Article en rupture — consultez les équivalences dans l'onglet ↔️
              </div>
            </div>
          )}
        </div>
      )}

      {/* Historique des scans */}
      {scanHistory.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>🕐 Derniers scans</div>
            <button onClick={() => setScanHistory([])} style={{ fontSize: 11, color: "#9ca3af", background: "none", border: "none", cursor: "pointer" }}>Effacer</button>
          </div>
          {scanHistory.map((h, i) => (
            <div key={i} onClick={() => searchByCode(h.id)} style={{ padding: "11px 18px", borderBottom: i < scanHistory.length - 1 ? "1px solid #f3f4f6" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>{h.name}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{h.id} · {h.time}</div>
              </div>
              <div style={{ fontWeight: 800, fontSize: 16, color: h.stock === 0 ? "#dc2626" : "#059669" }}>{h.stock}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── LOCATION MATÉRIEL ─────────────────────────────────────────────────────────
const STATUTS_LOC = {
  en_cours:  { label:"En cours",  color:"#1e40af", bg:"#dbeafe", icon:"🔑" },
  termine:   { label:"Terminé",   color:"#065f46", bg:"#d1fae5", icon:"✅" },
  en_retard: { label:"En retard", color:"#dc2626", bg:"#fee2e2", icon:"⚠️" },
  annule:    { label:"Annulé",    color:"#6b7280", bg:"#f3f4f6", icon:"❌" },
};

function LocationMateriel({ locations, setLocations, siteId, products }) {
  const [showForm, setShowForm] = useState(false);
  const [editLoc, setEditLoc] = useState(null);
  const [filterStatut, setFilterStatut] = useState("tous");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [parcSearch, setParcSearch] = useState("");
  const [parcSugg, setParcSugg] = useState([]);
  const [articleSearch, setArticleSearch] = useState("");
  const [articleSugg, setArticleSugg] = useState([]);
  const [form, setForm] = useState({
    type:"vehicule", materiel_id:"", materiel_nom:"",
    locataire_nom:"", locataire_entreprise:"", locataire_tel:"", locataire_email:"",
    date_debut: new Date().toISOString().split("T")[0],
    date_fin_prevue: new Date(Date.now()+7*86400000).toISOString().split("T")[0],
    prix_jour:0, caution:0, statut:"en_cours", notes:""
  });

  const filtered = filterStatut==="tous" ? locations : locations.filter(l=>l.statut===filterStatut);

  const counts = { tous: locations.length };
  Object.keys(STATUTS_LOC).forEach(s => { counts[s] = locations.filter(l=>l.statut===s).length; });

  // Mise à jour auto statut retard
  const getStatutEffectif = (loc) => {
    if(loc.statut==="en_cours" && new Date(loc.date_fin_prevue) < new Date()) return "en_retard";
    return loc.statut;
  };

  const handleImportExcelLoc = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true); setImportResult(null);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const XLSX = window.XLSX;
        if (!XLSX) { alert("Rechargez la page et réessayez."); setImporting(false); return; }
        const wb = XLSX.read(ev.target.result, { type:"array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws);
        const parseDate = (v) => {
          if (!v) return null;
          if (typeof v === "number") return new Date(Math.round((v-25569)*86400*1000)).toISOString().split("T")[0];
          const s = String(v).trim();
          if (s.includes("/")) { const [a,b,c]=s.split("/"); return `${c?.length===2?"20"+c:c||new Date().getFullYear()}-${b?.padStart(2,"0")}-${a?.padStart(2,"0")}`; }
          return s||null;
        };
        let ok=0, err=0;
        for (const row of rows) {
          const mat = String(row["Matériel"]||row["Désignation"]||row["materiel_nom"]||row["Nom matériel"]||"").trim();
          const loc = String(row["Locataire"]||row["Client"]||row["locataire_nom"]||row["Nom"]||"").trim();
          if (!mat||!loc){err++;continue;}
          const record = {
            type: String(row["Type"]||"vehicule").toLowerCase().includes("art")?"article":"vehicule",
            materiel_id: String(row["Immatriculation"]||row["ID"]||row["materiel_id"]||"").trim(),
            materiel_nom: mat, locataire_nom: loc,
            locataire_entreprise: String(row["Entreprise"]||"").trim(),
            locataire_tel: String(row["Téléphone"]||row["Tel"]||"").trim(),
            locataire_email: String(row["Email"]||"").trim(),
            date_debut: parseDate(row["Date début"]||row["Début"]||row["date_debut"])||new Date().toISOString().split("T")[0],
            date_fin_prevue: parseDate(row["Date fin"]||row["Fin prévue"]||row["date_fin_prevue"])||new Date(Date.now()+7*86400000).toISOString().split("T")[0],
            date_fin_reelle: parseDate(row["Date retour"]||row["Fin réelle"]||null),
            prix_jour: parseFloat(row["Prix/jour"]||row["prix_jour"]||0)||0,
            caution: parseFloat(row["Caution"]||0)||0,
            prix_total: parseFloat(row["Prix total"]||0)||0,
            statut: (() => { const s=String(row["Statut"]||"en_cours").toLowerCase(); if(s.includes("termin")||s.includes("rendu"))return"termine"; if(s.includes("retard"))return"en_retard"; if(s.includes("annul"))return"annule"; return"en_cours"; })(),
            notes: String(row["Notes"]||"").trim(),
          };
          const saved = await addLocation(record, siteId);
          if(saved){setLocations(prev=>[saved,...prev]);ok++;}else err++;
        }
        setImportResult({ok,err,total:rows.length});
      } catch(ex){alert("Erreur import: "+ex.message);}
      setImporting(false); e.target.value="";
    };
    reader.readAsArrayBuffer(file);
  };

  const openAdd = () => {
    setEditLoc(null);
    setForm({ type:"vehicule", materiel_id:"", materiel_nom:"", locataire_nom:"", locataire_entreprise:"", locataire_tel:"", locataire_email:"", date_debut:new Date().toISOString().split("T")[0], date_fin_prevue:new Date(Date.now()+7*86400000).toISOString().split("T")[0], prix_jour:0, caution:0, statut:"en_cours", notes:"" });
    setParcSearch(""); setArticleSearch("");
    setShowForm(true);
  };

  const openEdit = (loc) => {
    setEditLoc(loc);
    setForm({ type:loc.type, materiel_id:loc.materiel_id, materiel_nom:loc.materiel_nom, locataire_nom:loc.locataire_nom, locataire_entreprise:loc.locataire_entreprise||"", locataire_tel:loc.locataire_tel||"", locataire_email:loc.locataire_email||"", date_debut:loc.date_debut, date_fin_prevue:loc.date_fin_prevue, prix_jour:loc.prix_jour||0, caution:loc.caution||0, statut:loc.statut, notes:loc.notes||"" });
    setShowForm(true);
  };

  const handleSave = async () => {
    if(!form.materiel_nom||!form.locataire_nom||!form.date_debut||!form.date_fin_prevue){return;}
    setSaving(true);
    const days = Math.max(1, Math.ceil((new Date(form.date_fin_prevue)-new Date(form.date_debut))/(86400000)));
    const prix_total = (parseFloat(form.prix_jour)||0) * days;
    const data = { ...form, prix_jour:parseFloat(form.prix_jour)||0, caution:parseFloat(form.caution)||0, prix_total };
    if(editLoc) {
      await updateLocation(editLoc.id, data);
      setLocations(prev=>prev.map(l=>l.id===editLoc.id?{...l,...data}:l));
    } else {
      const saved = await addLocation(data, siteId);
      if(saved) setLocations(prev=>[saved,...prev]);
    }
    setSaving(false); setShowForm(false);
  };

  const handleDelete = async (id) => {
    if(!window.confirm("Supprimer cette location ?")) return;
    await deleteLocation(id);
    setLocations(prev=>prev.filter(l=>l.id!==id));
  };

  const handleRetour = async (loc) => {
    const today = new Date().toISOString().split("T")[0];
    await updateLocation(loc.id, { statut:"termine", date_fin_reelle:today });
    setLocations(prev=>prev.map(l=>l.id===loc.id?{...l,statut:"termine",date_fin_reelle:today}:l));
  };

  const jours = (loc) => Math.max(0, Math.ceil((new Date(loc.date_fin_prevue)-new Date(loc.date_debut))/(86400000)));
  const totalCA = locations.filter(l=>l.statut!=="annule").reduce((s,l)=>s+(l.prix_total||0),0);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:900,color:"#111827",margin:0}}>🔑 Location de matériel</h1>
          <p style={{color:"#6b7280",fontSize:13,margin:"4px 0 0"}}>{locations.length} location{locations.length!==1?"s":""} · CA total : <strong style={{color:"#059669"}}>{totalCA.toLocaleString("fr-FR",{minimumFractionDigits:2})} €</strong></p>
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <label style={{background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#065f46",borderRadius:10,padding:"10px 16px",fontWeight:700,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",gap:6}}>
            {importing?"⏳ Import…":"📊 Importer Excel"}
            <input type="file" accept=".xlsx,.xls" onChange={handleImportExcelLoc} style={{display:"none"}} disabled={importing}/>
          </label>
          <button onClick={openAdd} style={{background:"#111827",color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",fontWeight:700,cursor:"pointer",fontSize:13}}>+ Nouvelle location</button>
        </div>
      </div>


      {importResult&&(
        <div style={{background:importResult.err===0?"#d1fae5":"#fef3c7",border:`1px solid ${importResult.err===0?"#6ee7b7":"#fde68a"}`,borderRadius:12,padding:"12px 18px",fontSize:13,color:importResult.err===0?"#065f46":"#92400e",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span>✅ <strong>{importResult.ok}</strong> location{importResult.ok>1?"s":""} importée{importResult.ok>1?"s":""}{importResult.err>0?` · ⚠️ ${importResult.err} ligne${importResult.err>1?"s":""} ignorée${importResult.err>1?"s":""} (données manquantes)`:""}</span>
          <button onClick={()=>setImportResult(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#6b7280"}}>✕</button>
        </div>
      )}
      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:12}}>
        {Object.entries(STATUTS_LOC).map(([s,c])=>(
          <div key={s} onClick={()=>setFilterStatut(s===filterStatut?"tous":s)} style={{background:filterStatut===s?c.bg:"#fff",borderRadius:14,padding:"14px 16px",border:`2px solid ${filterStatut===s?c.color:"#e5e7eb"}`,cursor:"pointer",transition:"all 0.15s"}}>
            <div style={{fontSize:20,marginBottom:4}}>{c.icon}</div>
            <div style={{fontSize:24,fontWeight:900,color:c.color}}>{counts[s]||0}</div>
            <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Liste */}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {filtered.length===0 ? (
          <div style={{background:"#fff",borderRadius:14,border:"1px solid #e5e7eb",padding:50,textAlign:"center"}}>
            <div style={{fontSize:44,marginBottom:12}}>🔑</div>
            <div style={{fontWeight:700,color:"#374151",fontSize:16}}>Aucune location</div>
            <div style={{color:"#9ca3af",fontSize:13,marginTop:6}}>Cliquez sur "+ Nouvelle location" pour commencer</div>
          </div>
        ) : filtered.map(loc => {
          const st = getStatutEffectif(loc);
          const conf = STATUTS_LOC[st]||STATUTS_LOC.en_cours;
          const nbJours = jours(loc);
          return (
            <div key={loc.id} style={{background:"#fff",borderRadius:14,border:`2px solid ${st==="en_retard"?"#fca5a5":st==="en_cours"?"#93c5fd":"#e5e7eb"}`,padding:18,display:"flex",gap:16,flexWrap:"wrap",alignItems:"flex-start"}}>
              <div style={{flex:1,minWidth:240}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  <span style={{background:conf.bg,color:conf.color,padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:700}}>{conf.icon} {conf.label}</span>
                  <span style={{background:loc.type==="vehicule"?"#f3e8ff":"#dbeafe",color:loc.type==="vehicule"?"#7c3aed":"#1e40af",padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:700}}>{loc.type==="vehicule"?"🚗 Véhicule":"📦 Article"}</span>
                </div>
                <div style={{fontWeight:800,fontSize:16,color:"#111827",marginBottom:4}}>{loc.materiel_nom}</div>
                {loc.materiel_id&&<div style={{fontSize:11,color:"#9ca3af",fontFamily:"monospace",marginBottom:8}}>ID: {loc.materiel_id}</div>}
                <div style={{fontSize:13,color:"#374151"}}><strong>👤 {loc.locataire_nom}</strong>{loc.locataire_entreprise?` — ${loc.locataire_entreprise}`:""}</div>
                {loc.locataire_tel&&<div style={{fontSize:12,color:"#6b7280",marginTop:2}}>📞 {loc.locataire_tel}</div>}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6,minWidth:160}}>
                <div style={{fontSize:12,color:"#6b7280"}}>📅 Du <strong>{new Date(loc.date_debut).toLocaleDateString("fr-FR")}</strong></div>
                <div style={{fontSize:12,color:"#6b7280"}}>📅 Au <strong>{new Date(loc.date_fin_prevue).toLocaleDateString("fr-FR")}</strong></div>
                <div style={{fontSize:12,color:"#6b7280"}}>⏱️ <strong>{nbJours}</strong> jour{nbJours>1?"s":""}</div>
                {loc.prix_jour>0&&<div style={{fontSize:13,fontWeight:700,color:"#059669"}}>💶 {loc.prix_jour}€/j · Total: {(loc.prix_total||0).toFixed(2)}€</div>}
                {loc.caution>0&&<div style={{fontSize:12,color:"#d97706"}}>🔒 Caution: {loc.caution}€</div>}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {loc.statut==="en_cours"&&<button onClick={()=>handleRetour(loc)} style={{padding:"7px 14px",background:"#d1fae5",border:"1px solid #6ee7b7",borderRadius:9,cursor:"pointer",fontSize:12,fontWeight:700,color:"#065f46"}}>✅ Retour</button>}
                <button onClick={()=>openEdit(loc)} style={{padding:"7px 14px",background:"#f3f4f6",border:"none",borderRadius:9,cursor:"pointer",fontSize:12,fontWeight:600}}>✏️ Modifier</button>
                <button onClick={()=>handleDelete(loc.id)} style={{padding:"7px 14px",background:"#fee2e2",border:"none",borderRadius:9,cursor:"pointer",fontSize:12,color:"#dc2626",fontWeight:600}}>🗑 Supprimer</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal formulaire */}
      {showForm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
          <div style={{background:"#fff",borderRadius:20,padding:28,width:"min(96vw,560px)",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h2 style={{fontSize:17,fontWeight:800,color:"#111827",margin:0}}>{editLoc?"✏️ Modifier":"🔑 Nouvelle location"}</h2>
              <button onClick={()=>setShowForm(false)} style={{background:"#f3f4f6",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:15}}>✕</button>
            </div>

            {/* Type matériel */}
            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:6}}>Type de matériel</label>
              <div style={{display:"flex",gap:8}}>
                {[{v:"vehicule",l:"🚗 Véhicule/Engin"},{v:"article",l:"📦 Article stock"}].map(t=>(
                  <button key={t.v} onClick={()=>{setForm(f=>({...f,type:t.v,materiel_id:"",materiel_nom:""}));setParcSearch("");setArticleSearch("");}} style={{flex:1,padding:"10px",borderRadius:10,border:`2px solid ${form.type===t.v?"#111827":"#e5e7eb"}`,background:form.type===t.v?"#111827":"#fff",color:form.type===t.v?"#fff":"#374151",fontWeight:600,cursor:"pointer",fontSize:13}}>{t.l}</button>
                ))}
              </div>
            </div>

            {/* Recherche matériel */}
            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:6}}>{form.type==="vehicule"?"Véhicule / Engin":"Article du stock"} *</label>
              {form.type==="vehicule" ? (
                <>
                  <input value={parcSearch||form.materiel_nom} onChange={e=>{setParcSearch(e.target.value);setParcSugg(PARC_VEHICULES.filter(v=>(v.immat||v.designation||"").toLowerCase().includes(e.target.value.toLowerCase())&&e.target.value).slice(0,6));}} placeholder="Rechercher immatriculation, désignation…" style={{width:"100%",padding:"10px 14px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                  {parcSugg.length>0&&<div style={{border:"1px solid #e5e7eb",borderRadius:10,overflow:"hidden",marginTop:4}}>
                    {parcSugg.map((v,i)=><div key={i} onClick={()=>{setForm(f=>({...f,materiel_id:v.immat||v.id||"",materiel_nom:(v.designation||v.immat||"")}));setParcSearch("");setParcSugg([]);}} style={{padding:"10px 14px",cursor:"pointer",fontSize:13,borderBottom:"1px solid #f3f4f6",background:"#fff"}} onMouseEnter={e=>e.target.style.background="#f9fafb"} onMouseLeave={e=>e.target.style.background="#fff"}>
                      <div style={{fontWeight:600}}>{v.designation||v.immat}</div>
                      <div style={{fontSize:11,color:"#9ca3af"}}>{v.immat} {v.type?" · "+v.type:""}</div>
                    </div>)}
                  </div>}
                </>
              ) : (
                <>
                  <input value={articleSearch||form.materiel_nom} onChange={e=>{setArticleSearch(e.target.value);setArticleSugg((products||ALL_PRODUCTS).filter(p=>(p.name||"").toLowerCase().includes(e.target.value.toLowerCase())&&e.target.value).slice(0,6));}} placeholder="Rechercher article…" style={{width:"100%",padding:"10px 14px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                  {articleSugg.length>0&&<div style={{border:"1px solid #e5e7eb",borderRadius:10,overflow:"hidden",marginTop:4}}>
                    {articleSugg.map((p,i)=><div key={i} onClick={()=>{setForm(f=>({...f,materiel_id:p.id,materiel_nom:p.name}));setArticleSearch("");setArticleSugg([]);}} style={{padding:"10px 14px",cursor:"pointer",fontSize:13,borderBottom:"1px solid #f3f4f6",background:"#fff"}} onMouseEnter={e=>e.target.style.background="#f9fafb"} onMouseLeave={e=>e.target.style.background="#fff"}>
                      <div style={{fontWeight:600}}>{p.name}</div>
                      <div style={{fontSize:11,color:"#9ca3af"}}>{p.id}</div>
                    </div>)}
                  </div>}
                </>
              )}
              {form.materiel_nom&&<div style={{marginTop:6,padding:"8px 12px",background:"#dbeafe",borderRadius:8,fontSize:12,color:"#1e40af",fontWeight:600}}>✓ {form.materiel_nom}</div>}
            </div>

            {/* Locataire */}
            <div style={{background:"#f9fafb",borderRadius:12,padding:14,marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:700,color:"#374151",marginBottom:10}}>👤 Informations locataire</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {[{l:"Nom *",k:"locataire_nom",ph:"Dupont Jean"},{l:"Entreprise",k:"locataire_entreprise",ph:"SARL..."},{l:"Téléphone",k:"locataire_tel",ph:"06 00 00 00 00"},{l:"Email",k:"locataire_email",ph:"contact@..."}].map(f=>(
                  <div key={f.k}>
                    <label style={{fontSize:11,fontWeight:600,color:"#6b7280",display:"block",marginBottom:4}}>{f.l}</label>
                    <input value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} style={{width:"100%",padding:"9px 12px",border:"1px solid #e5e7eb",borderRadius:9,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                  </div>
                ))}
              </div>
            </div>

            {/* Dates et prix */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              {[{l:"Date début *",k:"date_debut",t:"date"},{l:"Date fin prévue *",k:"date_fin_prevue",t:"date"},{l:"Prix/jour (€)",k:"prix_jour",t:"number"},{l:"Caution (€)",k:"caution",t:"number"}].map(f=>(
                <div key={f.k}>
                  <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>{f.l}</label>
                  <input type={f.t} value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} step={f.t==="number"?"0.01":undefined} style={{width:"100%",padding:"10px 12px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                </div>
              ))}
            </div>

            {editLoc&&<div style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:6}}>Statut</label>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {Object.entries(STATUTS_LOC).map(([s,c])=>(
                  <button key={s} onClick={()=>setForm(f=>({...f,statut:s}))} style={{padding:"7px 14px",borderRadius:9,border:`2px solid ${form.statut===s?c.color:"#e5e7eb"}`,background:form.statut===s?c.bg:"#fff",color:form.statut===s?c.color:"#374151",fontWeight:600,cursor:"pointer",fontSize:12}}>{c.icon} {c.label}</button>
                ))}
              </div>
            </div>}

            <div style={{marginBottom:18}}>
              <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>Notes</label>
              <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Observations, conditions particulières…" rows={2} style={{width:"100%",padding:"10px 14px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",resize:"vertical",boxSizing:"border-box"}}/>
            </div>

            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setShowForm(false)} style={{flex:1,padding:"12px",background:"#f3f4f6",border:"none",borderRadius:10,fontWeight:600,cursor:"pointer"}}>Annuler</button>
              <button onClick={handleSave} disabled={saving||!form.materiel_nom||!form.locataire_nom} style={{flex:2,padding:"12px",background:saving||!form.materiel_nom||!form.locataire_nom?"#e5e7eb":"#111827",color:saving||!form.materiel_nom||!form.locataire_nom?"#9ca3af":"#fff",border:"none",borderRadius:10,fontWeight:700,cursor:"pointer",fontSize:14}}>
                {saving?"⏳ Enregistrement…":"💾 Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PRÊT MATÉRIELS ─────────────────────────────────────────────────────────────
const STATUTS_PRET = {
  en_cours:  { label:"En cours",  color:"#1e40af", bg:"#dbeafe", icon:"🤝" },
  rendu:     { label:"Rendu",     color:"#065f46", bg:"#d1fae5", icon:"✅" },
  en_retard: { label:"En retard", color:"#dc2626", bg:"#fee2e2", icon:"⚠️" },
};

function PretMateriel({ prets, setPrets, siteId, products }) {
  const [showForm, setShowForm] = useState(false);
  const [editPret, setEditPret] = useState(null);
  const [filterStatut, setFilterStatut] = useState("tous");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [parcSearch, setParcSearch] = useState("");
  const [parcSugg, setParcSugg] = useState([]);
  const [articleSearch, setArticleSearch] = useState("");
  const [articleSugg, setArticleSugg] = useState([]);
  const [form, setForm] = useState({
    type:"vehicule", materiel_id:"", materiel_nom:"",
    emprunteur_nom:"", emprunteur_service:"", emprunteur_tel:"",
    date_pret: new Date().toISOString().split("T")[0],
    date_retour_prevue: new Date(Date.now()+7*86400000).toISOString().split("T")[0],
    statut:"en_cours", notes:""
  });

  const filtered = filterStatut==="tous" ? prets : prets.filter(p=>p.statut===filterStatut);
  const counts = { tous: prets.length };
  Object.keys(STATUTS_PRET).forEach(s => { counts[s] = prets.filter(p=>p.statut===s).length; });

  const getStatutEffectif = (p) => {
    if(p.statut==="en_cours" && new Date(p.date_retour_prevue) < new Date()) return "en_retard";
    return p.statut;
  };

  const handleImportExcelPret = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true); setImportResult(null);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const XLSX = window.XLSX;
        if (!XLSX) { alert("Rechargez la page."); setImporting(false); return; }
        const wb = XLSX.read(ev.target.result, { type:"array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws);
        const parseDate = (v) => {
          if (!v) return null;
          if (typeof v === "number") return new Date(Math.round((v-25569)*86400*1000)).toISOString().split("T")[0];
          const s = String(v).trim();
          if (s.includes("/")) { const [a,b,c]=s.split("/"); return `${c?.length===2?"20"+c:c||new Date().getFullYear()}-${b?.padStart(2,"0")}-${a?.padStart(2,"0")}`; }
          return s||null;
        };
        let ok=0, err=0;
        for (const row of rows) {
          const mat = String(row["Matériel"]||row["Désignation"]||row["materiel_nom"]||row["Nom matériel"]||"").trim();
          const emp = String(row["Emprunteur"]||row["Nom"]||row["emprunteur_nom"]||"").trim();
          if (!mat||!emp){err++;continue;}
          const record = {
            type: String(row["Type"]||"vehicule").toLowerCase().includes("art")?"article":"vehicule",
            materiel_id: String(row["Immatriculation"]||row["ID"]||row["materiel_id"]||"").trim(),
            materiel_nom: mat, emprunteur_nom: emp,
            emprunteur_service: String(row["Service"]||row["Entreprise"]||row["emprunteur_service"]||"").trim(),
            emprunteur_tel: String(row["Téléphone"]||row["Tel"]||"").trim(),
            date_pret: parseDate(row["Date prêt"]||row["Date"]||row["date_pret"])||new Date().toISOString().split("T")[0],
            date_retour_prevue: parseDate(row["Retour prévu"]||row["Date retour"]||row["date_retour_prevue"])||new Date(Date.now()+7*86400000).toISOString().split("T")[0],
            date_retour_reelle: parseDate(row["Retour réel"]||row["date_retour_reelle"]||null),
            statut: (() => { const s=String(row["Statut"]||"en_cours").toLowerCase(); if(s.includes("rendu")||s.includes("retour"))return"rendu"; if(s.includes("retard"))return"en_retard"; return"en_cours"; })(),
            notes: String(row["Notes"]||"").trim(),
          };
          const saved = await addPret(record, siteId);
          if(saved){setPrets(prev=>[saved,...prev]);ok++;}else err++;
        }
        setImportResult({ok,err,total:rows.length});
      } catch(ex){alert("Erreur import: "+ex.message);}
      setImporting(false); e.target.value="";
    };
    reader.readAsArrayBuffer(file);
  };

  const openAdd = () => {
    setEditPret(null);
    setForm({ type:"vehicule", materiel_id:"", materiel_nom:"", emprunteur_nom:"", emprunteur_service:"", emprunteur_tel:"", date_pret:new Date().toISOString().split("T")[0], date_retour_prevue:new Date(Date.now()+7*86400000).toISOString().split("T")[0], statut:"en_cours", notes:"" });
    setParcSearch(""); setArticleSearch("");
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditPret(p);
    setForm({ type:p.type, materiel_id:p.materiel_id, materiel_nom:p.materiel_nom, emprunteur_nom:p.emprunteur_nom, emprunteur_service:p.emprunteur_service||"", emprunteur_tel:p.emprunteur_tel||"", date_pret:p.date_pret, date_retour_prevue:p.date_retour_prevue, statut:p.statut, notes:p.notes||"" });
    setShowForm(true);
  };

  const handleSave = async () => {
    if(!form.materiel_nom||!form.emprunteur_nom){return;}
    setSaving(true);
    const data = { ...form };
    if(editPret) {
      await updatePret(editPret.id, data);
      setPrets(prev=>prev.map(p=>p.id===editPret.id?{...p,...data}:p));
    } else {
      const saved = await addPret(data, siteId);
      if(saved) setPrets(prev=>[saved,...prev]);
    }
    setSaving(false); setShowForm(false);
  };

  const handleDelete = async (id) => {
    if(!window.confirm("Supprimer ce prêt ?")) return;
    await deletePret(id);
    setPrets(prev=>prev.filter(p=>p.id!==id));
  };

  const handleRetour = async (p) => {
    const today = new Date().toISOString().split("T")[0];
    await updatePret(p.id, { statut:"rendu", date_retour_reelle:today });
    setPrets(prev=>prev.map(x=>x.id===p.id?{...x,statut:"rendu",date_retour_reelle:today}:x));
  };

  const jours = (p) => Math.max(0, Math.ceil((new Date(p.date_retour_prevue)-new Date(p.date_pret))/(86400000)));

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:900,color:"#111827",margin:0}}>🤝 Prêt de matériels</h1>
          <p style={{color:"#6b7280",fontSize:13,margin:"4px 0 0"}}>{prets.length} prêt{prets.length!==1?"s":""} enregistré{prets.length!==1?"s":""}</p>
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <label style={{background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#065f46",borderRadius:10,padding:"10px 16px",fontWeight:700,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",gap:6}}>
            {importing?"⏳ Import…":"📊 Importer Excel"}
            <input type="file" accept=".xlsx,.xls" onChange={handleImportExcelPret} style={{display:"none"}} disabled={importing}/>
          </label>
          <button onClick={openAdd} style={{background:"#111827",color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",fontWeight:700,cursor:"pointer",fontSize:13}}>+ Nouveau prêt</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:12}}>
        {Object.entries(STATUTS_PRET).map(([s,c])=>(
          <div key={s} onClick={()=>setFilterStatut(s===filterStatut?"tous":s)} style={{background:filterStatut===s?c.bg:"#fff",borderRadius:14,padding:"14px 16px",border:`2px solid ${filterStatut===s?c.color:"#e5e7eb"}`,cursor:"pointer"}}>
            <div style={{fontSize:20,marginBottom:4}}>{c.icon}</div>
            <div style={{fontSize:24,fontWeight:900,color:c.color}}>{counts[s]||0}</div>
            <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Liste */}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {filtered.length===0 ? (
          <div style={{background:"#fff",borderRadius:14,border:"1px solid #e5e7eb",padding:50,textAlign:"center"}}>
            <div style={{fontSize:44,marginBottom:12}}>🤝</div>
            <div style={{fontWeight:700,color:"#374151",fontSize:16}}>Aucun prêt enregistré</div>
            <div style={{color:"#9ca3af",fontSize:13,marginTop:6}}>Cliquez sur "+ Nouveau prêt" pour commencer</div>
          </div>
        ) : filtered.map(p => {
          const st = getStatutEffectif(p);
          const conf = STATUTS_PRET[st]||STATUTS_PRET.en_cours;
          const nbJours = jours(p);
          return (
            <div key={p.id} style={{background:"#fff",borderRadius:14,border:`2px solid ${st==="en_retard"?"#fca5a5":st==="en_cours"?"#93c5fd":"#e5e7eb"}`,padding:18,display:"flex",gap:16,flexWrap:"wrap",alignItems:"flex-start"}}>
              <div style={{flex:1,minWidth:240}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  <span style={{background:conf.bg,color:conf.color,padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:700}}>{conf.icon} {conf.label}</span>
                  <span style={{background:p.type==="vehicule"?"#f3e8ff":"#dbeafe",color:p.type==="vehicule"?"#7c3aed":"#1e40af",padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:700}}>{p.type==="vehicule"?"🚗 Véhicule":"📦 Article"}</span>
                </div>
                <div style={{fontWeight:800,fontSize:16,color:"#111827",marginBottom:4}}>{p.materiel_nom}</div>
                {p.materiel_id&&<div style={{fontSize:11,color:"#9ca3af",fontFamily:"monospace",marginBottom:8}}>{p.materiel_id}</div>}
                <div style={{fontSize:13,color:"#374151"}}><strong>👤 {p.emprunteur_nom}</strong>{p.emprunteur_service?` — ${p.emprunteur_service}`:""}</div>
                {p.emprunteur_tel&&<div style={{fontSize:12,color:"#6b7280",marginTop:2}}>📞 {p.emprunteur_tel}</div>}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6,minWidth:160}}>
                <div style={{fontSize:12,color:"#6b7280"}}>📅 Prêté le <strong>{new Date(p.date_pret).toLocaleDateString("fr-FR")}</strong></div>
                <div style={{fontSize:12,color:st==="en_retard"?"#dc2626":"#6b7280"}}>📅 Retour prévu <strong>{new Date(p.date_retour_prevue).toLocaleDateString("fr-FR")}</strong></div>
                {p.date_retour_reelle&&<div style={{fontSize:12,color:"#059669"}}>✅ Rendu le <strong>{new Date(p.date_retour_reelle).toLocaleDateString("fr-FR")}</strong></div>}
                <div style={{fontSize:12,color:"#6b7280"}}>⏱️ <strong>{nbJours}</strong> jour{nbJours>1?"s":""}</div>
                {p.notes&&<div style={{fontSize:11,color:"#6b7280",fontStyle:"italic"}}>💬 {p.notes}</div>}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {p.statut==="en_cours"&&<button onClick={()=>handleRetour(p)} style={{padding:"7px 14px",background:"#d1fae5",border:"1px solid #6ee7b7",borderRadius:9,cursor:"pointer",fontSize:12,fontWeight:700,color:"#065f46"}}>✅ Retour</button>}
                <button onClick={()=>openEdit(p)} style={{padding:"7px 14px",background:"#f3f4f6",border:"none",borderRadius:9,cursor:"pointer",fontSize:12,fontWeight:600}}>✏️ Modifier</button>
                <button onClick={()=>handleDelete(p.id)} style={{padding:"7px 14px",background:"#fee2e2",border:"none",borderRadius:9,cursor:"pointer",fontSize:12,color:"#dc2626",fontWeight:600}}>🗑 Supprimer</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal formulaire */}
      {showForm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
          <div style={{background:"#fff",borderRadius:20,padding:28,width:"min(96vw,520px)",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h2 style={{fontSize:17,fontWeight:800,color:"#111827",margin:0}}>{editPret?"✏️ Modifier":"🤝 Nouveau prêt"}</h2>
              <button onClick={()=>setShowForm(false)} style={{background:"#f3f4f6",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:15}}>✕</button>
            </div>

            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:6}}>Type de matériel</label>
              <div style={{display:"flex",gap:8}}>
                {[{v:"vehicule",l:"🚗 Véhicule/Engin"},{v:"article",l:"📦 Article stock"}].map(t=>(
                  <button key={t.v} onClick={()=>{setForm(f=>({...f,type:t.v,materiel_id:"",materiel_nom:""}));setParcSearch("");setArticleSearch("");}} style={{flex:1,padding:"10px",borderRadius:10,border:`2px solid ${form.type===t.v?"#111827":"#e5e7eb"}`,background:form.type===t.v?"#111827":"#fff",color:form.type===t.v?"#fff":"#374151",fontWeight:600,cursor:"pointer",fontSize:13}}>{t.l}</button>
                ))}
              </div>
            </div>

            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:6}}>{form.type==="vehicule"?"Véhicule / Engin":"Article du stock"} *</label>
              {form.type==="vehicule" ? (
                <>
                  <input value={parcSearch||form.materiel_nom} onChange={e=>{setParcSearch(e.target.value);setParcSugg(PARC_VEHICULES.filter(v=>(v.immat||v.designation||"").toLowerCase().includes(e.target.value.toLowerCase())&&e.target.value).slice(0,6));}} placeholder="Rechercher…" style={{width:"100%",padding:"10px 14px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                  {parcSugg.length>0&&<div style={{border:"1px solid #e5e7eb",borderRadius:10,overflow:"hidden",marginTop:4}}>
                    {parcSugg.map((v,i)=><div key={i} onClick={()=>{setForm(f=>({...f,materiel_id:v.immat||v.id||"",materiel_nom:(v.designation||v.immat||"")}));setParcSearch("");setParcSugg([]);}} style={{padding:"10px 14px",cursor:"pointer",fontSize:13,borderBottom:"1px solid #f3f4f6",background:"#fff"}}><div style={{fontWeight:600}}>{v.designation||v.immat}</div><div style={{fontSize:11,color:"#9ca3af"}}>{v.immat}</div></div>)}
                  </div>}
                </>
              ) : (
                <>
                  <input value={articleSearch||form.materiel_nom} onChange={e=>{setArticleSearch(e.target.value);setArticleSugg((products||ALL_PRODUCTS).filter(p=>(p.name||"").toLowerCase().includes(e.target.value.toLowerCase())&&e.target.value).slice(0,6));}} placeholder="Rechercher article…" style={{width:"100%",padding:"10px 14px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                  {articleSugg.length>0&&<div style={{border:"1px solid #e5e7eb",borderRadius:10,overflow:"hidden",marginTop:4}}>
                    {articleSugg.map((p,i)=><div key={i} onClick={()=>{setForm(f=>({...f,materiel_id:p.id,materiel_nom:p.name}));setArticleSearch("");setArticleSugg([]);}} style={{padding:"10px 14px",cursor:"pointer",fontSize:13,borderBottom:"1px solid #f3f4f6",background:"#fff"}}><div style={{fontWeight:600}}>{p.name}</div><div style={{fontSize:11,color:"#9ca3af"}}>{p.id}</div></div>)}
                  </div>}
                </>
              )}
              {form.materiel_nom&&<div style={{marginTop:6,padding:"8px 12px",background:"#dbeafe",borderRadius:8,fontSize:12,color:"#1e40af",fontWeight:600}}>✓ {form.materiel_nom}</div>}
            </div>

            <div style={{background:"#f9fafb",borderRadius:12,padding:14,marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:700,color:"#374151",marginBottom:10}}>👤 Emprunteur</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {[{l:"Nom *",k:"emprunteur_nom",ph:"Dupont Jean"},{l:"Service / Entreprise",k:"emprunteur_service",ph:"Atelier..."},{l:"Téléphone",k:"emprunteur_tel",ph:"06 00 00 00 00"}].map(f=>(
                  <div key={f.k}>
                    <label style={{fontSize:11,fontWeight:600,color:"#6b7280",display:"block",marginBottom:4}}>{f.l}</label>
                    <input value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} style={{width:"100%",padding:"9px 12px",border:"1px solid #e5e7eb",borderRadius:9,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                  </div>
                ))}
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              {[{l:"Date de prêt *",k:"date_pret",t:"date"},{l:"Date retour prévue *",k:"date_retour_prevue",t:"date"}].map(f=>(
                <div key={f.k}>
                  <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>{f.l}</label>
                  <input type={f.t} value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} style={{width:"100%",padding:"10px 12px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                </div>
              ))}
            </div>

            {editPret&&<div style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:6}}>Statut</label>
              <div style={{display:"flex",gap:6}}>
                {Object.entries(STATUTS_PRET).map(([s,c])=>(
                  <button key={s} onClick={()=>setForm(f=>({...f,statut:s}))} style={{flex:1,padding:"8px",borderRadius:9,border:`2px solid ${form.statut===s?c.color:"#e5e7eb"}`,background:form.statut===s?c.bg:"#fff",color:form.statut===s?c.color:"#374151",fontWeight:600,cursor:"pointer",fontSize:12}}>{c.icon} {c.label}</button>
                ))}
              </div>
            </div>}

            <div style={{marginBottom:18}}>
              <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>Notes</label>
              <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="État du matériel, conditions…" rows={2} style={{width:"100%",padding:"10px 14px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",resize:"vertical",boxSizing:"border-box"}}/>
            </div>

            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setShowForm(false)} style={{flex:1,padding:"12px",background:"#f3f4f6",border:"none",borderRadius:10,fontWeight:600,cursor:"pointer"}}>Annuler</button>
              <button onClick={handleSave} disabled={saving||!form.materiel_nom||!form.emprunteur_nom} style={{flex:2,padding:"12px",background:saving||!form.materiel_nom||!form.emprunteur_nom?"#e5e7eb":"#111827",color:saving||!form.materiel_nom||!form.emprunteur_nom?"#9ca3af":"#fff",border:"none",borderRadius:10,fontWeight:700,cursor:"pointer",fontSize:14}}>
                {saving?"⏳ Enregistrement…":"💾 Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── GESTION CATALOGUE (pour CLAISSE RAIL et STMF) ────────────────────────────
function GestionCatalogue({ siteId, catalogue, setCatalogue }) {
  const [showImport,setShowImport]=useState(false);
  const [importing,setImporting]=useState(false);
  const [search,setSearch]=useState("");
  const site=SITES[siteId];

  if(siteId==="clmtp_sable") return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <h1 style={{fontSize:22,fontWeight:900,color:"#111827",margin:0}}>Catalogue articles</h1>
      <div style={{background:"#dbeafe",borderRadius:12,padding:"16px 20px",fontSize:14,color:"#1e40af"}}>
        ℹ️ Le site <strong>CLMTP SABLÉ</strong> utilise un catalogue statique de <strong>{ALL_PRODUCTS.length.toLocaleString("fr-FR")} références</strong> importé depuis votre fichier Excel d'origine.
      </div>
    </div>
  );

  const handleImport = (e) => {
    const file=e.target.files[0];
    if(!file) return;
    setImporting(true);
    const reader=new FileReader();
    reader.onload=async(ev)=>{
      try {
        // Utilisation de SheetJS via CDN
        const XLSX=window.XLSX;
        if(!XLSX){alert("Rechargez la page et réessayez.");setImporting(false);return;}
        const wb=XLSX.read(ev.target.result,{type:"array"});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const data=XLSX.utils.sheet_to_json(ws);
        let articles=[];
        let idx=1;
        for(const row of data){
          const nom=String(row["Nom"]||row["Désignation"]||row["Article"]||row["NAME"]||"").trim();
          if(!nom) continue;
          const id=String(row["SKU"]||row["ID"]||row["Référence"]||row["REF"]||`ART-${String(idx).padStart(4,"0")}`).trim();
          articles.push({
            id, name:nom,
            sku: String(row["SKU"]||row["Référence"]||id),
            category: String(row["Catégorie"]||row["CATEGORIE"]||"Général"),
            fournisseur: String(row["Fournisseur"]||row["FOURNISSEUR"]||""),
            stock: parseInt(row["Stock"]||row["QTÉ"]||row["Quantité"]||0)||0,
            min: parseInt(row["Min"]||row["Minimum"]||row["Stock min"]||0)||0,
            location: String(row["Emplacement"]||row["Location"]||""),
            prix: parseFloat(row["Prix"]||row["Prix HT"]||0)||0,
            unit: String(row["Unité"]||"pcs"),
          });
          idx++;
        }
        const ok=await importCatalogue(siteId,articles);
        if(ok){
          setCatalogue(articles.map(a=>({...a,status:a.stock===0?'rupture':a.min>0&&a.stock<a.min?'warning':'ok'})));
          alert(`✅ ${articles.length} articles importés dans le catalogue ${site.label} !`);
        }else{alert("Erreur lors de l'import.");}
      }catch(err){alert("Erreur : "+err.message);}
      setImporting(false);
      setShowImport(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const filtered=catalogue.filter(a=>{
    if(!search) return true;
    const s=search.toLowerCase();
    return a.name.toLowerCase().includes(s)||a.id.toLowerCase().includes(s)||(a.fournisseur||"").toLowerCase().includes(s);
  });

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:900,color:"#111827",margin:0}}>Catalogue — {site.label}</h1>
          <p style={{color:"#6b7280",fontSize:13,margin:"4px 0 0"}}>{catalogue.length} article{catalogue.length!==1?"s":""} dans le catalogue</p>
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <button onClick={()=>{
            const XLSX = window.XLSX;
            if(!XLSX){alert("Rechargez la page.");return;}
            const headers = [["SKU","Nom / Désignation","Fournisseur","Stock initial","Stock minimum","Emplacement","Prix HT (€)","Catégorie","Unité"]];
            const exemple = [
              ["FIL-001","Filtre à air","MANN","10","2","A1-01","15.50","Filtration","pcs"],
              ["HUI-002","Huile moteur 5W30","TOTAL","5","1","B2-03","12.00","Lubrifiants","L"],
              ["COU-003","Courroie distribution","GATES","3","1","C1-02","45.00","Transmission","pcs"],
            ];
            const ws = XLSX.utils.aoa_to_sheet([...headers, ...exemple]);
            ws['!cols'] = [12,25,15,12,12,15,12,15,8].map(w=>({wch:w}));
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Catalogue");
            XLSX.writeFile(wb, `modele_catalogue_${siteId}.xlsx`);
          }} style={{background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#065f46",borderRadius:10,padding:"10px 16px",fontWeight:700,cursor:"pointer",fontSize:13}}>
            📥 Modèle Excel
          </button>
          <button onClick={()=>setShowImport(true)} style={{background:site.color,color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",fontWeight:700,cursor:"pointer",fontSize:13}}>📊 Importer Excel</button>
        </div>
      </div>

      <div style={{background:site.bg,border:`1px solid ${site.color}33`,borderRadius:12,padding:"14px 18px",fontSize:13,color:site.color}}>
        {site.icon} <strong>{site.label}</strong> — Importez votre catalogue depuis un fichier Excel. Colonnes recommandées : <strong>SKU, Nom, Fournisseur, Stock, Min, Emplacement, Prix HT, Catégorie</strong>
      </div>

      {catalogue.length > 0 && (
        <>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher…"
            style={{padding:"10px 16px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none"}}/>
          <div style={{background:"#fff",borderRadius:14,border:"1px solid #e5e7eb",overflow:"hidden"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{background:site.color}}>
                {["SKU","Désignation","Fournisseur","Emplacement","Stock","Min.","Prix HT","Statut"].map(h=>(
                  <th key={h} style={{padding:"10px 13px",textAlign:"left",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.8)",textTransform:"uppercase",letterSpacing:0.5,whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.slice(0,100).map((a,i)=>(
                  <tr key={a.id+i} style={{borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                    <td style={{padding:"9px 13px",fontFamily:"monospace",fontSize:11,color:"#6b7280"}}>{a.id}</td>
                    <td style={{padding:"9px 13px",fontWeight:600,fontSize:13,color:"#111827",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</td>
                    <td style={{padding:"9px 13px",fontSize:12,color:"#6b7280"}}>{a.fournisseur||"—"}</td>
                    <td style={{padding:"9px 13px",fontFamily:"monospace",fontSize:12,color:"#374151"}}>{a.location||"—"}</td>
                    <td style={{padding:"9px 13px",textAlign:"center",fontWeight:900,fontSize:16,color:a.stock===0?"#dc2626":"#059669"}}>{a.stock}</td>
                    <td style={{padding:"9px 13px",textAlign:"center",fontSize:12,color:"#9ca3af"}}>{a.min}</td>
                    <td style={{padding:"9px 13px",textAlign:"right",fontSize:12,fontWeight:600,color:"#374151"}}>{a.prix>0?a.prix.toFixed(2)+" €":"—"}</td>
                    <td style={{padding:"9px 13px"}}><Badge status={a.status}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length>100&&<div style={{padding:"10px",textAlign:"center",fontSize:12,color:"#9ca3af"}}>Affichage limité à 100 résultats — affinez la recherche</div>}
          </div>
        </>
      )}

      {catalogue.length===0&&(
        <div style={{background:"#fff",borderRadius:14,border:"1px solid #e5e7eb",padding:60,textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:14}}>{site.icon}</div>
          <div style={{fontWeight:700,fontSize:17,color:"#374151",marginBottom:8}}>Aucun article dans le catalogue</div>
          <div style={{color:"#9ca3af",fontSize:13,marginBottom:24}}>Importez votre fichier Excel pour créer le catalogue de {site.label}</div>
          <button onClick={()=>setShowImport(true)} style={{padding:"12px 24px",background:site.color,color:"#fff",border:"none",borderRadius:10,fontWeight:700,cursor:"pointer",fontSize:14}}>📊 Importer mon catalogue Excel</button>
        </div>
      )}

      {showImport&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
          <div style={{background:"#fff",borderRadius:20,padding:30,width:"min(96vw,460px)",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h2 style={{fontSize:17,fontWeight:800,color:"#111827",margin:0}}>📊 Import catalogue Excel</h2>
              <button onClick={()=>setShowImport(false)} style={{background:"#f3f4f6",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:15}}>✕</button>
            </div>
            <div style={{background:site.bg,borderRadius:10,padding:"12px 14px",marginBottom:16,fontSize:12}}>
              <div style={{fontWeight:700,color:site.color,marginBottom:8}}>Colonnes Excel reconnues :</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                {["SKU *","Nom *","Fournisseur","Catégorie","Stock","Min","Emplacement","Prix HT","Unité"].map(c=>(
                  <div key={c} style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:6,padding:"5px 8px",fontSize:11,fontWeight:c.includes("*")?"700":"400",color:c.includes("*")?site.color:"#6b7280"}}>{c}</div>
                ))}
              </div>
            </div>
            <label style={{display:"block",padding:"18px",background:"#f9fafb",border:`2px dashed ${site.color}`,borderRadius:12,textAlign:"center",cursor:"pointer",color:site.color,fontWeight:600,fontSize:14}}>
              {importing?"⏳ Import en cours…":"📁 Cliquez pour sélectionner votre fichier Excel"}
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} style={{display:"none"}} disabled={importing}/>
            </label>
            <button onClick={()=>setShowImport(false)} style={{width:"100%",marginTop:10,padding:"11px",background:"#f3f4f6",border:"none",borderRadius:10,fontWeight:600,cursor:"pointer",fontSize:13}}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SITES ─────────────────────────────────────────────────────────────────────
const SITES = {
  clmtp_sable:  { label: "CLMTP SABLÉ",   color: "#1e40af", bg: "#dbeafe", icon: "🏗️",  logo: "CS", hasStaticCatalog: true },
  claisse_rail: { label: "CLAISSE RAIL",   color: "#065f46", bg: "#d1fae5", icon: "🚂",  logo: "CR", hasStaticCatalog: false },
  stmf:         { label: "STMF",           color: "#7c3aed", bg: "#f3e8ff", icon: "⚙️",  logo: "ST", hasStaticCatalog: false },
};

const ROLES = {
  admin:                  { label: "Administrateur",          color: "#7c3aed", bg: "#f3e8ff", icon: "👑" },
  technicien:             { label: "Technicien",              color: "#1e40af", bg: "#dbeafe", icon: "🔧" },
  magasinier:             { label: "Magasinier",              color: "#0891b2", bg: "#e0f2fe", icon: "📦" },
  preparateur:            { label: "Préparateur chantier",    color: "#b45309", bg: "#fef3c7", icon: "🏗️" },
  magasinier_preparateur: { label: "Magasinier / Préparateur",color: "#0f766e", bg: "#ccfbf1", icon: "📦🏗️" },
  lecteur:                { label: "Lecteur",                 color: "#065f46", bg: "#d1fae5", icon: "👁" },
};

const NAV_ALL = [
  { id:"dashboard",    label:"Tableau de bord",      icon:"🏠", roles:["admin","technicien","magasinier","preparateur","magasinier_preparateur","lecteur"], sites:["clmtp_sable","claisse_rail","stmf"] },
  { id:"stock",        label:"Stocks",               icon:"📦", roles:["admin","technicien","magasinier","preparateur","magasinier_preparateur","lecteur"], sites:["clmtp_sable","claisse_rail","stmf"] },
  { id:"scanner",      label:"Scanner articles",     icon:"📷", roles:["admin","technicien","magasinier","preparateur","magasinier_preparateur","lecteur"], sites:["clmtp_sable","claisse_rail","stmf"] },
  { id:"barcodes",     label:"Codes-barres",         icon:"🔲", roles:["admin","magasinier","magasinier_preparateur"], sites:["clmtp_sable","claisse_rail","stmf"] },
  { id:"mouvements",   label:"Entrées / Sorties",    icon:"📥", roles:["admin","magasinier","magasinier_preparateur"], sites:["clmtp_sable","claisse_rail","stmf"] },
  { id:"ordres",       label:"Ordres de réparation", icon:"🔧", roles:["admin","technicien","magasinier","preparateur","magasinier_preparateur"], sites:["clmtp_sable","claisse_rail","stmf"] },
  { id:"location",     label:"Location matériel",    icon:"🔑", roles:["admin","technicien","magasinier","preparateur","magasinier_preparateur"], sites:["clmtp_sable","stmf"] },
  { id:"pret",         label:"Prêt matériels",       icon:"🤝", roles:["admin","technicien","magasinier","preparateur","magasinier_preparateur"], sites:["clmtp_sable","stmf"] },
  { id:"fifo",         label:"Lots FIFO",            icon:"🏷️", roles:["admin"], sites:["clmtp_sable","claisse_rail","stmf"] },
  { id:"prix",         label:"Gestion des prix",     icon:"💶", roles:["admin"], sites:["clmtp_sable","claisse_rail","stmf"] },
  { id:"equivalences", label:"Équivalences",         icon:"↔️", roles:["admin","technicien","magasinier","preparateur","magasinier_preparateur"], sites:["clmtp_sable","claisse_rail","stmf"] },
  { id:"catalogue",    label:"Catalogue articles",   icon:"📋", roles:["admin"], sites:["clmtp_sable","claisse_rail","stmf"] },
  { id:"utilisateurs", label:"Utilisateurs",         icon:"👥", roles:["admin"], sites:["clmtp_sable","claisse_rail","stmf"] },
  { id:"admin",        label:"Administration",        icon:"🛡️", roles:["admin"], sites:["clmtp_sable","claisse_rail","stmf"] },
];

// ── LOGIN PAGE ────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [siteId,setSiteId]=useState("clmtp_sable");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [showPwd,setShowPwd]=useState(false);
  const [step,setStep]=useState("site"); // "site" | "login"

  const site = SITES[siteId];

  const handleLogin = async () => {
    if(!email||!password){setError("Remplissez tous les champs.");return;}
    setLoading(true); setError("");
    const user = await loginUserMultiSite(email, password, siteId);
    if(user) {
      localStorage.setItem("wms_user", JSON.stringify(user));
      localStorage.setItem("wms_site", siteId);
      onLogin(user, siteId);
    } else {
      setError("Email ou mot de passe incorrect pour ce site.");
    }
    setLoading(false);
  };

  const handleKey = e => { if(e.key==="Enter") { if(step==="site") setStep("login"); else handleLogin(); } };

  return (
    <div style={{minHeight:"100vh",background:"#111827",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{width:"min(100%,440px)"}}>

        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:64,height:64,background:`linear-gradient(135deg,${site.color},${site.color}99)`,borderRadius:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,margin:"0 auto 16px",color:"#fff",fontWeight:900,letterSpacing:-0.5,transition:"all 0.3s"}}>
            {site.logo}
          </div>
          <div style={{color:"#fff",fontWeight:900,fontSize:24,letterSpacing:-0.5,transition:"all 0.3s"}}>{site.label}</div>
          <div style={{color:"#6b7280",fontSize:13,marginTop:4}}>Gestion d'entrepôt</div>
        </div>

        {/* Sélection site */}
        {step === "site" && (
          <div style={{background:"#fff",borderRadius:20,padding:28,boxShadow:"0 24px 64px rgba(0,0,0,0.4)"}}>
            <h2 style={{fontSize:16,fontWeight:800,color:"#111827",margin:"0 0 20px",textAlign:"center"}}>Choisissez votre site</h2>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
              {Object.entries(SITES).map(([id,s])=>(
                <button key={id} onClick={()=>setSiteId(id)} style={{
                  padding:"16px 18px", borderRadius:14, border:`2px solid ${siteId===id?s.color:"#e5e7eb"}`,
                  background:siteId===id?s.bg:"#fff", cursor:"pointer", display:"flex", alignItems:"center", gap:14,
                  textAlign:"left", transition:"all 0.15s", fontFamily:"'DM Sans',sans-serif",
                }}>
                  <div style={{width:42,height:42,background:siteId===id?s.color:"#f3f4f6",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,transition:"all 0.15s"}}>
                    {s.icon}
                  </div>
                  <div>
                    <div style={{fontWeight:800,fontSize:15,color:siteId===id?s.color:"#111827"}}>{s.label}</div>
                    <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>Accès sécurisé · Données séparées</div>
                  </div>
                  {siteId===id&&<div style={{marginLeft:"auto",color:s.color,fontSize:18}}>✓</div>}
                </button>
              ))}
            </div>
            <button onClick={()=>setStep("login")} style={{width:"100%",padding:"14px",background:site.color,color:"#fff",border:"none",borderRadius:12,fontWeight:800,fontSize:15,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
              Accéder à {site.label} →
            </button>
          </div>
        )}

        {/* Connexion */}
        {step === "login" && (
          <div style={{background:"#fff",borderRadius:20,padding:28,boxShadow:"0 24px 64px rgba(0,0,0,0.4)"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
              <button onClick={()=>setStep("site")} style={{background:"#f3f4f6",border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:14,color:"#6b7280"}}>←</button>
              <div>
                <div style={{fontWeight:800,fontSize:16,color:"#111827"}}>🔐 Connexion</div>
                <div style={{fontSize:12,color:site.color,fontWeight:600}}>{site.icon} {site.label}</div>
              </div>
            </div>

            {error&&<div style={{background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#991b1b",fontWeight:600,marginBottom:16}}>⚠️ {error}</div>}

            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:6}}>Adresse email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={handleKey}
                placeholder="votre@email.fr"
                style={{width:"100%",padding:"12px 14px",border:"1.5px solid #e5e7eb",borderRadius:10,fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"'DM Sans',sans-serif"}}/>
            </div>
            <div style={{marginBottom:20}}>
              <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:6}}>Mot de passe</label>
              <div style={{position:"relative"}}>
                <input type={showPwd?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={handleKey}
                  placeholder="••••••••"
                  style={{width:"100%",padding:"12px 44px 12px 14px",border:"1.5px solid #e5e7eb",borderRadius:10,fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"'DM Sans',sans-serif"}}/>
                <button onClick={()=>setShowPwd(s=>!s)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#9ca3af"}}>
                  {showPwd?"🙈":"👁"}
                </button>
              </div>
            </div>
            <button onClick={handleLogin} disabled={loading} style={{width:"100%",padding:"14px",background:loading?"#9ca3af":site.color,color:"#fff",border:"none",borderRadius:12,fontWeight:800,fontSize:15,cursor:loading?"not-allowed":"pointer",fontFamily:"'DM Sans',sans-serif"}}>
              {loading?"⏳ Connexion…":"Se connecter →"}
            </button>
          </div>
        )}

        <div style={{textAlign:"center",marginTop:16,color:"#4b5563",fontSize:11}}>
          WMS Multi-sites v4.0
        </div>
      </div>
    </div>
  );
}

// ── GESTION UTILISATEURS ──────────────────────────────────────────────────────
// Modules disponibles pour les permissions
const MODULES_PERMISSIONS = [
  { id:"dashboard",    label:"Tableau de bord",      icon:"🏠", desc:"KPIs, alertes, statistiques" },
  { id:"stock",        label:"Stocks",               icon:"📦", desc:"Consulter les références" },
  { id:"scanner",      label:"Scanner articles",     icon:"📷", desc:"Scanner codes-barres" },
  { id:"mouvements",   label:"Entrées / Sorties",    icon:"📥", desc:"Mouvements de stock" },
  { id:"ordres",       label:"Ordres de réparation", icon:"🔧", desc:"Créer et gérer les OR" },
  { id:"fifo",         label:"Lots FIFO",            icon:"🏷️", desc:"Gestion des lots d'achat" },
  { id:"prix",         label:"Gestion des prix",     icon:"💶", desc:"Prix fournisseurs, historique" },
  { id:"equivalences", label:"Équivalences",         icon:"↔️", desc:"Substituts en rupture" },
  { id:"catalogue",    label:"Catalogue articles",   icon:"📋", desc:"Import catalogue Excel" },
];

const DEFAULT_PERMISSIONS = {
  admin:                  null,
  technicien:             ["dashboard","stock","scanner","ordres","equivalences"],
  magasinier:             ["dashboard","stock","scanner","mouvements","ordres","equivalences"],
  preparateur:            ["dashboard","stock","scanner","ordres","location","pret","equivalences"],
  magasinier_preparateur: ["dashboard","stock","scanner","mouvements","ordres","location","pret","equivalences"],
  lecteur:                ["dashboard","stock","scanner"],
};

// ── BOUTON VOIR MOT DE PASSE (super admin uniquement) ────────────────────────
function ShowPasswordBtn({ pwd }) {
  const [show, setShow] = useState(false);
  if (!pwd) return <span style={{fontSize:11,color:"#9ca3af",fontStyle:"italic"}}>—</span>;
  return (
    <button
      onClick={()=>setShow(s=>!s)}
      style={{padding:"4px 10px",background:show?"#dbeafe":"#f3f4f6",border:`1px solid ${show?"#93c5fd":"#e5e7eb"}`,borderRadius:7,cursor:"pointer",fontSize:11,color:show?"#1e40af":"#6b7280",fontWeight:600,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
      {show ? pwd : "👁 Voir"}
    </button>
  );
}

function GestionUtilisateurs({ currentUser, siteId }) {
  const [users,setUsers]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showForm,setShowForm]=useState(false);
  const [showPerms,setShowPerms]=useState(null); // utilisateur dont on édite les perms
  const [editUser,setEditUser]=useState(null);
  const [saving,setSaving]=useState(false);
  const [showPwd,setShowPwd]=useState(false);
  const [form,setForm]=useState({nom:"",prenom:"",email:"",motDePasse:"",role:"technicien",site:siteId});
  const [customPerms,setCustomPerms]=useState([]);

  const site = SITES[siteId] || SITES.clmtp_sable;

  useEffect(()=>{
    // Admin voit tous les utilisateurs de tous les sites
    getUtilisateurs().then(async data=>{
      // Charger les permissions depuis la table user_permissions
      const { data: permsData } = await supabase
        .from('user_permissions')
        .select('user_id, modules');
      const permsMap = {};
      (permsData||[]).forEach(p => { permsMap[p.user_id] = p.modules; });
      // Fusionner permissions avec utilisateurs
      const usersWithPerms = data.map(u => ({
        ...u,
        permissions: permsMap[u.id] || u.permissions || null
      }));
      setUsers(usersWithPerms);
      setLoading(false);
    });
  },[]);

  const openAdd = () => {
    setEditUser(null);
    setForm({nom:"",prenom:"",email:"",motDePasse:"",role:"technicien",site:siteId});
    setShowForm(true);
  };

  const openEdit = u => {
    setEditUser(u);
    setForm({nom:u.nom,prenom:u.prenom,email:u.email,motDePasse:"",role:u.role,site:u.site_id||siteId});
    setShowForm(true);
  };

  const openPerms = u => {
    setShowPerms(u);
    // Charger les permissions actuelles ou les permissions par défaut du rôle
    const perms = u.permissions || DEFAULT_PERMISSIONS[u.role] || MODULES_PERMISSIONS.map(m=>m.id);
    setCustomPerms(perms || MODULES_PERMISSIONS.map(m=>m.id));
  };

  const togglePerm = async (moduleId) => {
    const newPerms = customPerms.includes(moduleId)
      ? customPerms.filter(p => p !== moduleId)
      : [...customPerms, moduleId];
    setCustomPerms(newPerms);
    const ok = await savePermissions(showPerms.id, newPerms);
    if (ok) {
      setUsers(prev => prev.map(u =>
        u.id === showPerms.id ? {...u, permissions: newPerms} : u
      ));
      try {
        const cu = JSON.parse(localStorage.getItem("wms_user"));
        if(cu && String(cu.id) === String(showPerms.id)) {
          localStorage.setItem("wms_user", JSON.stringify({...cu, permissions: newPerms}));
        }
      } catch(e) {}
    } else {
      alert('Erreur sauvegarde permissions');
    }
  };

  const handleSavePerms = async () => {
    setSaving(true);
    const ok = await savePermissions(showPerms.id, customPerms);
    if (ok) {
      setUsers(prev => prev.map(u => u.id === showPerms.id ? {...u, permissions: customPerms} : u));
      try {
        const cu = JSON.parse(localStorage.getItem("wms_user"));
        if(cu && String(cu.id) === String(showPerms.id)) {
          localStorage.setItem("wms_user", JSON.stringify({...cu, permissions: customPerms}));
        }
      } catch(e) {}
      setShowPerms(null);
    } else {
      alert('Erreur lors de la sauvegarde');
    }
    setSaving(false);
  };

  const handleResetPerms = async () => {
    const defaultPerms = DEFAULT_PERMISSIONS[showPerms.role];
    setCustomPerms(defaultPerms || MODULES_PERMISSIONS.map(m=>m.id));
    setSaving(true);
    if (defaultPerms === null) {
      await deletePermissions(showPerms.id);
      setUsers(prev=>prev.map(u=>u.id===showPerms.id?{...u,permissions:null}:u));
    } else {
      await savePermissions(showPerms.id, defaultPerms);
      setUsers(prev=>prev.map(u=>u.id===showPerms.id?{...u,permissions:defaultPerms}:u));
    }
    setSaving(false);
  };

  const handleSave = async () => {
    if(!form.nom||!form.prenom||!form.email) return;
    setSaving(true);
    if(editUser) {
      const upd = {nom:form.nom,prenom:form.prenom,email:form.email,role:form.role,site_id:form.site};
      if(form.motDePasse) upd.mot_de_passe=form.motDePasse;
      await updateUtilisateur(editUser.id, upd);
      setUsers(prev=>prev.map(u=>u.id===editUser.id?{...u,...upd}:u));
    } else {
      if(!form.motDePasse){setSaving(false);return;}
      const saved = await createUtilisateurSite(form, form.site);
      if(saved) setUsers(prev=>[saved,...prev]);
    }
    setShowForm(false); setSaving(false);
  };

  const handleToggle = async (u) => {
    if(u.id===currentUser.id){alert("Impossible de désactiver votre propre compte.");return;}
    await updateUtilisateur(u.id,{actif:!u.actif});
    setUsers(prev=>prev.map(x=>x.id===u.id?{...x,actif:!x.actif}:x));
  };

  const handleDelete = async (u) => {
    if(u.id===currentUser.id){alert("Impossible de supprimer votre propre compte.");return;}
    if(!confirm(`Supprimer ${u.prenom} ${u.nom} ?`)) return;
    await deleteUtilisateur(u.id);
    setUsers(prev=>prev.filter(x=>x.id!==u.id));
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:900,color:"#111827",margin:0}}>Gestion des utilisateurs</h1>
          <p style={{color:"#6b7280",fontSize:13,margin:"4px 0 0"}}>{site.icon} <span style={{color:site.color,fontWeight:700}}>{site.label}</span> · {users.length} compte{users.length!==1?"s":""}</p>
        </div>
        <button onClick={openAdd} style={{background:"#111827",color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",fontWeight:700,cursor:"pointer",fontSize:13}}>+ Nouvel utilisateur</button>
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:12}}>
        {Object.entries(ROLES).map(([role,conf])=>(
          <div key={role} style={{background:"#fff",borderRadius:14,padding:"16px 18px",border:"1px solid #e5e7eb"}}>
            <div style={{fontSize:22,marginBottom:6}}>{conf.icon}</div>
            <div style={{fontSize:22,fontWeight:900,color:conf.color}}>{users.filter(u=>u.role===role&&u.actif).length}</div>
            <div style={{fontSize:12,color:"#6b7280",marginTop:3}}>{conf.label}s</div>
          </div>
        ))}
        <div style={{background:"#fff",borderRadius:14,padding:"16px 18px",border:"1px solid #e5e7eb"}}>
          <div style={{fontSize:22,marginBottom:6}}>🔴</div>
          <div style={{fontSize:22,fontWeight:900,color:"#dc2626"}}>{users.filter(u=>!u.actif).length}</div>
          <div style={{fontSize:12,color:"#6b7280",marginTop:3}}>Inactifs</div>
        </div>
      </div>

      {/* Table */}
      <div style={{background:"#fff",borderRadius:16,border:"1px solid #e5e7eb",overflow:"hidden"}}>
        {loading ? <Spinner/> : users.length===0 ? (
          <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>
            <div style={{fontSize:36,marginBottom:10}}>👥</div>
            <div style={{fontWeight:700,color:"#374151"}}>Aucun utilisateur sur ce site</div>
          </div>
        ) : (
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:"#111827"}}>
              {["Utilisateur","Email","Site","Rôle","Accès","Statut","Dernière connexion","Actions"].map(h=>(
                <th key={h} style={{padding:"11px 14px",textAlign:"left",fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:0.5,whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {users.map((u,i)=>{
                const role=ROLES[u.role]||ROLES.lecteur;
                const isMe=u.id===currentUser.id;
                const hasCustomPerms=u.permissions&&Array.isArray(u.permissions);
                const nbAcces=hasCustomPerms?u.permissions.length:(DEFAULT_PERMISSIONS[u.role]||[]).length;
                return (
                  <tr key={u.id} style={{borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                    <td style={{padding:"12px 14px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:36,height:36,background:`linear-gradient(135deg,${role.color}cc,${role.color})`,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:14,flexShrink:0}}>
                          {u.prenom?.[0]?.toUpperCase()}{u.nom?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div style={{fontWeight:700,fontSize:13,color:"#111827"}}>{u.prenom} {u.nom} {isMe&&<span style={{fontSize:10,background:"#dbeafe",color:"#1e40af",padding:"1px 6px",borderRadius:99,fontWeight:700}}>vous</span>}</div>
                          <div style={{fontSize:11,color:"#9ca3af",marginTop:1}}>ID #{u.id}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{padding:"12px 14px",fontSize:13,color:"#374151"}}>{u.email}</td>
                    <td style={{padding:"12px 14px"}}>
                      {SITES[u.site_id]&&<span style={{background:SITES[u.site_id].bg,color:SITES[u.site_id].color,padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{SITES[u.site_id].icon} {SITES[u.site_id].label}</span>}
                    </td>
                    <td style={{padding:"12px 14px"}}>
                      <span style={{background:role.bg,color:role.color,padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:700}}>{role.icon} {role.label}</span>
                    </td>
                    <td style={{padding:"12px 14px"}}>
                      <button onClick={()=>openPerms(u)} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",background:hasCustomPerms?"#f3e8ff":"#f3f4f6",border:`1px solid ${hasCustomPerms?"#7c3aed":"#e5e7eb"}`,borderRadius:8,cursor:"pointer",fontSize:11,fontWeight:600,color:hasCustomPerms?"#7c3aed":"#374151"}}>
                        🔑 {u.role==="admin"?"Tous":`${nbAcces} module${nbAcces>1?"s":""}`}
                        {hasCustomPerms&&<span style={{background:"#7c3aed",color:"#fff",fontSize:9,padding:"1px 5px",borderRadius:99}}>Perso</span>}
                      </button>
                    </td>
                    <td style={{padding:"12px 14px"}}>
                      <span style={{background:u.actif?"#d1fae5":"#f3f4f6",color:u.actif?"#065f46":"#9ca3af",padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:700}}>
                        {u.actif?"🟢 Actif":"⚫ Inactif"}
                      </span>
                    </td>
                    <td style={{padding:"12px 14px",fontSize:12,color:"#6b7280"}}>
                      {u.derniere_connexion ? new Date(u.derniere_connexion).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "Jamais"}
                    </td>
                    <td style={{padding:"12px 14px"}}>
                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        <button onClick={()=>openEdit(u)} style={{padding:"5px 11px",background:"#f3f4f6",border:"none",borderRadius:7,cursor:"pointer",fontSize:12,fontWeight:600}}>✏️</button>
                        {currentUser?.email==="deepak.ramguttee@gmail.com"&&<ShowPasswordBtn pwd={u.mot_de_passe}/>}
                        <button onClick={()=>handleToggle(u)} disabled={isMe} style={{padding:"5px 11px",background:u.actif?"#fef3c7":"#d1fae5",border:"none",borderRadius:7,cursor:isMe?"not-allowed":"pointer",fontSize:12,fontWeight:600,color:u.actif?"#92400e":"#065f46"}}>
                          {u.actif?"🔒":"🔓"}
                        </button>
                        <button onClick={()=>handleDelete(u)} disabled={isMe} style={{padding:"5px 10px",background:isMe?"#f3f4f6":"#fee2e2",border:"none",borderRadius:7,cursor:isMe?"not-allowed":"pointer",fontSize:12,color:isMe?"#9ca3af":"#dc2626"}}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Panneau Permissions INLINE */}
      {showPerms&&(
        <div style={{background:"#fff",borderRadius:16,border:"2px solid #7c3aed",padding:24,marginTop:8}}>
          <div style={{background:"#fff",borderRadius:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <div>
                <h2 style={{fontSize:17,fontWeight:800,color:"#111827",margin:0}}>🔑 Accès personnalisés</h2>
                <div style={{fontSize:13,color:"#6b7280",marginTop:3}}>{showPerms.prenom} {showPerms.nom} · <span style={{color:ROLES[showPerms.role]?.color}}>{ROLES[showPerms.role]?.icon} {ROLES[showPerms.role]?.label}</span></div>
              </div>
              <button onClick={()=>setShowPerms(null)} style={{background:"#f3f4f6",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:15}}>✕</button>
            </div>

            <div style={{background:"#f0f9ff",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#0369a1"}}>
              💡 Cochez les modules auxquels cet utilisateur aura accès. Les modifications s'appliquent immédiatement à sa prochaine connexion.
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>
              {MODULES_PERMISSIONS.map(mod=>{
                const isChecked = customPerms.includes(mod.id);
                return (
                  <label key={mod.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:10,border:`2px solid ${isChecked?"#7c3aed":"#e5e7eb"}`,background:isChecked?"#f3e8ff":"#f9fafb",cursor:"pointer",userSelect:"none"}}>
                    <input type="checkbox" checked={isChecked} onChange={()=>togglePerm(mod.id)} style={{width:18,height:18,accentColor:"#7c3aed",cursor:"pointer",flexShrink:0}}/>
                    <span style={{fontSize:18}}>{mod.icon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:13,color:isChecked?"#6b21a8":"#374151"}}>{mod.label}</div>
                      <div style={{fontSize:10,color:"#9ca3af"}}>{mod.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <button onClick={()=>setCustomPerms(MODULES_PERMISSIONS.map(m=>m.id))} style={{flex:1,padding:"9px",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:9,cursor:"pointer",fontWeight:600,fontSize:12,color:"#065f46"}}>✅ Tout cocher</button>
              <button onClick={()=>setCustomPerms([])} style={{flex:1,padding:"9px",background:"#fff1f2",border:"1px solid #fecaca",borderRadius:9,cursor:"pointer",fontWeight:600,fontSize:12,color:"#dc2626"}}>❌ Tout décocher</button>
              <button onClick={handleResetPerms} style={{flex:1,padding:"9px",background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:9,cursor:"pointer",fontWeight:600,fontSize:12,color:"#374151"}}>🔄 Par défaut</button>
            </div>
            <div style={{display:"flex",gap:10,marginTop:4,alignItems:"center"}}>
              <button onClick={()=>setShowPerms(null)} style={{flex:1,padding:"12px",background:"#f3f4f6",border:"none",borderRadius:10,fontWeight:600,cursor:"pointer",fontSize:13}}>✕ Fermer</button>
              <div style={{flex:2,padding:"12px",background:"#d1fae5",color:"#065f46",borderRadius:10,fontWeight:700,fontSize:12,textAlign:"center"}}>
                ✅ Auto-sauvegarde active · {customPerms.length} module{customPerms.length!==1?"s":""}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Créer/Modifier utilisateur */}
      {showForm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,backdropFilter:"blur(2px)"}}>
          <div style={{background:"#fff",borderRadius:20,padding:30,width:"min(96vw,460px)",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
              <h2 style={{fontSize:17,fontWeight:800,color:"#111827",margin:0}}>{editUser?"✏️ Modifier":"➕ Nouvel"} utilisateur</h2>
              <button onClick={()=>setShowForm(false)} style={{background:"#f3f4f6",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:15}}>✕</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:13}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {[{l:"Prénom *",k:"prenom",ph:"Jean"},{l:"Nom *",k:"nom",ph:"DUPONT"}].map(f=>(
                  <div key={f.k}>
                    <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>{f.l}</label>
                    <input value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph}
                      style={{width:"100%",padding:"10px 13px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                  </div>
                ))}
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>Email *</label>
                <input type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} placeholder="jean.dupont@email.fr"
                  style={{width:"100%",padding:"10px 13px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>{editUser?"Nouveau mot de passe":"Mot de passe *"}</label>
                <div style={{position:"relative"}}>
                  <input type={showPwd?"text":"password"} value={form.motDePasse} onChange={e=>setForm(p=>({...p,motDePasse:e.target.value}))} placeholder="••••••••"
                    style={{width:"100%",padding:"10px 40px 10px 13px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                  <button onClick={()=>setShowPwd(s=>!s)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:15,color:"#9ca3af"}}>{showPwd?"🙈":"👁"}</button>
                </div>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:8}}>Site *</label>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {Object.entries(SITES).map(([id,s])=>(
                    <button key={id} onClick={()=>setForm(p=>({...p,site:id}))} style={{padding:"12px 16px",borderRadius:12,border:`2px solid ${form.site===id?s.color:"#e5e7eb"}`,background:form.site===id?s.bg:"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:12,textAlign:"left",fontFamily:"'DM Sans',sans-serif"}}>
                      <span style={{fontSize:22}}>{s.icon}</span>
                      <div>
                        <div style={{fontWeight:700,fontSize:14,color:form.site===id?s.color:"#111827"}}>{s.label}</div>
                      </div>
                      {form.site===id&&<div style={{marginLeft:"auto",color:s.color,fontSize:16}}>✓</div>}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:8}}>Rôle</label>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {Object.entries(ROLES).map(([role,conf])=>(
                    <button key={role} onClick={()=>setForm(p=>({...p,role}))} style={{padding:"10px 8px",borderRadius:10,border:`2px solid ${form.role===role?conf.color:"#e5e7eb"}`,background:form.role===role?conf.bg:"#fff",color:form.role===role?conf.color:"#6b7280",fontWeight:600,cursor:"pointer",fontSize:12,textAlign:"center"}}>
                      <div style={{fontSize:18,marginBottom:3}}>{conf.icon}</div>
                      <div>{conf.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{padding:"10px 14px",background:"#f9fafb",borderRadius:10,fontSize:12,color:"#6b7280"}}>
                <strong>Accès par défaut :</strong> {form.role==="admin"?"Tous les modules":
                 form.role==="technicien"?"Stocks, Scanner, OR, Équivalences":
                 form.role==="magasinier"?"Stocks, Scanner, Entrées/Sorties, OR, Équivalences":
                 form.role==="preparateur"?"Stocks, Scanner, OR, Location, Prêt, Équivalences":
                 form.role==="magasinier_preparateur"?"Stocks, Scanner, Entrées/Sorties, OR, Location, Prêt, Équivalences":
                 "Tableau de bord, Stocks, Scanner"}
                 <br/><span style={{color:"#3b82f6"}}>💡 Vous pourrez personnaliser les accès après création.</span>
              </div>
              <div style={{display:"flex",gap:10,marginTop:4}}>
                <button onClick={()=>setShowForm(false)} style={{flex:1,padding:"12px",background:"#f3f4f6",border:"none",borderRadius:10,fontWeight:600,cursor:"pointer"}}>Annuler</button>
                <button onClick={handleSave} disabled={saving||!form.nom||!form.prenom||!form.email} style={{flex:2,padding:"12px",background:form.nom&&form.prenom&&form.email?"#111827":"#e5e7eb",color:form.nom&&form.prenom&&form.email?"#fff":"#9ca3af",border:"none",borderRadius:10,fontWeight:700,cursor:"pointer",fontSize:14}}>
                  {saving?"⏳…":editUser?"💾 Modifier":"➕ Créer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CHANGER MOT DE PASSE ──────────────────────────────────────────────────────
function ChangerMotDePasse({ user, onClose, onSuccess }) {
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmer, setConfirmer] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showActuel, setShowActuel] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleSave = async () => {
    setError("");
    if (actuel !== user.mot_de_passe) { setError("Mot de passe actuel incorrect."); return; }
    if (nouveau.length < 6) { setError("Le nouveau mot de passe doit faire au moins 6 caractères."); return; }
    if (nouveau !== confirmer) { setError("Les mots de passe ne correspondent pas."); return; }
    setSaving(true);
    const { error: err } = await supabase
      .from('utilisateurs')
      .update({ mot_de_passe: nouveau })
      .eq('id', user.id);
    setSaving(false);
    if (err) { setError("Erreur lors de la sauvegarde."); return; }
    onSuccess(nouveau);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:16}}>
      <div style={{background:"#fff",borderRadius:20,padding:28,width:"min(96vw,420px)",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h2 style={{fontSize:16,fontWeight:800,color:"#111827",margin:0}}>🔒 Changer mon mot de passe</h2>
          <button onClick={onClose} style={{background:"#f3f4f6",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:15}}>✕</button>
        </div>

        {[
          {l:"Mot de passe actuel",v:actuel,set:setActuel,show:showActuel,toggleShow:()=>setShowActuel(s=>!s)},
          {l:"Nouveau mot de passe",v:nouveau,set:setNouveau,show:showNew,toggleShow:()=>setShowNew(s=>!s)},
          {l:"Confirmer le nouveau",v:confirmer,set:setConfirmer,show:showNew,toggleShow:()=>setShowNew(s=>!s)},
        ].map((f,i)=>(
          <div key={i} style={{marginBottom:14}}>
            <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>{f.l}</label>
            <div style={{position:"relative"}}>
              <input type={f.show?"text":"password"} value={f.v} onChange={e=>f.set(e.target.value)}
                style={{width:"100%",padding:"10px 40px 10px 14px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
              <button onClick={f.toggleShow} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:15,color:"#6b7280"}}>{f.show?"🙈":"👁"}</button>
            </div>
          </div>
        ))}

        {error&&<div style={{background:"#fee2e2",color:"#dc2626",padding:"10px 14px",borderRadius:9,fontSize:13,marginBottom:14,fontWeight:600}}>⚠️ {error}</div>}

        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:"12px",background:"#f3f4f6",border:"none",borderRadius:10,fontWeight:600,cursor:"pointer"}}>Annuler</button>
          <button onClick={handleSave} disabled={saving||!actuel||!nouveau||!confirmer} style={{flex:2,padding:"12px",background:saving||!actuel||!nouveau||!confirmer?"#e5e7eb":"#111827",color:saving||!actuel||!nouveau||!confirmer?"#9ca3af":"#fff",border:"none",borderRadius:10,fontWeight:700,cursor:"pointer",fontSize:14}}>
            {saving?"⏳ Sauvegarde…":"💾 Changer le mot de passe"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("wms_user")); } catch { return null; }
  });
  const [siteId, setSiteId] = useState(() => localStorage.getItem("wms_site") || "clmtp_sable");
  const [page,setPage]=useState("dashboard");
  const [sidebar,setSidebar]=useState(true);
  const [loading,setLoading]=useState(true);
  const [showChangePwd,setShowChangePwd]=useState(false);
  const [mouvements,setMouvements]=useState([]);
  const [stockOverrides,setStockOverrides]=useState({});
  const [ordres,setOrdres]=useState([]);
  const [equivalences,setEquivalences]=useState({});
  const [prixFournisseurs,setPrixFournisseurs]=useState([]);
  const [historiquePrix,setHistoriquePrix]=useState([]);
  const [catalogue,setCatalogue]=useState([]);
  const [customArticles,setCustomArticles]=useState([]);
  const [autoOpenNewArticle,setAutoOpenNewArticle]=useState(null); // pré-remplir form Stock
  const [locations,setLocations]=useState([]);
  const [prets,setPrets]=useState([]);
  const [showInstall, setShowInstall] = useState(false);

  // PWA Install prompt
  useEffect(() => {
    const check = () => {
      if (window.__pwaInstallPrompt) setShowInstall(true);
    };
    check();
    const t = setInterval(check, 2000);
    return () => clearInterval(t);
  }, []);

  const handleInstall = async () => {
    if (!window.__pwaInstallPrompt) return;
    window.__pwaInstallPrompt.prompt();
    const { outcome } = await window.__pwaInstallPrompt.userChoice;
    if (outcome === 'accepted') { window.__pwaInstallPrompt = null; setShowInstall(false); }
  };

  const site = SITES[siteId] || SITES.clmtp_sable;
  // Pour CLMTP SABLÉ, utiliser le catalogue statique, sinon le catalogue dynamique
  // Produits statiques du site (pour Stock — customArticles ajoutés séparément)
  const PRODUCTS = siteId === "clmtp_sable" ? ALL_PRODUCTS : catalogue;
  // Tous les produits du site (pour recherche dans Entrées/Sorties, Scanner, etc.)
  const ALL_SITE_PRODUCTS = siteId === "clmtp_sable"
    ? [...ALL_PRODUCTS, ...(customArticles||[])]
    : catalogue;

  const handleLogin = (u, sid) => { setUser(u); setSiteId(sid); };
  const handleLogout = () => {
    localStorage.removeItem("wms_user");
    localStorage.removeItem("wms_site");
    setUser(null); setSiteId("clmtp_sable");
    setMouvements([]); setOrdres([]); setStockOverrides({});
    setLocations([]); setPrets([]); setCustomArticles([]);
  };

  // Rafraîchir les permissions de l'utilisateur connecté au démarrage
  useEffect(() => {
    if (!user) return;
    getPermissions(user.id).then(modules => {
      if (modules !== null && JSON.stringify(modules) !== JSON.stringify(user.permissions)) {
        const updated = { ...user, permissions: modules };
        setUser(updated);
        localStorage.setItem("wms_user", JSON.stringify(updated));
      }
    }).catch(() => {});
  }, []);

  useEffect(()=>{
    if(!user) return;
    async function loadAll(){
      setLoading(true);
      const [movs,stock,ords,eqs,prix,histPrix]=await Promise.all([
        getMouvementsSite(siteId),
        getStockOverridesSite(siteId),
        getOrdresSite(siteId),
        getEquivalences(),
        getPrixFournisseurs(),
        getHistoriquePrix(),
      ]);
      setMouvements(movs);
      setStockOverrides(stock);
      setOrdres(ords);
      setEquivalences(eqs);
      setPrixFournisseurs(prix);
      setHistoriquePrix(histPrix);
      // Charger articles custom pour CLMTP SABLÉ
      if(siteId === "clmtp_sable") {
        const custom = await getCatalogue(siteId);
        setCustomArticles(custom);
      }
      // Charger locations et prêts si site autorisé
      if(["clmtp_sable","stmf"].includes(siteId)) {
        const [locs, ps] = await Promise.all([getLocations(siteId), getPrets(siteId)]);
        setLocations(locs);
        setPrets(ps);
      }
      // Charger catalogue dynamique si pas CLMTP SABLÉ
      if(siteId !== "clmtp_sable") {
        const cat = await getCatalogue(siteId);
        setCatalogue(cat);
      }
      setLoading(false);
    }
    loadAll();
  },[user, siteId]);

  if(!user) return <LoginPage onLogin={handleLogin}/>;

  const NAV = NAV_ALL.filter(n => {
    if (!n.sites.includes(siteId)) return false;
    if(user.permissions && Array.isArray(user.permissions) && user.permissions.length > 0) {
      // Admin voit toujours tous les modules de son site
      if(user.role === "admin") return n.roles.includes("admin");
      return user.permissions.includes(n.id);
    }
    return n.roles.includes(user.role);
  });
  const orEnCours=ordres.filter(o=>o.statut!=="termine"&&o.statut!=="annule").length;
  const mouvJour=mouvements.filter(m=>new Date(m.created_at||m.date).toDateString()===new Date().toDateString()).length;

  const renderPage=()=>{
    if(loading) return <Spinner/>;
    if(page==="dashboard") return <Dashboard stockOverrides={stockOverrides} mouvements={mouvements} ordres={ordres} products={ALL_SITE_PRODUCTS} user={user} navigateTo={setPage}/>;
    if(page==="stock")     return <Stock stockOverrides={stockOverrides} setStockOverrides={setStockOverrides} products={PRODUCTS} siteId={siteId} user={user} customArticles={customArticles} setCustomArticles={setCustomArticles} autoOpenNewArticle={autoOpenNewArticle} setAutoOpenNewArticle={setAutoOpenNewArticle}/>;
    if(page==="mouvements") return <EntreesSorties mouvements={mouvements.filter(m=>!m.site_id||m.site_id===siteId)} setMouvements={setMouvements} stockOverrides={stockOverrides} setStockOverrides={setStockOverrides} siteId={siteId} products={ALL_SITE_PRODUCTS} user={user} navigateTo={setPage} setAutoOpenNewArticle={setAutoOpenNewArticle}/>;
    if(page==="ordres")    return <OrdresReparation ordres={ordres.filter(o=>!o.site_id||o.site_id===siteId)} setOrdres={setOrdres} mouvements={mouvements} setMouvements={setMouvements} stockOverrides={stockOverrides} setStockOverrides={setStockOverrides} siteId={siteId} products={ALL_SITE_PRODUCTS} user={user}/>;
    if(page==="prix")      return <GestionPrix prixFournisseurs={prixFournisseurs} setPrixFournisseurs={setPrixFournisseurs} historiquePrix={historiquePrix} setHistoriquePrix={setHistoriquePrix} products={ALL_SITE_PRODUCTS}/>;
    if(page==="fifo")      return <GestionFIFO products={ALL_SITE_PRODUCTS}/>;
    if(page==="equivalences") return <Equivalences equivalences={equivalences} setEquivalences={setEquivalences} products={ALL_SITE_PRODUCTS}/>;
    if(page==="utilisateurs") return <GestionUtilisateurs currentUser={user} siteId={siteId}/>;
    if(page==="scanner")   return <ScannerArticles products={ALL_SITE_PRODUCTS} stockOverrides={stockOverrides} setStockOverrides={setStockOverrides} mouvements={mouvements} setMouvements={setMouvements} siteId={siteId}/>;
    if(page==="barcodes")  return <GenerateurCodebarres products={PRODUCTS} stockOverrides={stockOverrides}/>;
    if(page==="location")  return <LocationMateriel locations={locations} setLocations={setLocations} siteId={siteId} products={ALL_SITE_PRODUCTS}/>;
    if(page==="pret")      return <PretMateriel prets={prets} setPrets={setPrets} siteId={siteId} products={ALL_SITE_PRODUCTS}/>;
    if(page==="catalogue") return <GestionCatalogue siteId={siteId} catalogue={catalogue} setCatalogue={setCatalogue}/>;
    if(page==="admin")     return <AdminDashboard user={user} navigateTo={setPage}/>;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'DM Sans',sans-serif;background:#f1f5f9;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes scanline{0%,100%{top:10%}50%{top:90%}}
        @keyframes slideIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px;}

        /* MOBILE RESPONSIVE */
        @media(max-width:768px){
          .desktop-sidebar{display:none!important;}
          .mobile-header{display:flex!important;}
          .mobile-bottom-nav{display:flex!important;}
          .main-content{padding:12px!important;padding-bottom:80px!important;}
          .sidebar-overlay{display:block!important;}
        }
        @media(min-width:769px){
          .mobile-header{display:none!important;}
          .mobile-bottom-nav{display:none!important;}
          .sidebar-overlay{display:none!important;}
        }
        .mobile-header{display:none;}
        .mobile-bottom-nav{display:none;}
        .sidebar-overlay{display:none;}

        /* Touch targets */
        button{-webkit-tap-highlight-color:transparent;}
        input,select,textarea{font-size:16px!important;}
        @media(max-width:768px){
          input,select,textarea{font-size:16px!important;}
        }
      `}</style>

      {/* MOBILE HEADER */}
      <div className="mobile-header" style={{position:"fixed",top:0,left:0,right:0,zIndex:200,background:"#111827",padding:"12px 16px",alignItems:"center",justifyContent:"space-between",height:56}}>
        <button onClick={()=>setSidebar(s=>!s)} style={{background:"none",border:"none",color:"#fff",cursor:"pointer",fontSize:22,padding:"4px",display:"flex",alignItems:"center"}}>☰</button>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:28,height:28,background:`linear-gradient(135deg,${site.color},${site.color}99)`,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff",fontWeight:900}}>{site.logo}</div>
          <span style={{color:"#fff",fontWeight:800,fontSize:14}}>{site.label}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {showInstall&&<button onClick={handleInstall} style={{background:"#3b82f6",border:"none",borderRadius:7,color:"#fff",padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇️ Installer</button>}
          <div style={{width:28,height:28,background:`linear-gradient(135deg,${ROLES[user.role]?.color||"#f59e0b"},${ROLES[user.role]?.color||"#d97706"})`,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#fff",fontSize:12}}>
            {user.prenom?.[0]}{user.nom?.[0]}
          </div>
        </div>
      </div>

      {/* SIDEBAR OVERLAY (mobile) */}
      {sidebar && (
        <div className="sidebar-overlay" onClick={()=>setSidebar(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:300}}/>
      )}

      <div style={{display:"flex",height:"100vh",overflow:"hidden"}}>
        {/* SIDEBAR DESKTOP + MOBILE DRAWER */}
        <div className="desktop-sidebar" style={{width:sidebar?230:60,flexShrink:0,background:"#111827",display:"flex",flexDirection:"column",transition:"width 0.25s ease",overflow:"hidden"}}>
          <div style={{padding:sidebar?"22px 18px 18px":"22px 10px 18px",borderBottom:"1px solid rgba(255,255,255,.08)",display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,background:`linear-gradient(135deg,${site.color},${site.color}99)`,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,flexShrink:0,color:"#fff",fontWeight:900,letterSpacing:-0.5}}>{site.logo}</div>
            {sidebar&&<div><div style={{color:"#fff",fontWeight:900,fontSize:13}}>{site.label}</div><div style={{color:"#6b7280",fontSize:10}}>Multi-utilisateurs 🔄</div></div>}
          </div>
          <nav style={{flex:1,padding:"10px 8px",display:"flex",flexDirection:"column",gap:3,overflowY:"auto"}}>
            {NAV.map(item=>{
              const active=page===item.id;
              const badge=item.id==="ordres"&&orEnCours>0?orEnCours:item.id==="mouvements"&&mouvJour>0?mouvJour:0;
              return (
                <button key={item.id} onClick={()=>setPage(item.id)} title={!sidebar?item.label:""} style={{display:"flex",alignItems:"center",gap:10,padding:sidebar?"10px 12px":"10px",borderRadius:9,border:"none",cursor:"pointer",background:active?"rgba(59,130,246,.15)":"transparent",color:active?"#60a5fa":"#9ca3af",fontWeight:active?700:500,fontSize:13,textAlign:"left",width:"100%",borderLeft:active?"3px solid #3b82f6":"3px solid transparent"}}>
                  <span style={{fontSize:17,flexShrink:0}}>{item.icon}</span>
                  {sidebar&&item.label}
                  {sidebar&&badge>0&&<span style={{marginLeft:"auto",background:item.id==="ordres"?"#7c3aed":"#f59e0b",color:"#fff",borderRadius:99,padding:"1px 7px",fontSize:10,fontWeight:700}}>{badge}</span>}
                </button>
              );
            })}
          </nav>
          <div style={{borderTop:"1px solid rgba(255,255,255,.08)",padding:"10px 8px"}}>
            <button onClick={()=>setSidebar(s=>!s)} style={{width:"100%",padding:"9px",background:"rgba(255,255,255,.05)",border:"none",borderRadius:9,color:"#9ca3af",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:sidebar?"flex-end":"center",gap:6}}>
              {sidebar&&<span style={{fontSize:11}}>Réduire</span>}<span>{sidebar?"◀":"▶"}</span>
            </button>
            {sidebar&&(
              <div style={{marginTop:8,padding:"10px 12px",background:"rgba(255,255,255,.05)",borderRadius:9}}>
                <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:8}}>
                  <div style={{width:32,height:32,background:`linear-gradient(135deg,${ROLES[user.role]?.color||"#f59e0b"},${ROLES[user.role]?.color||"#d97706"})`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#fff",fontSize:13,flexShrink:0}}>
                    {user.prenom?.[0]}{user.nom?.[0]}
                  </div>
                  <div style={{overflow:"hidden"}}>
                    <div style={{color:"#e5e7eb",fontSize:12,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.prenom} {user.nom}</div>
                    <div style={{fontSize:10,marginTop:1}}>
                      <span style={{background:ROLES[user.role]?.bg,color:ROLES[user.role]?.color,padding:"1px 6px",borderRadius:99,fontWeight:700}}>{ROLES[user.role]?.icon} {ROLES[user.role]?.label}</span>
                    </div>
                  </div>
                </div>
                <button onClick={()=>setShowChangePwd(true)} style={{width:"100%",padding:"7px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:"#9ca3af",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"'DM Sans',sans-serif",marginBottom:6}}>
                  🔒 Changer mot de passe
                </button>
                <button onClick={handleLogout} style={{width:"100%",padding:"7px",background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,color:"#fca5a5",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"'DM Sans',sans-serif"}}>
                  🚪 Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>

        {/* MOBILE DRAWER */}
        {sidebar && (
          <div className="sidebar-overlay" style={{position:"fixed",top:0,left:0,bottom:0,width:280,background:"#111827",zIndex:400,display:"flex",flexDirection:"column",animation:"slideIn 0.25s ease",overflowY:"auto"}}>
            <div style={{padding:"16px 18px",borderBottom:"1px solid rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:36,height:36,background:`linear-gradient(135deg,${site.color},${site.color}99)`,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#fff",fontWeight:900}}>{site.logo}</div>
                <div><div style={{color:"#fff",fontWeight:900,fontSize:14}}>{site.label}</div><div style={{color:"#6b7280",fontSize:11}}>Multi-utilisateurs</div></div>
              </div>
              <button onClick={()=>setSidebar(false)} style={{background:"rgba(255,255,255,.1)",border:"none",borderRadius:8,color:"#fff",cursor:"pointer",fontSize:18,padding:"4px 10px"}}>✕</button>
            </div>
            <nav style={{flex:1,padding:"12px 10px",display:"flex",flexDirection:"column",gap:4}}>
              {NAV.map(item=>{
                const active=page===item.id;
                const badge=item.id==="ordres"&&orEnCours>0?orEnCours:item.id==="mouvements"&&mouvJour>0?mouvJour:0;
                return (
                  <button key={item.id} onClick={()=>{setPage(item.id);setSidebar(false);}} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:12,border:"none",cursor:"pointer",background:active?"rgba(59,130,246,.2)":"transparent",color:active?"#60a5fa":"#9ca3af",fontWeight:active?700:500,fontSize:15,textAlign:"left",width:"100%"}}>
                    <span style={{fontSize:20}}>{item.icon}</span>
                    <span style={{flex:1}}>{item.label}</span>
                    {badge>0&&<span style={{background:item.id==="ordres"?"#7c3aed":"#f59e0b",color:"#fff",borderRadius:99,padding:"2px 8px",fontSize:11,fontWeight:700}}>{badge}</span>}
                  </button>
                );
              })}
            </nav>
            <div style={{padding:"12px 10px",borderTop:"1px solid rgba(255,255,255,.08)"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px",background:"rgba(255,255,255,.05)",borderRadius:12,marginBottom:8}}>
                <div style={{width:38,height:38,background:`linear-gradient(135deg,${ROLES[user.role]?.color||"#f59e0b"},${ROLES[user.role]?.color||"#d97706"})`,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#fff",fontSize:14,flexShrink:0}}>
                  {user.prenom?.[0]}{user.nom?.[0]}
                </div>
                <div>
                  <div style={{color:"#e5e7eb",fontSize:13,fontWeight:700}}>{user.prenom} {user.nom}</div>
                  <span style={{background:ROLES[user.role]?.bg,color:ROLES[user.role]?.color,padding:"2px 8px",borderRadius:99,fontWeight:700,fontSize:11}}>{ROLES[user.role]?.icon} {ROLES[user.role]?.label}</span>
                </div>
              </div>
              <button onClick={handleLogout} style={{width:"100%",padding:"12px",background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:10,color:"#fca5a5",cursor:"pointer",fontSize:14,fontWeight:600,fontFamily:"'DM Sans',sans-serif"}}>
                🚪 Déconnexion
              </button>
            </div>
          </div>
        )}

        {/* MAIN CONTENT */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div className="main-content" style={{flex:1,overflowY:"auto",padding:"24px",marginTop:0}} id="main-scroll">
            {/* Spacer pour mobile header */}
            <div className="mobile-header" style={{height:56,display:"block"}}/>
            {renderPage()}
          </div>
        </div>
      </div>

      {/* BOTTOM NAV (mobile uniquement) */}
      <div className="mobile-bottom-nav" style={{position:"fixed",bottom:0,left:0,right:0,background:"#111827",borderTop:"1px solid rgba(255,255,255,.1)",zIndex:200,padding:"6px 4px",paddingBottom:"env(safe-area-inset-bottom,6px)",alignItems:"center",justifyContent:"space-around"}}>
        {NAV.slice(0,5).map(item=>{
          const active=page===item.id;
          const badge=item.id==="ordres"&&orEnCours>0?orEnCours:item.id==="mouvements"&&mouvJour>0?mouvJour:0;
          return (
            <button key={item.id} onClick={()=>setPage(item.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"6px 8px",background:"none",border:"none",cursor:"pointer",color:active?"#60a5fa":"#6b7280",minWidth:52,position:"relative"}}>
              <span style={{fontSize:22}}>{item.icon}</span>
              <span style={{fontSize:9,fontWeight:active?700:500,letterSpacing:0.2}}>{item.label.split(" ")[0]}</span>
              {badge>0&&<span style={{position:"absolute",top:2,right:4,background:"#f59e0b",color:"#fff",borderRadius:99,padding:"0px 5px",fontSize:9,fontWeight:700}}>{badge}</span>}
              {active&&<div style={{position:"absolute",bottom:-6,left:"50%",transform:"translateX(-50%)",width:20,height:3,background:"#3b82f6",borderRadius:99}}/>}
            </button>
          );
        })}
        <button onClick={()=>setSidebar(s=>!s)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"6px 8px",background:"none",border:"none",cursor:"pointer",color:"#6b7280",minWidth:52}}>
          <span style={{fontSize:22}}>⋯</span>
          <span style={{fontSize:9,fontWeight:500}}>Plus</span>
        </button>
      </div>

      {/* Modal Changer mot de passe */}
      {showChangePwd&&<ChangerMotDePasse user={user} onClose={()=>setShowChangePwd(false)} onSuccess={pwd=>{
        const updated={...user,mot_de_passe:pwd};
        setUser(updated);
        localStorage.setItem("wms_user",JSON.stringify(updated));
        setShowChangePwd(false);
        alert("✅ Mot de passe modifié avec succès !");
      }}/>}
    </>
  );
}
