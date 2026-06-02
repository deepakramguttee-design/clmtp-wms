-- ════════════════════════════════════════════════════════════
-- LogiWMS — Script de création des tables Supabase
-- Copiez et collez ce script dans l'éditeur SQL de Supabase
-- ════════════════════════════════════════════════════════════

-- 1. Mouvements de stock (entrées/sorties)
CREATE TABLE IF NOT EXISTS mouvements (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  type        TEXT NOT NULL CHECK (type IN ('entree', 'sortie')),
  article_id  TEXT NOT NULL,
  article_name TEXT NOT NULL,
  fournisseur TEXT DEFAULT '',
  quantite    INTEGER NOT NULL,
  stock_avant INTEGER NOT NULL,
  stock_apres INTEGER NOT NULL,
  motif       TEXT DEFAULT '',
  reference   TEXT DEFAULT ''
);

-- 2. Stock réel (overrides par rapport à l'import Excel)
CREATE TABLE IF NOT EXISTS stock_overrides (
  article_id  TEXT PRIMARY KEY,
  stock       INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Équivalences entre références
CREATE TABLE IF NOT EXISTS equivalences (
  id            BIGSERIAL PRIMARY KEY,
  article_id    TEXT NOT NULL,
  equivalent_id TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_id, equivalent_id)
);

-- 4. Ordres de réparation
CREATE TABLE IF NOT EXISTS ordres_reparation (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  date_cloture TIMESTAMPTZ,
  numero       TEXT NOT NULL UNIQUE,
  statut       TEXT DEFAULT 'ouvert' CHECK (statut IN ('ouvert','en_cours','en_attente','termine','annule')),
  machine      TEXT NOT NULL,
  immat        TEXT DEFAULT '',
  type_panne   TEXT NOT NULL,
  technicien   TEXT DEFAULT '',
  priorite     TEXT DEFAULT 'normale' CHECK (priorite IN ('urgente','haute','normale')),
  description  TEXT DEFAULT '',
  pieces       JSONB DEFAULT '[]',
  notes        TEXT DEFAULT ''
);

-- 5. Activer la sécurité (lecture publique, écriture publique pour l'instant)
ALTER TABLE mouvements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_overrides   ENABLE ROW LEVEL SECURITY;
ALTER TABLE equivalences      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordres_reparation ENABLE ROW LEVEL SECURITY;

-- Policies : accès total pour les utilisateurs authentifiés ET anonymes
CREATE POLICY "Accès total mouvements"        ON mouvements        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Accès total stock_overrides"   ON stock_overrides   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Accès total equivalences"      ON equivalences      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Accès total ordres_reparation" ON ordres_reparation FOR ALL USING (true) WITH CHECK (true);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_mouvements_article    ON mouvements(article_id);
CREATE INDEX IF NOT EXISTS idx_mouvements_created    ON mouvements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_equivalences_article  ON equivalences(article_id);
CREATE INDEX IF NOT EXISTS idx_ordres_statut         ON ordres_reparation(statut);

-- ════════════════════════════════════════════════════════════
-- Tables supplémentaires — Gestion des prix
-- ════════════════════════════════════════════════════════════

-- Prix par fournisseur
CREATE TABLE IF NOT EXISTS prix_fournisseurs (
  id               BIGSERIAL PRIMARY KEY,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  article_id       TEXT NOT NULL,
  article_name     TEXT NOT NULL,
  fournisseur      TEXT NOT NULL,
  prix_ht          NUMERIC(10,2) NOT NULL,
  devise           TEXT DEFAULT 'EUR',
  delai_livraison  INTEGER DEFAULT 0,
  quantite_min     INTEGER DEFAULT 1,
  notes            TEXT DEFAULT '',
  actif            BOOLEAN DEFAULT true
);

-- Historique des fluctuations de prix
CREATE TABLE IF NOT EXISTS historique_prix (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  article_id   TEXT NOT NULL,
  article_name TEXT NOT NULL,
  fournisseur  TEXT NOT NULL,
  ancien_prix  NUMERIC(10,2),
  nouveau_prix NUMERIC(10,2) NOT NULL,
  motif        TEXT DEFAULT ''
);

-- Sécurité
ALTER TABLE prix_fournisseurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE historique_prix   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acces_prix_fournisseurs" ON prix_fournisseurs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acces_historique_prix"   ON historique_prix   FOR ALL USING (true) WITH CHECK (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_prix_article    ON prix_fournisseurs(article_id);
CREATE INDEX IF NOT EXISTS idx_historique_article ON historique_prix(article_id);
