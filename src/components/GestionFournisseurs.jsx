import { useState, useEffect } from "react"
import { getAllFournisseurs, createFournisseur, updateFournisseur, deleteFournisseur } from "../db.js"

const EMPTY = { nom:"", email:"", telephone:"", adresse:"", notes:"" }

const FIELDS = [
  { key:"nom",       label:"Nom *",     placeholder:"Nom du fournisseur",  type:"text"  },
  { key:"email",     label:"Email",     placeholder:"contact@exemple.fr",  type:"email" },
  { key:"telephone", label:"Téléphone", placeholder:"01 23 45 67 89",      type:"text"  },
  { key:"adresse",   label:"Adresse",   placeholder:"12 rue…",             type:"text"  },
]

export default function GestionFournisseurs({ onRefresh }) {
  const [fournisseurs, setFournisseurs] = useState([])
  const [loading, setLoading]           = useState(true)
  const [modal, setModal]               = useState(null)
  const [form, setForm]                 = useState(EMPTY)
  const [saving, setSaving]             = useState(false)
  const [search, setSearch]             = useState("")

  useEffect(() => { load() }, [])

  const load = () => {
    setLoading(true)
    getAllFournisseurs().then(d => { setFournisseurs(d); setLoading(false) })
  }

  const openNew  = () => { setForm(EMPTY); setModal({ mode:"new" }) }
  const openEdit = (f) => {
    setForm({ nom:f.nom, email:f.email||"", telephone:f.telephone||"", adresse:f.adresse||"", notes:f.notes||"" })
    setModal({ mode:"edit", id:f.id })
  }

  const handleSave = async () => {
    if (!form.nom.trim()) { alert("Le nom est obligatoire."); return }
    setSaving(true)
    if (modal.mode === "new") {
      const created = await createFournisseur(form)
      if (created) setFournisseurs(prev => [...prev, created].sort((a,b)=>a.nom.localeCompare(b.nom)))
    } else {
      await updateFournisseur(modal.id, { nom:form.nom, email:form.email, telephone:form.telephone, adresse:form.adresse, notes:form.notes })
      setFournisseurs(prev => prev.map(f => f.id===modal.id ? {...f,...form} : f))
    }
    setSaving(false)
    setModal(null)
    onRefresh?.()
  }

  const handleToggle = async (f) => {
    await updateFournisseur(f.id, { actif: !f.actif })
    setFournisseurs(prev => prev.map(x => x.id===f.id ? {...x, actif:!x.actif} : x))
    onRefresh?.()
  }

  const handleDelete = async (f) => {
    if (!confirm(`Supprimer « ${f.nom} » définitivement ?`)) return
    await deleteFournisseur(f.id)
    setFournisseurs(prev => prev.filter(x => x.id!==f.id))
    onRefresh?.()
  }

  const filtered = fournisseurs.filter(f =>
    !search ||
    f.nom.toLowerCase().includes(search.toLowerCase()) ||
    (f.email||"").toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    total:  fournisseurs.length,
    actifs: fournisseurs.filter(f=>f.actif).length,
    email:  fournisseurs.filter(f=>f.email).length,
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>

      {/* En-tête */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:900,color:"#1a1a1a",margin:0}}>Fournisseurs</h1>
          <p style={{color:"#6b7280",fontSize:13,margin:"4px 0 0"}}>{stats.total} fournisseur{stats.total!==1?"s":""}</p>
        </div>
        <button onClick={openNew} style={{background:"#1e2330",color:"#fff",border:"none",borderRadius:10,padding:"11px 20px",fontWeight:700,cursor:"pointer",fontSize:14}}>
          + Nouveau fournisseur
        </button>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:12}}>
        {[
          {label:"Total",    value:stats.total,  icon:"🏭", color:"#1a1a1a"},
          {label:"Actifs",   value:stats.actifs, icon:"✅", color:"#059669"},
          {label:"Avec email",value:stats.email, icon:"📧", color:"#1e40af"},
        ].map((k,i)=>(
          <div key={i} style={{background:"#fff",borderRadius:14,padding:"14px 16px",border:"1px solid #e0e0d8"}}>
            <div style={{fontSize:20,marginBottom:6}}>{k.icon}</div>
            <div style={{fontSize:22,fontWeight:900,color:k.color,lineHeight:1}}>{k.value}</div>
            <div style={{fontSize:11,color:"#6b7280",marginTop:4}}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Recherche */}
      <div style={{background:"#fff",borderRadius:14,padding:"12px 16px",border:"1px solid #e0e0d8"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Rechercher par nom ou email…"
          style={{padding:"8px 12px",border:"1px solid #e0e0d8",borderRadius:9,fontSize:13,outline:"none",minWidth:280}}/>
        {search && (
          <button onClick={()=>setSearch("")} style={{marginLeft:8,padding:"8px 12px",background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:9,cursor:"pointer",fontSize:12,fontWeight:600}}>✕ Effacer</button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{textAlign:"center",padding:40,color:"#6b7280"}}>Chargement…</div>
      ) : filtered.length === 0 ? (
        <div style={{background:"#fff",borderRadius:14,padding:40,border:"1px solid #e0e0d8",textAlign:"center",color:"#6b7280"}}>
          <div style={{fontSize:40,marginBottom:12}}>🏭</div>
          <div style={{fontWeight:700,fontSize:16,marginBottom:6}}>{fournisseurs.length===0?"Aucun fournisseur":"Aucun résultat"}</div>
          <div style={{fontSize:13}}>{fournisseurs.length===0?"Ajoutez votre premier fournisseur":"Modifiez les filtres de recherche"}</div>
        </div>
      ) : (
        <div style={{background:"#fff",borderRadius:14,border:"1px solid #e0e0d8",overflow:"hidden"}}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{background:"#f9fafb",borderBottom:"1px solid #e0e0d8"}}>
                  {["Nom","Email","Téléphone","Adresse","Notes","Actif","Actions"].map(h=>(
                    <th key={h} style={{padding:"11px 14px",textAlign:"left",fontWeight:700,color:"#374151",fontSize:11,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((f,i) => (
                  <tr key={f.id} style={{borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa",opacity:f.actif?1:0.55}}>
                    <td style={{padding:"10px 14px",fontWeight:700,color:"#1e2330"}}>{f.nom}</td>
                    <td style={{padding:"10px 14px"}}>
                      {f.email
                        ? <a href={`mailto:${f.email}`} style={{color:"#1e40af",textDecoration:"none",fontSize:12}}>{f.email}</a>
                        : <span style={{color:"#9ca3af",fontSize:12}}>—</span>}
                    </td>
                    <td style={{padding:"10px 14px",color:"#6b7280"}}>{f.telephone||"—"}</td>
                    <td style={{padding:"10px 14px",color:"#6b7280",maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={f.adresse||""}>{f.adresse||"—"}</td>
                    <td style={{padding:"10px 14px",color:"#6b7280",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={f.notes||""}>{f.notes||"—"}</td>
                    <td style={{padding:"10px 14px"}}>
                      <button onClick={()=>handleToggle(f)}
                        style={{background:f.actif?"#d1fae5":"#f3f4f6",color:f.actif?"#065f46":"#6b7280",border:"none",borderRadius:20,padding:"4px 12px",cursor:"pointer",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>
                        {f.actif?"✓ Actif":"Inactif"}
                      </button>
                    </td>
                    <td style={{padding:"10px 14px"}}>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>openEdit(f)} style={{padding:"5px 11px",background:"#f3f4f6",border:"none",borderRadius:7,cursor:"pointer",fontSize:12,fontWeight:600}}>✏️ Éditer</button>
                        <button onClick={()=>handleDelete(f)} style={{padding:"5px 11px",background:"#fee2e2",border:"none",borderRadius:7,cursor:"pointer",fontSize:12,color:"#dc2626",fontWeight:600}}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal création / édition */}
      {modal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:"#fff",borderRadius:16,padding:28,width:"100%",maxWidth:480,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
            <h2 style={{margin:"0 0 20px",fontSize:18,fontWeight:800}}>
              {modal.mode==="new" ? "Nouveau fournisseur" : "Modifier le fournisseur"}
            </h2>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {FIELDS.map(({key,label,placeholder,type})=>(
                <div key={key}>
                  <label style={{fontSize:12,fontWeight:700,color:"#555",display:"block",marginBottom:4}}>{label}</label>
                  <input type={type} value={form[key]} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}
                    placeholder={placeholder}
                    style={{width:"100%",padding:"9px 12px",border:"1px solid #e0e0d8",borderRadius:9,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                </div>
              ))}
              <div>
                <label style={{fontSize:12,fontWeight:700,color:"#555",display:"block",marginBottom:4}}>Notes</label>
                <textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}
                  rows={2} placeholder="Informations complémentaires…"
                  style={{width:"100%",padding:"9px 12px",border:"1px solid #e0e0d8",borderRadius:9,fontSize:13,outline:"none",resize:"vertical",boxSizing:"border-box",fontFamily:"inherit"}}/>
              </div>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:20}}>
              <button onClick={()=>setModal(null)} style={{padding:"9px 18px",background:"#f3f4f6",border:"none",borderRadius:9,cursor:"pointer",fontSize:13,fontWeight:600}}>Annuler</button>
              <button onClick={handleSave} disabled={saving}
                style={{padding:"9px 20px",background:"#1e2330",color:"#fff",border:"none",borderRadius:9,cursor:saving?"not-allowed":"pointer",fontSize:13,fontWeight:700,opacity:saving?.7:1}}>
                {saving ? "⏳ Sauvegarde…" : "💾 Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
