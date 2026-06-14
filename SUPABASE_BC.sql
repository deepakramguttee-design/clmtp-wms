-- =====================================================
-- BONS DE COMMANDE — Migration Supabase
-- À exécuter une fois dans l'éditeur SQL Supabase
-- =====================================================

-- 1. TABLE FOURNISSEURS
CREATE TABLE IF NOT EXISTS fournisseurs (
  id        BIGSERIAL PRIMARY KEY,
  nom       TEXT NOT NULL,
  email     TEXT DEFAULT '',
  telephone TEXT DEFAULT '',
  adresse   TEXT DEFAULT '',
  notes     TEXT DEFAULT '',
  actif     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Fournisseurs connus du projet
INSERT INTO fournisseurs (nom) VALUES
  ('KRAMP'), ('GUILIANI'), ('ADPL'), ('HYDROKIT'),
  ('VISSERIE SERVICE'), ('AD SABLE'), ('MDA'), ('CCMB'),
  ('CLAISSE'), ('NORTON'), ('TOTAL ENERGIES'), ('CASTROL')
ON CONFLICT (nom) DO NOTHING;

-- 2. TABLE BONS DE COMMANDE
CREATE TABLE IF NOT EXISTS bons_commande (
  id             BIGSERIAL PRIMARY KEY,
  numero         TEXT UNIQUE,
  fournisseur_id BIGINT REFERENCES fournisseurs(id) ON DELETE SET NULL,
  fournisseur_nom TEXT NOT NULL DEFAULT '',
  site           TEXT NOT NULL CHECK (site IN ('clmtp_sable','claisse_rail','stmf')),
  date_creation  TIMESTAMPTZ DEFAULT now(),
  statut         TEXT NOT NULL DEFAULT 'brouillon'
                   CHECK (statut IN ('brouillon','envoye','recu')),
  created_by     TEXT DEFAULT '',
  total_ht       NUMERIC(12,2) DEFAULT 0,
  total_ttc      NUMERIC(12,2) DEFAULT 0,
  notes          TEXT DEFAULT '',
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- 3. TABLE LIGNES
CREATE TABLE IF NOT EXISTS bons_commande_lignes (
  id             BIGSERIAL PRIMARY KEY,
  bon_commande_id BIGINT NOT NULL REFERENCES bons_commande(id) ON DELETE CASCADE,
  reference      TEXT DEFAULT '',
  designation    TEXT NOT NULL,
  quantite       NUMERIC(10,3) NOT NULL DEFAULT 1,
  prix_unitaire  NUMERIC(12,2) NOT NULL DEFAULT 0,
  montant_ligne  NUMERIC(12,2) NOT NULL DEFAULT 0,
  source         TEXT DEFAULT 'libre'
                   CHECK (source IN ('catalogue_milwaukee','filtration','libre','ref_unified','designation')),
  ordre          INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_bc_site     ON bons_commande(site);
CREATE INDEX IF NOT EXISTS idx_bc_statut   ON bons_commande(statut);
CREATE INDEX IF NOT EXISTS idx_bcl_bc_id   ON bons_commande_lignes(bon_commande_id);
CREATE INDEX IF NOT EXISTS idx_bcl_ordre   ON bons_commande_lignes(bon_commande_id, ordre);
