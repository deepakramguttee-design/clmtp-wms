-- EQUIPEMENTS_SETUP.sql
-- À exécuter UNE FOIS dans l'éditeur SQL Supabase

create table if not exists equipements (
  id           uuid primary key default gen_random_uuid(),
  fabricant    text,
  nom          text not null,
  modele       text,
  categorie    text,
  site         text,                  -- clmtp_sable | claisse_rail | stmf | null
  localisation text,
  code         text,
  numero_serie text,
  statut       text,
  valeur       numeric(12,2),
  assigne_a    text,
  notes        text,
  created_at   timestamptz default now()
);

alter table equipements enable row level security;

create policy "open" on equipements
  for all to anon, authenticated
  using (true) with check (true);
