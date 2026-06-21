-- ============================================================
-- RLS_ROLLBACK.sql — Rollback d'urgence
-- À coller dans l'éditeur SQL Supabase si le RLS te verrouille.
-- Rouvre tout en USING(true) — identique à l'état pré-migration.
-- NE MODIFIE PAS la structure ni les données.
-- ============================================================

DO $$ DECLARE tbl TEXT; r RECORD; BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'mouvements','stock_overrides','equivalences','ordres_reparation',
    'prix_fournisseurs','historique_prix','utilisateurs','user_permissions',
    'catalogues','locations','prets','lots_achat','fournisseurs',
    'chantiers','chantier_materiels','chantier_agents','chantier_depenses',
    'equipements','bons_commande','bons_commande_lignes','ddv_fournisseurs',
    'or_temps_passe','parc_vehicules','tarifs_techniciens',
    'filtration_vehicules','filtration_engins','parc_categories','vues_eclatees'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=tbl) THEN
      FOR r IN SELECT policyname FROM pg_policies WHERE tablename=tbl AND schemaname='public' LOOP
        EXECUTE 'DROP POLICY IF EXISTS '||quote_ident(r.policyname)||' ON '||tbl;
      END LOOP;
      EXECUTE 'ALTER TABLE '||tbl||' ENABLE ROW LEVEL SECURITY';
      EXECUTE 'CREATE POLICY "rollback_open" ON '||tbl||' FOR ALL USING (true) WITH CHECK (true)';
      RAISE NOTICE '% : policy ouverte restaurée', tbl;
    ELSE
      RAISE NOTICE '% : absente, ignorée', tbl;
    END IF;
  END LOOP;
END $$;

-- Tables optionnelles (existantes uniquement en live)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='ddv') THEN
    DROP POLICY IF EXISTS "ddv_select" ON ddv;
    DROP POLICY IF EXISTS "ddv_write"  ON ddv;
    CREATE POLICY "rollback_open" ON ddv FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='ddv_lignes') THEN
    DROP POLICY IF EXISTS "ddv_lignes_select" ON ddv_lignes;
    DROP POLICY IF EXISTS "ddv_lignes_write"  ON ddv_lignes;
    CREATE POLICY "rollback_open" ON ddv_lignes FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Storage : rouvre le bucket vues-eclatees en public
UPDATE storage.buckets SET public = true WHERE name = 'vues-eclatees';

-- Vérification immédiate : doit lister toutes les tables avec "rollback_open"
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND policyname = 'rollback_open'
ORDER BY tablename;
