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

    // Verify caller is an admin
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

    const { email, password, nom, prenom, role, site_id } = await req.json()
    if (!email || !password || !nom || !prenom || !role || !site_id) {
      return json({ error: 'Champs requis manquants' }, 400)
    }
    if (password.length < 6) return json({ error: 'Mot de passe trop court (min. 6 caractères)' }, 400)

    // Create Supabase Auth account (auto-confirmed, no email sent)
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true,
    })
    if (authErr) return json({ error: authErr.message }, 400)

    const auth_id = authData.user.id

    // Insert profile row
    const { data: utilisateur, error: dbErr } = await supabaseAdmin
      .from('utilisateurs')
      .insert([{ nom, prenom, email: email.toLowerCase().trim(), role, site_id, actif: true, auth_id }])
      .select()
      .single()

    if (dbErr) {
      await supabaseAdmin.auth.admin.deleteUser(auth_id)
      return json({ error: dbErr.message }, 400)
    }

    return json({ user: utilisateur })
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
