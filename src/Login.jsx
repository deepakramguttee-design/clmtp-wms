import { useState } from 'react'
import { useAuth } from './AuthContext.jsx'

const SITE_LOGOS = {
  clmtp_sable:  '/logos/clmtp.jpg',
  claisse_rail: '/logos/claisse_rail.jpg',
  stmf:         '/logos/stmf.jpg',
}

const SITE_LABELS = {
  clmtp_sable:  'CLMTP SABLÉ',
  claisse_rail: 'CLAISSE RAIL',
  stmf:         'STMF',
}

const SITES = {
  clmtp_sable:  { label: "CLMTP SABLÉ",   color: "#1e40af", bg: "#dbeafe", icon: "🏗️", logo: "CS" },
  claisse_rail: { label: "CLAISSE RAIL",   color: "#065f46", bg: "#d1fae5", icon: "🚂", logo: "CR" },
  stmf:         { label: "STMF",           color: "#7c3aed", bg: "#f3e8ff", icon: "⚙️", logo: "ST" },
}

export default function Login({ siteId, setSiteId }) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [step, setStep] = useState('site')

  const site = SITES[siteId] || SITES.clmtp_sable

  const handleLogin = async () => {
    if (!email || !password) { setError('Remplissez tous les champs.'); return }
    setLoading(true); setError('')
    const { error: authErr } = await signIn(email.trim().toLowerCase(), password)
    if (authErr) {
      setError('Email ou mot de passe incorrect.')
      setLoading(false)
    }
  }

  const handleSiteNext = () => {
    localStorage.setItem('wms_site', siteId)
    setStep('login')
  }

  return (
    <div style={{minHeight:"100vh",background:"#1e2330",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800;900&display=swap');`}</style>
      <div style={{width:"min(100%,440px)"}}>

        <div style={{textAlign:"center",marginBottom:32}}>
          {SITE_LOGOS[siteId]
            ? <div style={{width:88,height:88,background:"#fff",borderRadius:20,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",overflow:"hidden",boxShadow:"0 4px 16px rgba(0,0,0,0.2)"}}>
                <img src={SITE_LOGOS[siteId]} alt={SITE_LABELS[siteId]||site.label}
                  style={{width:72,height:72,objectFit:"contain",transition:"opacity 0.3s"}}/>
              </div>
            : <div style={{width:64,height:64,background:`linear-gradient(135deg,${site.color},${site.color}99)`,borderRadius:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,margin:"0 auto 16px",color:"#fff",fontWeight:900,letterSpacing:-0.5,transition:"all 0.3s"}}>
                {site.logo}
              </div>
          }
          <div style={{color:"#fff",fontWeight:900,fontSize:24,letterSpacing:-0.5,transition:"all 0.3s"}}>{SITE_LABELS[siteId]||site.label}</div>
        </div>

        {step === 'site' && (
          <div style={{background:"#fff",borderRadius:20,padding:28,boxShadow:"0 24px 64px rgba(0,0,0,0.4)"}}>
            <h2 style={{fontSize:16,fontWeight:800,color:"#1a1a1a",margin:"0 0 20px",textAlign:"center"}}>Choisissez votre site</h2>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
              {Object.entries(SITES).map(([id, s]) => (
                <button key={id} onClick={() => setSiteId(id)} style={{
                  padding:"16px 18px", borderRadius:14, border:`2px solid ${siteId===id?s.color:"#e0e0d8"}`,
                  background:siteId===id?s.bg:"#fff", cursor:"pointer", display:"flex", alignItems:"center", gap:14,
                  textAlign:"left", transition:"all 0.15s", fontFamily:"'DM Sans',sans-serif",
                }}>
                  <div style={{width:42,height:42,background:siteId===id?s.color:"#f3f4f6",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,transition:"all 0.15s"}}>
                    {SITE_LOGOS[id]
                      ? <img src={SITE_LOGOS[id]} alt={s.label} style={{width:34,height:34,objectFit:"contain"}}/>
                      : s.icon
                    }
                  </div>
                  <div>
                    <div style={{fontWeight:800,fontSize:15,color:siteId===id?s.color:"#1a1a1a"}}>{s.label}</div>
                    <div style={{fontSize:11,color:"#8a9ab8",marginTop:2}}>Accès sécurisé · Données séparées</div>
                  </div>
                  {siteId===id && <div style={{marginLeft:"auto",color:s.color,fontSize:18}}>✓</div>}
                </button>
              ))}
            </div>
            <button onClick={handleSiteNext} style={{width:"100%",padding:"14px",background:site.color,color:"#fff",border:"none",borderRadius:12,fontWeight:800,fontSize:15,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
              Accéder à {site.label} →
            </button>
          </div>
        )}

        {step === 'login' && (
          <div style={{background:"#fff",borderRadius:20,padding:28,boxShadow:"0 24px 64px rgba(0,0,0,0.4)"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
              <button type="button" onClick={() => { setStep('site'); setError('') }} style={{background:"#f3f4f6",border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:14,color:"#6b7280"}}>←</button>
              <div>
                <div style={{fontWeight:800,fontSize:16,color:"#1a1a1a"}}>🔐 Connexion</div>
                <div style={{fontSize:12,color:site.color,fontWeight:600}}>{site.icon} {site.label}</div>
              </div>
            </div>

            {error && (
              <div style={{background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#991b1b",fontWeight:600,marginBottom:16}}>
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={e => { e.preventDefault(); handleLogin() }} noValidate>
              <div style={{marginBottom:14}}>
                <label style={{fontSize:12,fontWeight:600,color:"#555",display:"block",marginBottom:6}}>Adresse email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  autoComplete="email" placeholder="votre@email.fr"
                  style={{width:"100%",padding:"12px 14px",border:"1.5px solid #e0e0d8",borderRadius:10,fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"'DM Sans',sans-serif"}}/>
              </div>
              <div style={{marginBottom:20}}>
                <label style={{fontSize:12,fontWeight:600,color:"#555",display:"block",marginBottom:6}}>Mot de passe</label>
                <div style={{position:"relative"}}>
                  <input type={showPwd?"text":"password"} value={password} onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password" placeholder="••••••••"
                    style={{width:"100%",padding:"12px 44px 12px 14px",border:"1.5px solid #e0e0d8",borderRadius:10,fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"'DM Sans',sans-serif"}}/>
                  <button type="button" onClick={() => setShowPwd(s => !s)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#8a9ab8"}}>
                    {showPwd ? "🙈" : "👁"}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} style={{width:"100%",padding:"14px",background:loading?"#8a9ab8":site.color,color:"#fff",border:"none",borderRadius:12,fontWeight:800,fontSize:15,cursor:loading?"not-allowed":"pointer",fontFamily:"'DM Sans',sans-serif"}}>
                {loading ? "⏳ Connexion…" : "Se connecter →"}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  )
}
