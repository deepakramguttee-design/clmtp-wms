-- OR_TEMPS_SETUP.sql
-- À exécuter UNE FOIS dans l'éditeur SQL Supabase

create table if not exists or_temps_passe (
  id           bigserial primary key,
  or_id        text not null,
  type         text not null default 'Révision',
  technicien   text,
  date         date,
  duree_heures numeric(5,2),
  description  text,
  started_at   timestamptz,
  ended_at     timestamptz,
  statut       text default 'termine',
  created_at   timestamptz default now()
);

alter table or_temps_passe enable row level security;

create policy "open" on or_temps_passe
  for all to anon, authenticated
  using (true) with check (true);

-- Migration si la table existe déjà (idempotent)
alter table or_temps_passe alter column duree_heures drop not null;
alter table or_temps_passe add column if not exists started_at timestamptz;
alter table or_temps_passe add column if not exists ended_at   timestamptz;
alter table or_temps_passe add column if not exists statut     text default 'termine';
