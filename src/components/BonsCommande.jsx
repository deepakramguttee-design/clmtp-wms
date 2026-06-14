import { useState, useEffect } from "react"
import {
  getBonsCommande, createBonCommande, updateBonCommande, deleteBonCommande,
  getBonCommandeLignes, saveBonCommandeLignes, getNextBCNumero,
  getFiltrationVehicules, getFiltrationEngins,
} from "../db.js"

const SITES_LABEL = { clmtp_sable:"CLMTP SABLÉ", claisse_rail:"CLAISSE RAIL", stmf:"STMF" }

const BC_STATUTS = {
  brouillon:  { bg:"#f3f4f6", text:"#555",    label:"Brouillon"  },
  envoye:     { bg:"#dbeafe", text:"#1e40af", label:"Envoyé"     },
  devis_recu: { bg:"#fef3c7", text:"#d97706", label:"Devis reçu" },
  commande:   { bg:"#d1fae5", text:"#065f46", label:"Commandé"   },
}

// ── LIGNE ROW ─────────────────────────────────────────────────────────────────
function LigneRow({ ligne, index, products, filtrationData, onChange, onRemove }) {
  const [query, setQuery] = useState(ligne.reference || "")
  const [suggs, setSuggs] = useState([])
  const [open, setOpen] = useState(false)

  const search = (q) => {
    setQuery(q); onChange(index, "reference", q)
    if (!q.trim()) { setSuggs([]); return }
    const ql = q.toLowerCase()
    if (ligne.source === "catalogue_milwaukee") {
      setSuggs((products||[]).filter(p=>
        (p.name||"").toLowerCase().includes(ql)||(p.id||"").toLowerCase().includes(ql)||(p.sku||"").toLowerCase().includes(ql)
      ).slice(0,8).map(p=>({ref:p.id||p.sku||"",label:p.name||p.nom||"",prix:p.prix||0})))
    } else if (ligne.source === "filtration") {
      setSuggs(filtrationData.filter(f=>
        f.ref.toLowerCase().includes(ql)||f.label.toLowerCase().includes(ql)
      ).slice(0,8))
    }
    setOpen(true)
  }

  const pick = (s) => {
    setQuery(s.ref); setSuggs([]); setOpen(false)
    onChange(index, "reference", s.ref)
    onChange(index, "designation", s.label)
    if (s.prix > 0) onChange(index, "prix_unitaire", s.prix)
  }

  const badge = ligne.source === "catalogue_milwaukee"
    ? {bg:"#dbeafe",text:"#1e40af",label:"Milwaukee"}
    : ligne.source === "filtration"
    ? {bg:"#d1fae5",text:"#065f46",label:"Filtration"}
    : {bg:"#f3f4f6",text:"#555",label:"Libre"}

  const montant = (parseFloat(ligne.quantite)||0) * (parseFloat(ligne.prix_unitaire)||0)

  return (
    <tr style={{borderBottom:"1px solid #f3f4f6"}}>
      <td style={{padding:"8px 10px",verticalAlign:"top",minWidth:160}}>
        <span style={{background:badge.bg,color:badge.text,padding:"2px 7px",borderRadius:99,fontSize:10,fontWeight:700,display:"inline-block",marginBottom:4}}>{badge.label}</span>
        {ligne.source !== "libre" ? (
          <div style={{position:"relative"}}>
            <input value={query} onChange={e=>search(e.target.value)} onFocus={()=>query&&setOpen(true)}
              onBlur={()=>setTimeout(()=>setOpen(false),180)}
              placeholder={ligne.source==="catalogue_milwaukee"?"Réf. / nom article…":"Réf. filtration…"}
              style={{width:"100%",padding:"6px 9px",border:"1px solid #e0e0d8",borderRadius:8,fontSize:12,outline:"none",boxSizing:"border-box"}}/>
            {open&&suggs.length>0&&(
              <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1px solid #e0e0d8",borderRadius:10,zIndex:200,boxShadow:"0 4px 20px rgba(0,0,0,0.12)",maxHeight:220,overflowY:"auto"}}>
                {suggs.map((s,i)=>(
                  <div key={i} onMouseDown={()=>pick(s)} style={{padding:"8px 12px",cursor:"pointer",borderBottom:"1px solid #f3f4f6"}}
                    onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"}
                    onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                    <div style={{fontWeight:700,fontFamily:"monospace",fontSize:11,color:"#1e2330"}}>{s.ref||"—"}</div>
                    <div style={{color:"#6b7280",fontSize:11,marginTop:1}}>{s.label}</div>
                    {s.prix>0&&<div style={{color:"#059669",fontSize:11,fontWeight:700}}>{s.prix.toFixed(2)} €</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <input value={ligne.reference} onChange={e=>onChange(index,"reference",e.target.value)}
            placeholder="Référence…"
            style={{width:"100%",padding:"6px 9px",border:"1px solid #e0e0d8",borderRadius:8,fontSize:12,outline:"none",boxSizing:"border-box"}}/>
        )}
      </td>
      <td style={{padding:"8px 10px",verticalAlign:"top"}}>
        <input value={ligne.designation} onChange={e=>onChange(index,"designation",e.target.value)}
          placeholder="Désignation *"
          style={{width:"100%",padding:"6px 9px",border:"1px solid #e0e0d8",borderRadius:8,fontSize:12,outline:"none",boxSizing:"border-box"}}/>
      </td>
      <td style={{padding:"8px 10px",verticalAlign:"top",width:80}}>
        <input type="number" value={ligne.quantite} onChange={e=>onChange(index,"quantite",e.target.value)}
          min="0" step="1"
          style={{width:"100%",padding:"6px 9px",border:"1px solid #e0e0d8",borderRadius:8,fontSize:12,outline:"none",textAlign:"center",boxSizing:"border-box"}}/>
      </td>
      <td style={{padding:"8px 10px",verticalAlign:"top",width:110}}>
        <input type="number" value={ligne.prix_unitaire} onChange={e=>onChange(index,"prix_unitaire",e.target.value)}
          min="0" step="0.01"
          style={{width:"100%",padding:"6px 9px",border:"1px solid #e0e0d8",borderRadius:8,fontSize:12,outline:"none",textAlign:"right",boxSizing:"border-box"}}/>
      </td>
      <td style={{padding:"8px 10px",verticalAlign:"top",width:110,textAlign:"right"}}>
        <div style={{padding:"6px 9px",background:"#f9fafb",borderRadius:8,fontSize:13,fontWeight:700,color:"#1a1a1a",border:"1px solid #e0e0d8"}}>
          {montant.toFixed(2)}
        </div>
      </td>
      <td style={{padding:"8px 10px",verticalAlign:"top",textAlign:"center",width:44}}>
        <button onClick={()=>onRemove(index)} style={{background:"#fee2e2",border:"none",borderRadius:7,padding:"5px 9px",cursor:"pointer",color:"#dc2626",fontSize:13,fontWeight:700}}>✕</button>
      </td>
    </tr>
  )
}

// ── FORM ──────────────────────────────────────────────────────────────────────
function FormBC({ bc, siteId, user, products, fournisseurs, onSaved, onCancel }) {
  const isNew = !bc?.id
  const [form, setForm] = useState({
    fournisseur_id: bc?.fournisseur_id || "",
    fournisseur_nom: bc?.fournisseur_nom || "",
    site: bc?.site || siteId,
    statut: bc?.statut || "brouillon",
    notes: bc?.notes || "",
  })
  const [lignes, setLignes] = useState([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [filtrationData, setFiltrationData] = useState([])

  useEffect(() => {
    Promise.all([getFiltrationVehicules(), getFiltrationEngins()]).then(([vehicules, engins]) => {
      const items = []
      const vFields = ["filtre_air","filtre_habitacle","filtre_gasoil","filtre_huile","plaquette_avant","plaquette_arriere","disque_avant","disque_arriere","pneu"]
      const vLabels = ["Filtre air","Filtre habitacle","Filtre gasoil","Filtre huile","Plaquette avant","Plaquette arrière","Disque avant","Disque arrière","Pneu"]
      vehicules.forEach(v => vFields.forEach((f,fi) => { if(v[f]) items.push({ref:v[f],label:`${vLabels[fi]} — ${v.designation||""}`,prix:0}) }))
      const eFields = ["f_hydraulique","f_moteur","f_air_secu","f_air_princ","f_go","f_adblue","dessiccateur","f_aeration","f_transmission","courroie"]
      const eLabels = ["Filtre hydraulique","Filtre moteur","Filtre air sécurité","Filtre air principal","Filtre GO","Filtre AdBlue","Dessiccateur","Filtre aération","Filtre transmission","Courroie"]
      engins.forEach(e => eFields.forEach((f,fi) => { if(e[f]) items.push({ref:e[f],label:`${eLabels[fi]} — ${e.engin||e.code||""}`,prix:0}) }))
      setFiltrationData(items)
    })
    if (!isNew) {
      getBonCommandeLignes(bc.id).then(ls => {
        setLignes(ls.map(l => ({...l, _key: Math.random()})))
        setLoading(false)
      })
    } else setLoading(false)
  }, [])

  const totalHT = lignes.reduce((s,l) => s + (parseFloat(l.quantite)||0)*(parseFloat(l.prix_unitaire)||0), 0)
  const tva = totalHT * 0.20
  const totalTTC = totalHT + tva

  const addLigne = (source) => setLignes(p => [...p, {_key:Date.now(),reference:"",designation:"",quantite:1,prix_unitaire:0,montant_ligne:0,source}])

  const updateLigne = (i, field, val) => setLignes(p => p.map((l,idx) => idx!==i ? l : {...l,[field]:val,montant_ligne:(field==="quantite"?(parseFloat(val)||0)*(parseFloat(l.prix_unitaire)||0):(parseFloat(l.quantite)||0)*(parseFloat(field==="prix_unitaire"?val:l.prix_unitaire)||0))}))

  const removeLigne = (i) => setLignes(p => p.filter((_,idx)=>idx!==i))

  const handleFournisseur = (e) => {
    const id = e.target.value
    const f = fournisseurs.find(f => String(f.id)===String(id))
    setForm(p => ({...p, fournisseur_id:id, fournisseur_nom:f?.nom||""}))
  }

  const buildPayload = (numero) => ({
    numero: numero || bc?.numero,
    fournisseur_id: form.fournisseur_id || null,
    fournisseur_nom: form.fournisseur_nom,
    site: form.site,
    statut: isNew ? "brouillon" : form.statut,
    created_by: `${user?.prenom||""} ${user?.nom||""}`.trim(),
    total_ht: parseFloat(totalHT.toFixed(2)),
    total_ttc: parseFloat(totalTTC.toFixed(2)),
    notes: form.notes,
  })

  const validate = () => {
    if (!form.fournisseur_nom) { alert("Sélectionnez un fournisseur."); return false }
    if (!lignes.length) { alert("Ajoutez au moins une ligne."); return false }
    if (lignes.some(l => !l.designation.trim())) { alert("Toutes les lignes doivent avoir une désignation."); return false }
    return true
  }

  const saveDraft = async () => {
    if (!validate()) return
    setSaving(true)
    let saved
    if (isNew) {
      const numero = await getNextBCNumero(form.site)
      saved = await createBonCommande(buildPayload(numero))
    } else {
      await updateBonCommande(bc.id, buildPayload())
      saved = {...bc, ...buildPayload(), id:bc.id}
    }
    if (saved) {
      await saveBonCommandeLignes(saved.id, lignes)
      onSaved(saved, isNew)
    }
    setSaving(false)
  }

  const generatePDF = async () => {
    if (!validate()) return
    setSaving(true)
    let currentBc = bc
    if (isNew) {
      const numero = await getNextBCNumero(form.site)
      currentBc = await createBonCommande(buildPayload(numero))
      if (currentBc) await saveBonCommandeLignes(currentBc.id, lignes)
    } else {
      await updateBonCommande(bc.id, buildPayload())
      await saveBonCommandeLignes(bc.id, lignes)
      currentBc = {...bc, ...buildPayload()}
    }
    setSaving(false)
    if (!currentBc) return

    const [{default:jsPDF},{default:autoTable}] = await Promise.all([import("jspdf"), import("jspdf-autotable")])
    const doc = new jsPDF({orientation:"portrait", unit:"mm", format:"a4"})
    const dateStr = new Date().toLocaleDateString("fr-FR")
    const timeStr = new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})

    let logoData = null
    try { const r=await fetch("/icon-192.png"); const b=await r.blob(); logoData=await new Promise(res=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.readAsDataURL(b)}) } catch(_){}

    if (logoData) doc.addImage(logoData,"PNG",15,12,22,22)
    const tx = logoData ? 42 : 15
    doc.setFont("helvetica","bold"); doc.setFontSize(18); doc.setTextColor(17,24,39)
    doc.text("CLMTP SABLÉ", tx, 20)
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(75,85,99)
    doc.text("Gestion d'entrepôt — LogiWMS", tx, 27)

    doc.setFillColor(17,24,39); doc.roundedRect(135,12,60,26,3,3,"F")
    doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(255,255,255)
    doc.text("DEMANDE DE DEVIS",165,20,{align:"center"})
    doc.setFontSize(14); doc.text(currentBc.numero||"",165,30,{align:"center"})

    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(107,114,128)
    doc.text(`Date : ${dateStr} à ${timeStr}`, 135, 44)
    doc.text(`Site : ${SITES_LABEL[form.site]||form.site}`, 135, 50)
    doc.text(`Créé par : ${buildPayload().created_by||"—"}`, 135, 56)

    doc.setFillColor(249,250,251); doc.roundedRect(15,40,112,24,3,3,"F")
    doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(107,114,128)
    doc.text("FOURNISSEUR", 20, 47)
    doc.setFont("helvetica","bold"); doc.setFontSize(13); doc.setTextColor(17,24,39)
    doc.text(form.fournisseur_nom, 20, 57)

    doc.setDrawColor(229,231,235); doc.line(15,68,195,68)

    autoTable(doc, {
      head:[["Réf.","Désignation","Source","Qté","P.U. HT (€)","Montant HT (€)"]],
      body: lignes.map(l=>[
        l.reference||"—",
        l.designation,
        l.source==="catalogue_milwaukee"?"Milwaukee":l.source==="filtration"?"Filtration":"Libre",
        String(parseFloat(l.quantite)||0),
        parseFloat(l.prix_unitaire||0).toFixed(2),
        ((parseFloat(l.quantite)||0)*(parseFloat(l.prix_unitaire)||0)).toFixed(2),
      ]),
      startY: 72,
      styles:{fontSize:9,cellPadding:3},
      headStyles:{fillColor:[17,24,39],textColor:255,fontStyle:"bold",fontSize:9},
      alternateRowStyles:{fillColor:[249,250,251]},
      columnStyles:{
        0:{cellWidth:30,fontStyle:"bold",font:"courier"},
        1:{cellWidth:70},
        2:{cellWidth:22,fontSize:8,textColor:[107,114,128]},
        3:{cellWidth:14,halign:"center"},
        4:{cellWidth:26,halign:"right"},
        5:{cellWidth:26,halign:"right",fontStyle:"bold"},
      },
      margin:{left:15,right:15},
    })

    const finalY = (doc.lastAutoTable?.finalY||170) + 8
    doc.setFillColor(249,250,251); doc.roundedRect(130,finalY,65,40,3,3,"F")
    doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.setTextColor(107,114,128)
    doc.text("Total HT :", 135, finalY+10)
    doc.text("TVA (20%) :", 135, finalY+19)
    doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(17,24,39)
    doc.text("TOTAL TTC :", 135, finalY+30)
    doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.setTextColor(107,114,128)
    doc.text(`${totalHT.toFixed(2)} €`, 193, finalY+10, {align:"right"})
    doc.text(`${tva.toFixed(2)} €`, 193, finalY+19, {align:"right"})
    doc.setFont("helvetica","bold"); doc.setFontSize(13); doc.setTextColor(5,150,105)
    doc.text(`${totalTTC.toFixed(2)} €`, 193, finalY+30, {align:"right"})

    if (form.notes) {
      doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(107,114,128)
      doc.text("NOTES :", 15, finalY+10)
      doc.setFont("helvetica","normal"); doc.setTextColor(17,24,39); doc.setFontSize(9)
      doc.text(form.notes, 15, finalY+17, {maxWidth:108})
    }

    const pages = doc.getNumberOfPages()
    for (let i=1;i<=pages;i++) {
      doc.setPage(i); doc.setFontSize(7); doc.setTextColor(156,163,175)
      doc.text(`Page ${i}/${pages} — CLMTP Sablé — LogiWMS`, 105, 290, {align:"center"})
      doc.text(`${currentBc.numero} — Imprimé le ${dateStr}`, 105, 285, {align:"center"})
    }
    doc.save(`${currentBc.numero||"DDV_CLMTP"}_${dateStr.replace(/\//g,"-")}.pdf`)
    onSaved(currentBc, isNew)
  }

  if (loading) return <div style={{textAlign:"center",padding:40,color:"#6b7280"}}>Chargement…</div>

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
        <div>
          <button onClick={onCancel} style={{background:"#f3f4f6",border:"none",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:13,fontWeight:600,marginBottom:8,display:"block"}}>← Retour à la liste</button>
          <h1 style={{fontSize:22,fontWeight:900,color:"#1a1a1a",margin:0}}>{isNew?"Nouvelle demande de devis":`Éditer ${bc.numero}`}</h1>
          <p style={{color:"#6b7280",fontSize:13,margin:"4px 0 0"}}>Renseignez le fournisseur, le site et les articles à commander</p>
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <button onClick={saveDraft} disabled={saving} style={{background:"#fff",color:"#1e2330",border:"2px solid #1e2330",borderRadius:10,padding:"10px 18px",fontWeight:700,cursor:saving?"not-allowed":"pointer",fontSize:13,opacity:saving?.7:1}}>
            {saving?"⏳ Sauvegarde…":"💾 Enregistrer brouillon"}
          </button>
          <button onClick={generatePDF} disabled={saving} style={{background:"#1e2330",color:"#fff",border:"none",borderRadius:10,padding:"11px 20px",fontWeight:700,cursor:saving?"not-allowed":"pointer",fontSize:13,opacity:saving?.7:1}}>
            📄 Générer PDF
          </button>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
        <div style={{background:"#fff",borderRadius:14,padding:"16px 20px",border:"1px solid #e0e0d8"}}>
          <label style={{fontSize:12,fontWeight:700,color:"#555",display:"block",marginBottom:8}}>Fournisseur *</label>
          <select value={form.fournisseur_id} onChange={handleFournisseur} style={{width:"100%",padding:"10px 12px",border:"1px solid #e0e0d8",borderRadius:10,fontSize:13,outline:"none",background:"#fff"}}>
            <option value="">— Sélectionner un fournisseur —</option>
            {fournisseurs.map(f=><option key={f.id} value={f.id}>{f.nom}</option>)}
          </select>
        </div>

        <div style={{background:"#fff",borderRadius:14,padding:"16px 20px",border:"1px solid #e0e0d8"}}>
          <label style={{fontSize:12,fontWeight:700,color:"#555",display:"block",marginBottom:8}}>Site *</label>
          <select value={form.site} onChange={e=>setForm(p=>({...p,site:e.target.value}))} style={{width:"100%",padding:"10px 12px",border:"1px solid #e0e0d8",borderRadius:10,fontSize:13,outline:"none",background:"#fff"}}>
            <option value="clmtp_sable">CLMTP SABLÉ</option>
            <option value="claisse_rail">CLAISSE RAIL</option>
            <option value="stmf">STMF</option>
          </select>
        </div>

        {!isNew && (
          <div style={{background:"#fff",borderRadius:14,padding:"16px 20px",border:"1px solid #e0e0d8"}}>
            <label style={{fontSize:12,fontWeight:700,color:"#555",display:"block",marginBottom:8}}>Statut</label>
            <select value={form.statut} onChange={e=>setForm(p=>({...p,statut:e.target.value}))} style={{width:"100%",padding:"10px 12px",border:"1px solid #e0e0d8",borderRadius:10,fontSize:13,outline:"none",background:"#fff"}}>
              <option value="brouillon">Brouillon</option>
              <option value="envoye">Envoyé</option>
              <option value="devis_recu">Devis reçu</option>
              <option value="commande">Commandé</option>
            </select>
          </div>
        )}

        <div style={{background:"#fff",borderRadius:14,padding:"16px 20px",border:"1px solid #e0e0d8",gridColumn:"1/-1"}}>
          <label style={{fontSize:12,fontWeight:700,color:"#555",display:"block",marginBottom:8}}>Notes / Instructions de livraison</label>
          <textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} rows={2} placeholder="Délai de livraison souhaité, adresse, remarques…" style={{width:"100%",padding:"10px 12px",border:"1px solid #e0e0d8",borderRadius:10,fontSize:13,outline:"none",resize:"vertical",fontFamily:"'DM Sans',sans-serif",boxSizing:"border-box"}}/>
        </div>
      </div>

      <div style={{background:"#fff",borderRadius:14,border:"1px solid #e0e0d8",overflow:"hidden"}}>
        <div style={{padding:"14px 20px",borderBottom:"1px solid #f3f4f6",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
          <div style={{fontWeight:700,fontSize:15,color:"#1a1a1a"}}>📦 Lignes ({lignes.length})</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button onClick={()=>addLigne("catalogue_milwaukee")} style={{padding:"7px 13px",background:"#dbeafe",color:"#1e40af",border:"1px solid #93c5fd",borderRadius:9,cursor:"pointer",fontSize:12,fontWeight:700}}>+ Milwaukee</button>
            <button onClick={()=>addLigne("filtration")} style={{padding:"7px 13px",background:"#d1fae5",color:"#065f46",border:"1px solid #6ee7b7",borderRadius:9,cursor:"pointer",fontSize:12,fontWeight:700}}>+ Filtration</button>
            <button onClick={()=>addLigne("libre")} style={{padding:"7px 13px",background:"#f3f4f6",color:"#1a1a1a",border:"1px solid #e0e0d8",borderRadius:9,cursor:"pointer",fontSize:12,fontWeight:700}}>+ Ligne libre</button>
          </div>
        </div>

        {lignes.length === 0 ? (
          <div style={{padding:32,textAlign:"center",color:"#6b7280",fontSize:13}}>
            <div style={{fontSize:32,marginBottom:8}}>📋</div>
            Ajoutez des articles via les boutons ci-dessus
          </div>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{background:"#f9fafb",borderBottom:"1px solid #e0e0d8"}}>
                  {["Référence","Désignation","Qté","P.U. HT (€)","Montant (€)",""].map(h=>(
                    <th key={h} style={{padding:"10px 10px",textAlign:["Qté","P.U. HT (€)","Montant (€)"].includes(h)?"right":"left",fontSize:11,fontWeight:700,color:"#374151",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignes.map((l,i)=>(
                  <LigneRow key={l._key||i} ligne={l} index={i}
                    products={products} filtrationData={filtrationData}
                    onChange={updateLigne} onRemove={removeLigne}/>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{padding:"14px 20px",borderTop:"1px solid #f3f4f6",display:"flex",justifyContent:"flex-end"}}>
          <div style={{background:"#f9fafb",borderRadius:12,padding:"16px 20px",minWidth:240,border:"1px solid #e0e0d8"}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:24,marginBottom:7}}>
              <span style={{color:"#6b7280",fontSize:13}}>Total HT</span>
              <span style={{fontWeight:700,fontSize:14}}>{totalHT.toFixed(2)} €</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",gap:24,marginBottom:10}}>
              <span style={{color:"#6b7280",fontSize:13}}>TVA (20%)</span>
              <span style={{fontWeight:600,fontSize:13}}>{tva.toFixed(2)} €</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",gap:24,borderTop:"2px solid #1e2330",paddingTop:10}}>
              <span style={{fontWeight:800,fontSize:15}}>Total TTC</span>
              <span style={{fontWeight:900,fontSize:17,color:"#059669"}}>{totalTTC.toFixed(2)} €</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── LISTE ─────────────────────────────────────────────────────────────────────
export default function BonsCommande({ siteId, user, products, fournisseurs }) {
  const [view, setView] = useState("list")
  const [bcs, setBcs] = useState([])
  const [loading, setLoading] = useState(true)
  const [editBc, setEditBc] = useState(null)
  const [filterStatut, setFilterStatut] = useState("tous")
  const [filterFourn, setFilterFourn] = useState("")
  const [filterSearch, setFilterSearch] = useState("")
  const [emailLoading, setEmailLoading] = useState(null)

  useEffect(() => {
    setLoading(true)
    getBonsCommande(siteId).then(d => { setBcs(d); setLoading(false) })
  }, [siteId])

  const handleSaved = (bc, isNew) => {
    setBcs(prev => isNew ? [bc,...prev] : prev.map(b=>b.id===bc.id?bc:b))
    setView("list")
  }

  const handleDelete = async (id) => {
    if (!confirm("Supprimer définitivement cette demande de devis ?")) return
    await deleteBonCommande(id)
    setBcs(prev => prev.filter(b=>b.id!==id))
  }

  const handleEmail = async (bc) => {
    setEmailLoading(bc.id)
    const fourn = fournisseurs.find(f => String(f.id)===String(bc.fournisseur_id))
    const email = fourn?.email || ""
    const lignes = await getBonCommandeLignes(bc.id)
    setEmailLoading(null)

    const sujet = encodeURIComponent(`Demande de devis ${bc.numero} - CLMTP`)
    const lignesText = lignes.length
      ? lignes.map((l,i) => `${i+1}. Réf: ${l.reference||"—"} | ${l.designation} | Qté: ${l.quantite}`).join("\n")
      : "(aucune ligne)"
    const body = encodeURIComponent(
      `Bonjour,\n\nNous vous adressons la présente demande de devis ${bc.numero}.\n\nArticles demandés :\n${lignesText}\n\nCordialement,\nCLMTP SABLÉ`
    )
    window.open(`mailto:${email}?subject=${sujet}&body=${body}`)

    if (bc.statut === "brouillon") {
      if (confirm("Passer le statut à « Envoyé » ?")) {
        await updateBonCommande(bc.id, { statut:"envoye" })
        setBcs(prev => prev.map(b => b.id===bc.id ? {...b, statut:"envoye"} : b))
      }
    }
  }

  if (view==="form") {
    return <FormBC bc={editBc} siteId={siteId} user={user} products={products} fournisseurs={fournisseurs}
      onSaved={handleSaved} onCancel={()=>setView("list")}/>
  }

  const filtered = bcs.filter(b => {
    if (filterStatut!=="tous" && b.statut!==filterStatut) return false
    if (filterFourn && !(b.fournisseur_nom||"").toLowerCase().includes(filterFourn.toLowerCase())) return false
    if (filterSearch && !(b.numero||"").toLowerCase().includes(filterSearch.toLowerCase())) return false
    return true
  })

  const stats = {
    total: bcs.length,
    brouillon: bcs.filter(b=>b.statut==="brouillon").length,
    envoye: bcs.filter(b=>b.statut==="envoye").length,
    devis_recu: bcs.filter(b=>b.statut==="devis_recu").length,
    commande: bcs.filter(b=>b.statut==="commande").length,
    montant: bcs.reduce((s,b)=>s+(parseFloat(b.total_ttc)||0),0),
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:900,color:"#1a1a1a",margin:0}}>Demandes de devis</h1>
          <p style={{color:"#6b7280",fontSize:13,margin:"4px 0 0"}}>{bcs.length} demande{bcs.length!==1?"s":""} · {SITES_LABEL[siteId]||siteId}</p>
        </div>
        <button onClick={()=>{setEditBc(null);setView("form")}} style={{background:"#1e2330",color:"#fff",border:"none",borderRadius:10,padding:"11px 20px",fontWeight:700,cursor:"pointer",fontSize:14}}>
          🛒 Nouvelle DDV
        </button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:12}}>
        {[
          {label:"Total",value:stats.total,icon:"📋",color:"#1a1a1a"},
          {label:"Brouillons",value:stats.brouillon,icon:"📝",color:"#555"},
          {label:"Envoyés",value:stats.envoye,icon:"📤",color:"#1e40af"},
          {label:"Devis reçus",value:stats.devis_recu,icon:"📩",color:"#d97706"},
          {label:"Commandés",value:stats.commande,icon:"✅",color:"#059669"},
          {label:"Total TTC",value:stats.montant.toFixed(2)+" €",icon:"💶",color:"#7c3aed"},
        ].map((k,i)=>(
          <div key={i} style={{background:"#fff",borderRadius:14,padding:"14px 16px",border:"1px solid #e0e0d8"}}>
            <div style={{fontSize:20,marginBottom:6}}>{k.icon}</div>
            <div style={{fontSize:k.label==="Total TTC"?16:22,fontWeight:900,color:k.color,lineHeight:1}}>{k.value}</div>
            <div style={{fontSize:11,color:"#6b7280",marginTop:4}}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{background:"#fff",borderRadius:14,padding:"14px 18px",border:"1px solid #e0e0d8",display:"flex",gap:10,flexWrap:"wrap"}}>
        <input value={filterSearch} onChange={e=>setFilterSearch(e.target.value)} placeholder="🔍 Numéro DDV…" style={{padding:"8px 12px",border:"1px solid #e0e0d8",borderRadius:9,fontSize:13,outline:"none",minWidth:140}}/>
        <select value={filterStatut} onChange={e=>setFilterStatut(e.target.value)} style={{padding:"8px 12px",border:"1px solid #e0e0d8",borderRadius:9,fontSize:13,outline:"none",background:"#fff"}}>
          <option value="tous">Tous les statuts</option>
          {Object.entries(BC_STATUTS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        <input value={filterFourn} onChange={e=>setFilterFourn(e.target.value)} placeholder="Fournisseur…" style={{padding:"8px 12px",border:"1px solid #e0e0d8",borderRadius:9,fontSize:13,outline:"none",minWidth:160}}/>
        {(filterSearch||filterStatut!=="tous"||filterFourn)&&(
          <button onClick={()=>{setFilterSearch("");setFilterStatut("tous");setFilterFourn("")}} style={{padding:"8px 12px",background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:9,cursor:"pointer",fontSize:12,fontWeight:600}}>✕ Effacer</button>
        )}
      </div>

      {loading ? (
        <div style={{textAlign:"center",padding:40,color:"#6b7280"}}>Chargement…</div>
      ) : filtered.length===0 ? (
        <div style={{background:"#fff",borderRadius:14,padding:40,border:"1px solid #e0e0d8",textAlign:"center",color:"#6b7280"}}>
          <div style={{fontSize:40,marginBottom:12}}>🛒</div>
          <div style={{fontWeight:700,fontSize:16,marginBottom:6}}>{bcs.length===0?"Aucune demande de devis":"Aucun résultat"}</div>
          <div style={{fontSize:13}}>{bcs.length===0?"Créez votre première demande de devis":"Modifiez les filtres de recherche"}</div>
        </div>
      ) : (
        <div style={{background:"#fff",borderRadius:14,border:"1px solid #e0e0d8",overflow:"hidden"}}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{background:"#f9fafb",borderBottom:"1px solid #e0e0d8"}}>
                  {["Numéro","Fournisseur","Site","Date","Statut","Total HT","Total TTC","Actions"].map(h=>(
                    <th key={h} style={{padding:"11px 14px",textAlign:["Total HT","Total TTC"].includes(h)?"right":"left",fontWeight:700,color:"#374151",fontSize:11,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((bc,i)=>{
                  const s = BC_STATUTS[bc.statut]||BC_STATUTS.brouillon
                  return (
                    <tr key={bc.id} style={{borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                      <td style={{padding:"11px 14px",fontWeight:700,color:"#1e2330",fontFamily:"monospace",fontSize:12}}>{bc.numero}</td>
                      <td style={{padding:"11px 14px",fontWeight:600}}>{bc.fournisseur_nom||"—"}</td>
                      <td style={{padding:"11px 14px",color:"#6b7280",fontSize:12}}>{SITES_LABEL[bc.site]||bc.site}</td>
                      <td style={{padding:"11px 14px",color:"#6b7280",fontSize:12,whiteSpace:"nowrap"}}>{new Date(bc.date_creation||bc.created_at).toLocaleDateString("fr-FR")}</td>
                      <td style={{padding:"11px 14px"}}>
                        <span style={{background:s.bg,color:s.text,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{s.label}</span>
                      </td>
                      <td style={{padding:"11px 14px",fontWeight:700,textAlign:"right",whiteSpace:"nowrap"}}>{parseFloat(bc.total_ht||0).toFixed(2)} €</td>
                      <td style={{padding:"11px 14px",fontWeight:700,textAlign:"right",color:"#059669",whiteSpace:"nowrap"}}>{parseFloat(bc.total_ttc||0).toFixed(2)} €</td>
                      <td style={{padding:"11px 14px"}}>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          {(bc.statut==="brouillon"||bc.statut==="envoye") && (
                            <button onClick={()=>handleEmail(bc)} disabled={emailLoading===bc.id}
                              style={{padding:"5px 11px",background:"#dbeafe",color:"#1e40af",border:"none",borderRadius:7,cursor:emailLoading===bc.id?"not-allowed":"pointer",fontSize:12,fontWeight:600,opacity:emailLoading===bc.id?.6:1}}>
                              {emailLoading===bc.id?"⏳":"📧"} Email
                            </button>
                          )}
                          <button onClick={()=>{setEditBc(bc);setView("form")}} style={{padding:"5px 11px",background:"#f3f4f6",border:"none",borderRadius:7,cursor:"pointer",fontSize:12,fontWeight:600}}>✏️ Éditer</button>
                          <button onClick={()=>handleDelete(bc.id)} style={{padding:"5px 11px",background:"#fee2e2",border:"none",borderRadius:7,cursor:"pointer",fontSize:12,color:"#dc2626",fontWeight:600}}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
