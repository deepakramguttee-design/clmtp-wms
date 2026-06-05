-- CHANTIERS_SETUP.sql
-- À exécuter UNE FOIS dans l'éditeur SQL Supabase

create table if not exists chantiers (
  id           bigserial primary key,
  site_id      text not null,
  nom          text not null,
  code         text not null,
  client       text,
  localisation text,
  date_debut   date,
  date_fin     date,
  statut       text not null default 'planifie',
  budget       numeric(12,2),
  description  text,
  created_at   timestamptz default now()
);

create table if not exists chantier_materiels (
  id          bigserial primary key,
  chantier_id bigint references chantiers(id) on delete cascade,
  nom         text not null,
  type        text not null default 'Autre',
  qte         integer not null default 1,
  notes       text,
  created_at  timestamptz default now()
);

create table if not exists chantier_agents (
  id          bigserial primary key,
  chantier_id bigint references chantiers(id) on delete cascade,
  nom         text not null,
  role        text not null default 'Technicien',
  date_debut  date,
  date_fin    date,
  created_at  timestamptz default now()
);

create table if not exists chantier_depenses (
  id          bigserial primary key,
  chantier_id bigint references chantiers(id) on delete cascade,
  designation text not null,
  montant     numeric(12,2) not null,
  date        date,
  type        text not null default 'Autre',
  notes       text,
  created_at  timestamptz default now()
);

-- RLS : open policies (auth custom, pas Supabase Auth)
alter table chantiers          enable row level security;
alter table chantier_materiels enable row level security;
alter table chantier_agents    enable row level security;
alter table chantier_depenses  enable row level security;

create policy "open" on chantiers          for all using (true) with check (true);
create policy "open" on chantier_materiels for all using (true) with check (true);
create policy "open" on chantier_agents    for all using (true) with check (true);
create policy "open" on chantier_depenses  for all using (true) with check (true);
