import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://jtqlaiabxwbgwgduqzpl.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0cWxhaWFieHdiZ3dnZHVxenBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MjAxOTIsImV4cCI6MjA5NTE5NjE5Mn0.Jct69RHpkvSXwCxO7S0lkd2faSlucwtcTtqkSVNjkQQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})

// ── Storage : bucket privé "vues-eclatees" ──
// Le bucket est privé : les liens publics ne fonctionnent plus, il faut
// générer une URL signée (temporaire) à partir du chemin relatif stocké
// dans vues_eclatees.image_url (ex: "clmtp_sable/1699_xxx.pdf").
const VUES_BUCKET = 'vues-eclatees'
const SIGNED_URL_TTL = 3600 // secondes (1 h)

// URL signée à la demande — pour un clic unique (ouvrir un PDF).
export async function getVueEclateeUrl(path) {
  const { data, error } = await supabase.storage
    .from(VUES_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL)
  if (error) throw error
  return data.signedUrl
}

// URLs signées en batch — pour une liste affichée simultanément.
// Renvoie une Map { path -> signedUrl } ; les chemins en échec sont omis.
export async function getVuesEclateesUrls(paths) {
  if (!paths || paths.length === 0) return new Map()
  const { data, error } = await supabase.storage
    .from(VUES_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL)
  if (error) throw error
  const map = new Map()
  for (const item of data) {
    if (item && item.signedUrl && !item.error) map.set(item.path, item.signedUrl)
  }
  return map
}
