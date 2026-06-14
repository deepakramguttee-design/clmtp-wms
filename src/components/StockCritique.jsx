import { useState } from "react"
import { getNextBCNumero, createBonCommande, saveBonCommandeLignes, syncDDVFournisseurs } from "../db.js"

const SITE_LABELS = { clmtp_sable:"CLMTP Sablé", claisse_rail:"Claisse Rail", stmf:"STMF" }
const S_CFG = {
  rupture: { bg:"#fee2e2", text:"#dc2626", label:"Rupture" },
  critique:{ bg:"#fef3c7", text:"#d97706", label:"Critique" },
}

export default function StockCritique({ products, stockOverrides, equivalences, seuilsOverrides, fournisseurs, siteId, user, navigateTo, pageTitle="🚨 Stock critique", pageSubtitle }) {
  const [selected, setSelected]     = useState(new Set())
  const [filterType, setFilterType] = useState("tous")
  const [modal, setModal]           = useState(false)
  const [lines, setLines]           = useState([])
  const [selFourns, setSelFourns]   = useState(new Set())
  const [creating, setCreating]     = useState(false)

  const getStock = p => stockOverrides[p.id] !== undefined ? stockOverrides[p.id] : (p.stock ?? 0)
  const getSM    = p => seuilsOverrides[p.id]?.seuil_min ?? p.min ?? 0
  const getSME   = p => seuilsOverrides[p.id]?.seuil_min_equivalence ?? 0
  const hasEquiv = p => !!(equivalences[p.id]?.length)

  const getStatut = p => {
    const s=getStock(p), sm=getSM(p)
    if (sm === 0) return "ok"
    if (s === 0) return "rupture"
    if (s < sm) { if(hasEquiv(p)&&getSME(p)>0&&s>=getSME(p)) return "ok"; return "critique" }
    return "ok"
  }

  const all = products
    .map(p => ({ ...p, _s:getStock(p), _sm:getSM(p), _sme:getSME(p), _hE:hasEquiv(p), _st:getStatut(p) }))
    .filter(p => p._st==="rupture" || p._st==="critique")
    .sort((a,b) => a._s - b._s)

  const visible = filterType==="tous" ? all : all.filter(p=>p._st===filterType)

  const toggle    = id => setSelected(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n })
  const selectAll = () => setSelected(new Set(visible.map(p=>p.id)))
  const deselectAll = () => setSelected(new Set())

  const selectedItems = all.filter(p=>selected.has(p.id))
  const selectedCount = selectedItems.length

  const openModal = () => {
    setLines(selectedItems.map(p => ({
      id:p.id, reference:p.id, designation:p.name||p.id,
      quantite:String(Math.max(1,(p._sm||0)-p._s)),
      prix_unitaire:"0",
    })))
    setSelFourns(new Set())
    setModal(true)
  }

  const handleCreate = async () => {
    if (!selFourns.size) { alert("Sélectionnez au moins un fournisseur."); return }
    const lignes = lines.map(l=>({...l,quantite:parseFloat(l.quantite)||1,prix_unitaire:parseFloat(l.prix_unitaire)||0}))
    setCreating(true)
    const fourns = fournisseurs.filter(f=>selFourns.has(f.id))
    const numero = await getNextBCNumero(siteId)
    const bc = await createBonCommande({
      numero, site:siteId, statut:"brouillon",
      fournisseur_id:fourns[0]?.id||null,
      fournisseur_nom:fourns[0]?.nom||'',
      created_by:`${user.prenom||''} ${user.nom||''}`.trim(),
    })
    if (!bc) { alert("Erreur lors de la création de la DDV."); setCreating(false); return }
    await saveBonCommandeLignes(bc.id, lignes)
    if (fourns.length > 1) {
      await syncDDVFournisseurs(bc.id, fourns.map(f=>({ fournisseur_id:f.id, fournisseur_nom:f.nom, email:f.email||'' })))
    }
    setCreating(false)
    setModal(false)
    setSelected(new Set())
    navigateTo("bons_commande")
  }

  const rupCount = all.filter(p=>p._st==="rupture").length
  const critCount= all.filter(p=>p._st==="critique").length

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:900,color:"#1a1a1a",margin:0}}>{pageTitle}</h1>
          <p style={{color:"#6b7280",fontSize:13,margin:"4px 0 0"}}>
            {pageSubtitle?<>{pageSubtitle} · </>:null}
            {all.length} référence{all.length!==1?"s":""} en alerte
            {selectedCount>0&&<> · <strong style={{color:"#1e2330"}}>{selectedCount} sélectionnée{selectedCount!==1?"s":""}</strong></>}
          </p>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={visible.length>0&&visible.every(p=>selected.has(p.id))?deselectAll:selectAll}
            style={{padding:"9px 16px",background:"#f3f4f6",border:"none",borderRadius:9,cursor:"pointer",fontSize:13,fontWeight:600,color:"#374151"}}>
            {visible.length>0&&visible.every(p=>selected.has(p.id))?"☑ Tout désélectionner":"☐ Tout sélectionner"}
          </button>
          <button onClick={openModal} disabled={selectedCount===0}
            style={{padding:"9px 20px",background:selectedCount>0?"#dc2626":"#9ca3af",color:"#fff",border:"none",
              borderRadius:9,cursor:selectedCount>0?"pointer":"not-allowed",fontSize:13,fontWeight:700}}>
            📄 Créer une DDV ({selectedCount})
          </button>
        </div>
      </div>

      {/* Filtres statut */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        {[
          {key:"tous",    label:"Tout",     count:all.length,     color:"#374151", bg:"#374151"},
          {key:"rupture", label:"Rupture",  count:rupCount,       color:"#dc2626", bg:"#dc2626"},
          {key:"critique",label:"Critique", count:critCount,      color:"#d97706", bg:"#d97706"},
        ].map(f=>(
          <button key={f.key} onClick={()=>setFilterType(f.key)}
            style={{padding:"7px 14px",border:"none",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:700,
              background:filterType===f.key?f.bg:"#f3f4f6",
              color:filterType===f.key?"#fff":f.color}}>
            {f.label} · {f.count}
          </button>
        ))}
        <span style={{padding:"6px 12px",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:20,fontSize:11,color:"#1e40af",fontWeight:700}}>
          🏢 {SITE_LABELS[siteId]||siteId}
        </span>
        <span style={{color:"#9ca3af",fontSize:12,marginLeft:"auto"}}>{visible.length} affichées</span>
      </div>

      {/* Table */}
      {visible.length === 0
        ? <div style={{background:"#fff",borderRadius:14,padding:48,border:"1px solid #e0e0d8",textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:12}}>✅</div>
            <div style={{fontWeight:700,fontSize:16,color:"#1a1a1a",marginBottom:6}}>Aucun article en alerte</div>
            <div style={{color:"#6b7280",fontSize:13}}>Tous les stocks respectent leurs seuils critiques.</div>
          </div>
        : <div style={{background:"#fff",borderRadius:14,border:"1px solid #e0e0d8",overflow:"hidden"}}>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead>
                  <tr style={{background:"#f9fafb",borderBottom:"1px solid #e0e0d8"}}>
                    <th style={{padding:"10px 12px",width:36}}>
                      <input type="checkbox"
                        checked={visible.length>0&&visible.every(p=>selected.has(p.id))}
                        onChange={e=>e.target.checked?selectAll():deselectAll()}
                        style={{cursor:"pointer",width:15,height:15}}/>
                    </th>
                    {["Référence","Désignation","Site","Stock actuel","Seuil min","Manque","Équivalence","Statut"].map(h=>(
                      <th key={h} style={{padding:"10px 12px",textAlign:"left",fontWeight:700,color:"#374151",fontSize:11,whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p,i) => {
                    const sc    = S_CFG[p._st]
                    const manque= Math.max(0, p._sm - p._s)
                    const isSel = selected.has(p.id)
                    return (
                      <tr key={p.id} onClick={()=>toggle(p.id)}
                        style={{borderBottom:"1px solid #f3f4f6",background:isSel?"#eff6ff":i%2===0?"#fff":"#fafafa",cursor:"pointer"}}>
                        <td style={{padding:"9px 12px"}} onClick={e=>e.stopPropagation()}>
                          <input type="checkbox" checked={isSel} onChange={()=>toggle(p.id)} style={{cursor:"pointer",width:15,height:15}}/>
                        </td>
                        <td style={{padding:"9px 12px",fontWeight:700,color:"#1e2330",fontFamily:"monospace",fontSize:11}}>{p.id||"—"}</td>
                        <td style={{padding:"9px 12px",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={p.name||""}>{p.name||"—"}</td>
                        <td style={{padding:"9px 12px",color:"#6b7280",fontSize:11}}>{SITE_LABELS[siteId]||siteId}</td>
                        <td style={{padding:"9px 12px",textAlign:"center",fontWeight:900,fontSize:15,color:p._s===0?"#dc2626":"#d97706"}}>{p._s}</td>
                        <td style={{padding:"9px 12px",textAlign:"center",color:"#6b7280"}}>{p._sm||"—"}</td>
                        <td style={{padding:"9px 12px",textAlign:"center"}}>
                          {manque>0
                            ? <span style={{background:"#fee2e2",color:"#dc2626",padding:"2px 9px",borderRadius:20,fontWeight:700,fontSize:12}}>−{manque}</span>
                            : <span style={{color:"#9ca3af"}}>0</span>}
                        </td>
                        <td style={{padding:"9px 12px"}}>
                          {p._hE
                            ? <span style={{background:"#dbeafe",color:"#1e40af",padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700}}>↔️ Oui</span>
                            : <span style={{color:"#d1d5db",fontSize:11}}>—</span>}
                        </td>
                        <td style={{padding:"9px 12px"}}>
                          <span style={{background:sc.bg,color:sc.text,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700}}>{sc.label}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
      }

      {/* MODAL DDV */}
      {modal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"24px 16px",overflowY:"auto"}}>
          <div style={{background:"#fff",borderRadius:16,padding:28,width:"100%",maxWidth:660,boxShadow:"0 20px 60px rgba(0,0,0,0.25)",marginBottom:32}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h2 style={{margin:0,fontSize:18,fontWeight:800}}>📄 Créer une Demande de devis</h2>
              <button onClick={()=>setModal(false)} style={{background:"none",border:"none",fontSize:24,cursor:"pointer",color:"#6b7280",lineHeight:1}}>×</button>
            </div>

            {/* Fournisseurs */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:12,fontWeight:700,color:"#374151",marginBottom:8}}>Fournisseurs destinataires *</div>
              {fournisseurs.filter(f=>f.actif!==false).length===0
                ? <div style={{color:"#9ca3af",fontSize:13,padding:"12px 0"}}>Aucun fournisseur actif. Créez-en depuis la section Achats.</div>
                : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:6,maxHeight:150,overflowY:"auto",border:"1px solid #e0e0d8",borderRadius:9,padding:"10px 14px"}}>
                    {fournisseurs.filter(f=>f.actif!==false).map(f=>(
                      <label key={f.id} style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",padding:"3px 0"}}>
                        <input type="checkbox" checked={selFourns.has(f.id)}
                          onChange={()=>setSelFourns(prev=>{const n=new Set(prev);n.has(f.id)?n.delete(f.id):n.add(f.id);return n})}
                          style={{width:14,height:14,cursor:"pointer",flexShrink:0}}/>
                        <span style={{fontSize:13,fontWeight:600,color:"#1a1a1a"}}>{f.nom}</span>
                        {f.email&&<span style={{fontSize:10,color:"#9ca3af",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.email}</span>}
                      </label>
                    ))}
                  </div>
              }
            </div>

            {/* Lignes articles */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:12,fontWeight:700,color:"#374151",marginBottom:8}}>Articles sélectionnés ({lines.length})</div>
              <div style={{border:"1px solid #e0e0d8",borderRadius:9,overflow:"hidden",maxHeight:280,overflowY:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead style={{position:"sticky",top:0,zIndex:1}}>
                    <tr style={{background:"#f9fafb",borderBottom:"1px solid #e0e0d8"}}>
                      {["Référence","Désignation","Qté suggérée","Prix unit. (€)"].map(h=>(
                        <th key={h} style={{padding:"8px 10px",textAlign:"left",fontWeight:700,color:"#374151",fontSize:11,whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l,i)=>(
                      <tr key={l.id} style={{borderBottom:"1px solid #f3f4f6"}}>
                        <td style={{padding:"7px 10px",fontFamily:"monospace",fontSize:11,color:"#1e2330",fontWeight:700}}>{l.reference}</td>
                        <td style={{padding:"7px 10px",maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"#374151"}} title={l.designation}>{l.designation}</td>
                        <td style={{padding:"7px 10px"}}>
                          <input type="number" min="1" value={l.quantite}
                            onChange={e=>setLines(prev=>prev.map((x,j)=>j===i?{...x,quantite:e.target.value}:x))}
                            style={{width:72,padding:"5px 8px",border:"1px solid #e0e0d8",borderRadius:7,fontSize:12,outline:"none",textAlign:"center"}}/>
                        </td>
                        <td style={{padding:"7px 10px"}}>
                          <input type="number" min="0" step="0.01" value={l.prix_unitaire}
                            onChange={e=>setLines(prev=>prev.map((x,j)=>j===i?{...x,prix_unitaire:e.target.value}:x))}
                            style={{width:80,padding:"5px 8px",border:"1px solid #e0e0d8",borderRadius:7,fontSize:12,outline:"none",textAlign:"center"}}/>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>setModal(false)}
                style={{padding:"10px 20px",background:"#f3f4f6",border:"none",borderRadius:9,cursor:"pointer",fontSize:13,fontWeight:600}}>
                Annuler
              </button>
              <button onClick={handleCreate} disabled={creating||selFourns.size===0}
                style={{padding:"10px 24px",background:selFourns.size>0&&!creating?"#1e2330":"#9ca3af",color:"#fff",border:"none",
                  borderRadius:9,cursor:selFourns.size>0&&!creating?"pointer":"not-allowed",fontSize:13,fontWeight:700}}>
                {creating?"⏳ Création en cours…":"📄 Créer la DDV"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
