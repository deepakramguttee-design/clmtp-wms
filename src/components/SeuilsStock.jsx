import { useState } from "react"
import { setSeuilOverrideSite } from "../db.js"

const PAGE_SIZE = 50

const STATUT_CFG = {
  ok:       { bg:"#d1fae5", text:"#065f46", label:"OK" },
  critique: { bg:"#fef3c7", text:"#d97706", label:"Critique" },
  rupture:  { bg:"#fee2e2", text:"#dc2626", label:"Rupture" },
}

export default function SeuilsStock({ products, stockOverrides, equivalences, seuilsOverrides, setSeuilsOverrides, siteId }) {
  const [search, setSearch]           = useState("")
  const [filterStatut, setFilterStatut] = useState("tous")
  const [filterEquiv, setFilterEquiv]   = useState("tous")
  const [editing, setEditing]           = useState(null)
  const [editVal, setEditVal]           = useState("")
  const [page, setPage]                 = useState(1)
  const [saving, setSaving]             = useState(null)

  const getStock        = p => stockOverrides[p.id] !== undefined ? stockOverrides[p.id] : (p.stock ?? 0)
  const getSeuilMin     = p => seuilsOverrides[p.id]?.seuil_min ?? p.min ?? 0
  const getSeuilMinEquiv= p => seuilsOverrides[p.id]?.seuil_min_equivalence ?? 0
  const hasEquiv        = p => !!(equivalences[p.id]?.length)

  const getStatut = p => {
    const stock = getStock(p)
    if (stock === 0) return "rupture"
    const sm  = getSeuilMin(p)
    const sme = getSeuilMinEquiv(p)
    if (sm > 0 && stock < sm) {
      if (hasEquiv(p) && sme > 0 && stock >= sme) return "ok"
      return "critique"
    }
    return "ok"
  }

  const enriched = products.map(p => ({
    ...p,
    _stock:        getStock(p),
    _seuilMin:     getSeuilMin(p),
    _seuilMinEquiv:getSeuilMinEquiv(p),
    _hasEquiv:     hasEquiv(p),
    _statut:       getStatut(p),
  }))

  const filtered = enriched.filter(p => {
    if (filterStatut !== "tous" && p._statut !== filterStatut) return false
    if (filterEquiv === "avec" && !p._hasEquiv) return false
    if (filterEquiv === "sans" && p._hasEquiv) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(p.name||"").toLowerCase().includes(q) && !(p.id||"").toLowerCase().includes(q)) return false
    }
    return true
  })

  const paginated = filtered.slice(0, page * PAGE_SIZE)

  const startEdit = (p, field) => {
    setEditing({ id: p.id, field })
    setEditVal(String(field === "seuil_min" ? p._seuilMin : p._seuilMinEquiv))
  }

  const saveEdit = async p => {
    const val   = parseInt(editVal) || 0
    const field = editing.field
    const seuilMin  = field === "seuil_min" ? val : p._seuilMin
    const seuilEquiv= field === "seuil_min_equivalence" ? val : p._seuilMinEquiv
    setSaving(p.id)
    await setSeuilOverrideSite(p.id, siteId, seuilMin, seuilEquiv)
    setSeuilsOverrides(prev => ({
      ...prev,
      [p.id]: { seuil_min: seuilMin, seuil_min_equivalence: seuilEquiv }
    }))
    setSaving(null)
    setEditing(null)
  }

  const cancelEdit = () => setEditing(null)

  const stats = {
    ok:       enriched.filter(p => p._statut === "ok").length,
    critique: enriched.filter(p => p._statut === "critique").length,
    rupture:  enriched.filter(p => p._statut === "rupture").length,
    avecEquiv:enriched.filter(p => p._hasEquiv).length,
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div>
        <h1 style={{fontSize:22,fontWeight:900,color:"#1a1a1a",margin:0}}>Seuils critiques</h1>
        <p style={{color:"#6b7280",fontSize:13,margin:"4px 0 0"}}>{products.length} références · Cliquez sur un seuil pour le modifier en ligne</p>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:12}}>
        {[
          {label:"OK",               value:stats.ok,        icon:"✅", color:"#059669"},
          {label:"Critique",         value:stats.critique,  icon:"⚠️", color:"#d97706"},
          {label:"Rupture",          value:stats.rupture,   icon:"🔴", color:"#dc2626"},
          {label:"Avec équivalence", value:stats.avecEquiv, icon:"↔️", color:"#1e40af"},
        ].map((k,i) => (
          <div key={i} style={{background:"#fff",borderRadius:14,padding:"14px 16px",border:"1px solid #e0e0d8"}}>
            <div style={{fontSize:20,marginBottom:6}}>{k.icon}</div>
            <div style={{fontSize:22,fontWeight:900,color:k.color,lineHeight:1}}>{k.value}</div>
            <div style={{fontSize:11,color:"#6b7280",marginTop:4}}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{background:"#fff",borderRadius:14,padding:"12px 16px",border:"1px solid #e0e0d8",display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
        <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}
          placeholder="🔍 Référence ou désignation…"
          style={{padding:"8px 12px",border:"1px solid #e0e0d8",borderRadius:9,fontSize:13,outline:"none",minWidth:220}}/>
        <select value={filterStatut} onChange={e=>{setFilterStatut(e.target.value);setPage(1)}}
          style={{padding:"8px 12px",border:"1px solid #e0e0d8",borderRadius:9,fontSize:13,outline:"none",background:"#fff"}}>
          <option value="tous">Tous les statuts</option>
          <option value="ok">✅ OK</option>
          <option value="critique">⚠️ Critique</option>
          <option value="rupture">🔴 Rupture</option>
        </select>
        <select value={filterEquiv} onChange={e=>{setFilterEquiv(e.target.value);setPage(1)}}
          style={{padding:"8px 12px",border:"1px solid #e0e0d8",borderRadius:9,fontSize:13,outline:"none",background:"#fff"}}>
          <option value="tous">Toutes les réfs</option>
          <option value="avec">↔️ Avec équivalence</option>
          <option value="sans">Sans équivalence</option>
        </select>
        {(search || filterStatut !== "tous" || filterEquiv !== "tous") && (
          <button onClick={()=>{setSearch("");setFilterStatut("tous");setFilterEquiv("tous");setPage(1)}}
            style={{padding:"8px 12px",background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:9,cursor:"pointer",fontSize:12,fontWeight:600}}>
            ✕ Effacer
          </button>
        )}
        <span style={{color:"#6b7280",fontSize:12,marginLeft:"auto"}}>{filtered.length} résultats</span>
      </div>

      <div style={{background:"#fff",borderRadius:14,border:"1px solid #e0e0d8",overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr style={{background:"#f9fafb",borderBottom:"1px solid #e0e0d8"}}>
                {["Référence","Désignation","Stock actuel","Seuil min","Seuil min (équiv.)","Équivalence","Statut"].map(h => (
                  <th key={h} style={{padding:"10px 12px",textAlign:"left",fontWeight:700,color:"#374151",fontSize:11,whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0
                ? <tr><td colSpan={7} style={{padding:32,textAlign:"center",color:"#6b7280"}}>Aucune référence trouvée</td></tr>
                : paginated.map((p, i) => {
                  const s          = STATUT_CFG[p._statut]
                  const isEditMin  = editing?.id === p.id && editing?.field === "seuil_min"
                  const isEditEquiv= editing?.id === p.id && editing?.field === "seuil_min_equivalence"
                  const isSaving   = saving === p.id
                  return (
                    <tr key={p.id} style={{borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                      <td style={{padding:"9px 12px",fontWeight:700,color:"#1e2330",fontFamily:"monospace",fontSize:11}}>{p.id||p.sku||"—"}</td>
                      <td style={{padding:"9px 12px",maxWidth:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={p.name||""}>{p.name||"—"}</td>
                      <td style={{padding:"9px 12px",textAlign:"center",fontWeight:700,fontSize:14,
                        color:p._stock===0?"#dc2626":p._stock<p._seuilMin?"#d97706":"#059669"}}>{p._stock}</td>
                      <td style={{padding:"9px 12px",textAlign:"center"}}>
                        {isEditMin
                          ? <input autoFocus type="number" min="0" value={editVal}
                              onChange={e=>setEditVal(e.target.value)}
                              onBlur={()=>saveEdit(p)}
                              onKeyDown={e=>e.key==="Enter"?saveEdit(p):e.key==="Escape"&&cancelEdit()}
                              style={{width:70,padding:"4px 8px",border:"2px solid #1e2330",borderRadius:7,fontSize:13,outline:"none",textAlign:"center"}}/>
                          : <button onClick={()=>startEdit(p,"seuil_min")} disabled={isSaving}
                              style={{padding:"4px 12px",background:"#f3f4f6",border:"1px dashed #d1d5db",borderRadius:7,cursor:"pointer",fontSize:12,fontWeight:700,minWidth:50}}>
                              {isSaving?"⏳":(p._seuilMin||"—")}
                            </button>
                        }
                      </td>
                      <td style={{padding:"9px 12px",textAlign:"center"}}>
                        {p._hasEquiv
                          ? isEditEquiv
                            ? <input autoFocus type="number" min="0" value={editVal}
                                onChange={e=>setEditVal(e.target.value)}
                                onBlur={()=>saveEdit(p)}
                                onKeyDown={e=>e.key==="Enter"?saveEdit(p):e.key==="Escape"&&cancelEdit()}
                                style={{width:70,padding:"4px 8px",border:"2px solid #1e2330",borderRadius:7,fontSize:13,outline:"none",textAlign:"center"}}/>
                            : <button onClick={()=>startEdit(p,"seuil_min_equivalence")} disabled={isSaving}
                                style={{padding:"4px 12px",background:"#eff6ff",border:"1px dashed #93c5fd",borderRadius:7,cursor:"pointer",fontSize:12,fontWeight:700,minWidth:50}}>
                                {isSaving?"⏳":(p._seuilMinEquiv||"—")}
                              </button>
                          : <span style={{color:"#d1d5db",fontSize:12}}>N/A</span>
                        }
                      </td>
                      <td style={{padding:"9px 12px"}}>
                        {p._hasEquiv
                          ? <span style={{background:"#dbeafe",color:"#1e40af",padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700}}>↔️ Équivalence</span>
                          : <span style={{color:"#d1d5db",fontSize:11}}>—</span>
                        }
                      </td>
                      <td style={{padding:"9px 12px"}}>
                        <span style={{background:s.bg,color:s.text,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700}}>{s.label}</span>
                      </td>
                    </tr>
                  )
                })
              }
            </tbody>
          </table>
        </div>
        {filtered.length > paginated.length && (
          <div style={{padding:"14px 20px",borderTop:"1px solid #f3f4f6",textAlign:"center"}}>
            <button onClick={()=>setPage(p=>p+1)}
              style={{padding:"9px 24px",background:"#f3f4f6",border:"none",borderRadius:9,cursor:"pointer",fontSize:13,fontWeight:600,color:"#1a1a1a"}}>
              Voir plus ({filtered.length - paginated.length} restants)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
