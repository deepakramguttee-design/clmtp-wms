import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Vérifier que l'appelant est admin
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) return json({ error: 'Unauthorized' }, 401)

    const { data: callerProfile } = await supabaseAdmin
      .from('utilisateurs')
      .select('role')
      .eq('auth_id', caller.id)
      .single()

    if (callerProfile?.role !== 'admin') return json({ error: 'Forbidden' }, 403)

    const { auth_id, password } = await req.json()
    if (!auth_id || !password) return json({ error: 'auth_id et password requis' }, 400)
    if (password.length < 8) return json({ error: 'Mot de passe trop court (min. 8 caractères)' }, 400)

    const { error } = await supabaseAdmin.auth.admin.updateUserById(auth_id, { password })
    if (error) return json({ error: error.message }, 400)

    return json({ ok: true })
  } catch (err) {
    return json({ error: err.message }, 500)
  }
})

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
