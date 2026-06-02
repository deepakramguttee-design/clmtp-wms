import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://jtqlaiabxwbgwgduqzpl.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0cWxhaWFieHdiZ3dnZHVxenBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MjAxOTIsImV4cCI6MjA5NTE5NjE5Mn0.Jct69RHpkvSXwCxO7S0lkd2faSlucwtcTtqkSVNjkQQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)