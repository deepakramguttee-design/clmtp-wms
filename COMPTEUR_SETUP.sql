-- COMPTEUR_SETUP.sql
-- À exécuter dans l'éditeur SQL Supabase

ALTER TABLE ordres_reparation ADD COLUMN IF NOT EXISTS kilometrage    integer;
ALTER TABLE ordres_reparation ADD COLUMN IF NOT EXISTS heures_moteur  numeric(8,1);
ALTER TABLE ordres_reparation ADD COLUMN IF NOT EXISTS type_compteur  text default 'km';
