import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(null)
  const [profil, setProfil] = useState(null)
  const [modules, setModules] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfil(au) {
    if (!au) { setProfil(null); setModules(null); return }
    const { data: p } = await supabase
      .from('utilisateurs')
      .select('id,nom,prenom,email,role,actif,site_id')
      .eq('auth_id', au.id)
      .single()
    if (!p) { setProfil(null); setModules(null); return }
    const { data: pm } = await supabase
      .from('user_permissions')
      .select('modules')
      .eq('user_id', p.id)
      .limit(1)
    setProfil(p)
    setModules(pm?.[0]?.modules ?? null)
  }

  async function refreshModules() {
    if (!profil) return
    const { data } = await supabase
      .from('user_permissions')
      .select('modules')
      .eq('user_id', profil.id)
      .limit(1)
    setModules(data?.[0]?.modules ?? null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null)
      loadProfil(session?.user ?? null).finally(() => setLoading(false))
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthUser(session?.user ?? null)
      loadProfil(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password })
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      authUser, profil, role: profil?.role ?? null, modules, loading,
      signIn, signOut, refreshModules,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
