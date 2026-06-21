import { useState } from 'react'
import { useAuth } from './AuthContext.jsx'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPwd, setShowPwd] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) { setError('Remplissez tous les champs.'); return }
    setLoading(true); setError('')
    const { error: authErr } = await signIn(email.trim().toLowerCase(), password)
    if (authErr) {
      setError('Email ou mot de passe incorrect.')
      setLoading(false)
    }
  }

  return (
    <div style={{minHeight:"100vh",background:"#1e2330",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800;900&display=swap');`}</style>
      <div style={{width:"min(100%,400px)"}}>

        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:64,height:64,background:"linear-gradient(135deg,#1e40af,#3b82f6)",borderRadius:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,margin:"0 auto 16px",color:"#fff",fontWeight:900,letterSpacing:-0.5}}>
            📦
          </div>
          <div style={{color:"#fff",fontWeight:900,fontSize:24,letterSpacing:-0.5}}>CLMTP</div>
          <div style={{color:"#6b7280",fontSize:13,marginTop:4}}>Gestion d'entrepôt</div>
        </div>

        <div style={{background:"#fff",borderRadius:20,padding:28,boxShadow:"0 24px 64px rgba(0,0,0,0.4)"}}>
          <div style={{fontWeight:800,fontSize:16,color:"#1a1a1a",marginBottom:20,textAlign:"center"}}>🔐 Connexion</div>

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
            <div style={{marginBottom:24}}>
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
            <button type="submit" disabled={loading} style={{width:"100%",padding:"14px",background:loading?"#8a9ab8":"#1e2330",color:"#fff",border:"none",borderRadius:12,fontWeight:800,fontSize:15,cursor:loading?"not-allowed":"pointer",fontFamily:"'DM Sans',sans-serif"}}>
              {loading ? "⏳ Connexion…" : "Se connecter →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
