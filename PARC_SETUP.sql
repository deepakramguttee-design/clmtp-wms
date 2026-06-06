-- PARC_SETUP.sql
-- À exécuter UNE FOIS dans l'éditeur SQL Supabase

create table if not exists parc_vehicules (
  id           bigserial primary key,
  num          text,
  name         text not null,
  modele       text,
  marque       text,
  immat        text,
  affectation  text,
  chauffeur    text,
  annee        text,
  serie        text,
  created_at   timestamptz default now()
);

alter table parc_vehicules enable row level security;

create policy "open" on parc_vehicules
  for all to anon, authenticated
  using (true) with check (true);
