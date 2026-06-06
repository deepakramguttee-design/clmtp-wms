-- TARIFS_SETUP.sql
-- À exécuter UNE FOIS dans l'éditeur SQL Supabase

create table if not exists tarifs_techniciens (
  id           bigserial primary key,
  technicien   text not null unique,
  taux_horaire numeric(8,2) not null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table tarifs_techniciens enable row level security;

create policy "open" on tarifs_techniciens
  for all to anon, authenticated
  using (true) with check (true);
