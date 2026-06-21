-- ============================================================
-- AUTH RLS MIGRATION v2 — Revue sécurité complète
-- Corrections : auth.uid() IS NOT NULL, rôle lecteur read-only,
--               tables manquantes, vue security_invoker, storage.
-- À tester sur un projet/branche Supabase de dev en premier.
-- PRÉ-REQUIS : auth_id UUID UNIQUE sur utilisateurs, tous liés.
-- ============================================================

-- ── §B2 : FONCTIONS HELPER SECURITY DEFINER ─────────────────
-- Bypassent le RLS pour lire utilisateurs sans récursion.

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM utilisateurs
    WHERE auth_id = auth.uid() AND role = 'admin' AND actif = true
  )
$$;

CREATE OR REPLACE FUNCTION get_my_site()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT site_id FROM utilisateurs
  WHERE auth_id = auth.uid() AND actif = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT role FROM utilisateurs
  WHERE auth_id = auth.uid() AND actif = true
  LIMIT 1
$$;

-- ── §B4 : utilisateurs ──────────────────────────────────────

ALTER TABLE utilisateurs ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename='utilisateurs' LOOP
    EXECUTE 'DROP POLICY IF EXISTS '||quote_ident(r.policyname)||' ON utilisateurs';
  END LOOP; END $$;

CREATE POLICY "utilisateurs_select" ON utilisateurs
  FOR SELECT USING (auth_id = auth.uid() OR is_admin());

CREATE POLICY "utilisateurs_insert" ON utilisateurs
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "utilisateurs_update" ON utilisateurs
  FOR UPDATE USING  (auth_id = auth.uid() OR is_admin())
  WITH CHECK        (auth_id = auth.uid() OR is_admin());

CREATE POLICY "utilisateurs_delete" ON utilisateurs
  FOR DELETE USING (is_admin());

-- ── §B4 : user_permissions ───────────────────────────────────

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename='user_permissions' LOOP
    EXECUTE 'DROP POLICY IF EXISTS '||quote_ident(r.policyname)||' ON user_permissions';
  END LOOP; END $$;

CREATE POLICY "user_permissions_select" ON user_permissions
  FOR SELECT USING (
    user_id = (SELECT id FROM utilisateurs WHERE auth_id = auth.uid())
    OR is_admin()
  );

CREATE POLICY "user_permissions_write" ON user_permissions
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ── §B3 : mouvements (site_id nullable — clmtp_sable = NULL) ─

ALTER TABLE mouvements ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename='mouvements' LOOP
    EXECUTE 'DROP POLICY IF EXISTS '||quote_ident(r.policyname)||' ON mouvements';
  END LOOP; END $$;

CREATE POLICY "mouvements_select" ON mouvements FOR SELECT
  USING (auth.uid() IS NOT NULL
    AND (site_id = get_my_site() OR is_admin()));

CREATE POLICY "mouvements_write" ON mouvements FOR ALL
  USING (auth.uid() IS NOT NULL AND get_my_role() <> 'lecteur'
    AND (site_id = get_my_site() OR is_admin()))
  WITH CHECK (auth.uid() IS NOT NULL AND get_my_role() <> 'lecteur'
    AND (site_id = get_my_site() OR is_admin()));

-- ── §B3 : stock_overrides (site_id présent — cloisonné par site)
-- Diagnostic 2026-06-21 : 36 lignes, 0 NULL, toutes site_id='clmtp_sable'.
-- La colonne site_id a été ajoutée post-setup. Cloisonnement direct activé.

ALTER TABLE stock_overrides ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename='stock_overrides' LOOP
    EXECUTE 'DROP POLICY IF EXISTS '||quote_ident(r.policyname)||' ON stock_overrides';
  END LOOP; END $$;

CREATE POLICY "stock_overrides_select" ON stock_overrides FOR SELECT
  USING (auth.uid() IS NOT NULL AND (site_id = get_my_site() OR is_admin()));

CREATE POLICY "stock_overrides_write" ON stock_overrides FOR ALL
  USING (auth.uid() IS NOT NULL AND get_my_role() <> 'lecteur'
    AND (site_id = get_my_site() OR is_admin()))
  WITH CHECK (auth.uid() IS NOT NULL AND get_my_role() <> 'lecteur'
    AND (site_id = get_my_site() OR is_admin()));

-- ── §B3 : Tables scopées par site_id ─────────────────────────
-- ordres_reparation, catalogues, locations, prets, chantiers

DO $$ DECLARE tbl TEXT; r RECORD; BEGIN
  FOREACH tbl IN ARRAY ARRAY['ordres_reparation','catalogues','locations','prets','chantiers'] LOOP
    EXECUTE 'ALTER TABLE '||tbl||' ENABLE ROW LEVEL SECURITY';
    FOR r IN SELECT policyname FROM pg_policies WHERE tablename=tbl LOOP
      EXECUTE 'DROP POLICY IF EXISTS '||quote_ident(r.policyname)||' ON '||tbl; END LOOP;
    EXECUTE 'CREATE POLICY "'||tbl||'_select" ON '||tbl||' FOR SELECT '
      ||'USING (auth.uid() IS NOT NULL AND (site_id=get_my_site() OR is_admin()))';
    EXECUTE 'CREATE POLICY "'||tbl||'_write" ON '||tbl||' FOR ALL '
      ||'USING (auth.uid() IS NOT NULL AND get_my_role()<>''lecteur'''
      ||' AND (site_id=get_my_site() OR is_admin())) '
      ||'WITH CHECK (auth.uid() IS NOT NULL AND get_my_role()<>''lecteur'''
      ||' AND (site_id=get_my_site() OR is_admin()))';
  END LOOP; END $$;

-- ── §B3 : bons_commande (colonne site, pas site_id) ──────────

ALTER TABLE bons_commande ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename='bons_commande' LOOP
    EXECUTE 'DROP POLICY IF EXISTS '||quote_ident(r.policyname)||' ON bons_commande';
  END LOOP; END $$;

CREATE POLICY "bons_commande_select" ON bons_commande FOR SELECT
  USING (auth.uid() IS NOT NULL AND (site = get_my_site() OR is_admin()));

CREATE POLICY "bons_commande_write" ON bons_commande FOR ALL
  USING (auth.uid() IS NOT NULL AND get_my_role() <> 'lecteur'
    AND (site = get_my_site() OR is_admin()))
  WITH CHECK (auth.uid() IS NOT NULL AND get_my_role() <> 'lecteur'
    AND (site = get_my_site() OR is_admin()));

-- ── §B3 : bons_commande_lignes (FK → bons_commande) ──────────

ALTER TABLE bons_commande_lignes ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename='bons_commande_lignes' LOOP
    EXECUTE 'DROP POLICY IF EXISTS '||quote_ident(r.policyname)||' ON bons_commande_lignes';
  END LOOP; END $$;

CREATE POLICY "bons_commande_lignes_select" ON bons_commande_lignes FOR SELECT
  USING (auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM bons_commande bc
      WHERE bc.id = bons_commande_lignes.bon_commande_id
        AND (bc.site = get_my_site() OR is_admin())));

CREATE POLICY "bons_commande_lignes_write" ON bons_commande_lignes FOR ALL
  USING (auth.uid() IS NOT NULL AND get_my_role() <> 'lecteur'
    AND EXISTS (SELECT 1 FROM bons_commande bc
      WHERE bc.id = bons_commande_lignes.bon_commande_id
        AND (bc.site = get_my_site() OR is_admin())))
  WITH CHECK (auth.uid() IS NOT NULL AND get_my_role() <> 'lecteur'
    AND EXISTS (SELECT 1 FROM bons_commande bc
      WHERE bc.id = bons_commande_lignes.bon_commande_id
        AND (bc.site = get_my_site() OR is_admin())));

-- ── §B3 : ddv_fournisseurs (FK → bons_commande) ─────────────

ALTER TABLE ddv_fournisseurs ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename='ddv_fournisseurs' LOOP
    EXECUTE 'DROP POLICY IF EXISTS '||quote_ident(r.policyname)||' ON ddv_fournisseurs';
  END LOOP; END $$;

CREATE POLICY "ddv_fournisseurs_select" ON ddv_fournisseurs FOR SELECT
  USING (auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM bons_commande bc
      WHERE bc.id = ddv_fournisseurs.bon_commande_id
        AND (bc.site = get_my_site() OR is_admin())));

CREATE POLICY "ddv_fournisseurs_write" ON ddv_fournisseurs FOR ALL
  USING (auth.uid() IS NOT NULL AND get_my_role() <> 'lecteur'
    AND EXISTS (SELECT 1 FROM bons_commande bc
      WHERE bc.id = ddv_fournisseurs.bon_commande_id
        AND (bc.site = get_my_site() OR is_admin())))
  WITH CHECK (auth.uid() IS NOT NULL AND get_my_role() <> 'lecteur'
    AND EXISTS (SELECT 1 FROM bons_commande bc
      WHERE bc.id = ddv_fournisseurs.bon_commande_id
        AND (bc.site = get_my_site() OR is_admin())));

-- ── §B3 : Enfants de chantiers (FK → chantiers.site_id) ──────

DO $$ DECLARE tbl TEXT; r RECORD; BEGIN
  FOREACH tbl IN ARRAY ARRAY['chantier_materiels','chantier_agents','chantier_depenses'] LOOP
    EXECUTE 'ALTER TABLE '||tbl||' ENABLE ROW LEVEL SECURITY';
    FOR r IN SELECT policyname FROM pg_policies WHERE tablename=tbl LOOP
      EXECUTE 'DROP POLICY IF EXISTS '||quote_ident(r.policyname)||' ON '||tbl; END LOOP;
    EXECUTE 'CREATE POLICY "'||tbl||'_select" ON '||tbl||' FOR SELECT USING ('
      ||'auth.uid() IS NOT NULL AND EXISTS ('
      ||'  SELECT 1 FROM chantiers c WHERE c.id='||tbl||'.chantier_id'
      ||'  AND (c.site_id=get_my_site() OR is_admin())))';
    EXECUTE 'CREATE POLICY "'||tbl||'_write" ON '||tbl||' FOR ALL USING ('
      ||'auth.uid() IS NOT NULL AND get_my_role()<>''lecteur'' AND EXISTS ('
      ||'  SELECT 1 FROM chantiers c WHERE c.id='||tbl||'.chantier_id'
      ||'  AND (c.site_id=get_my_site() OR is_admin()))) '
      ||'WITH CHECK ('
      ||'auth.uid() IS NOT NULL AND get_my_role()<>''lecteur'' AND EXISTS ('
      ||'  SELECT 1 FROM chantiers c WHERE c.id='||tbl||'.chantier_id'
      ||'  AND (c.site_id=get_my_site() OR is_admin())))';
  END LOOP; END $$;

-- ── §B3 : equipements (global — visible par tous les sites) ──
-- Décision 2026-06-21 : pas de cloisonnement par site.
-- 102 lignes, colonne site présente mais ignorée pour le RLS.

ALTER TABLE equipements ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename='equipements' LOOP
    EXECUTE 'DROP POLICY IF EXISTS '||quote_ident(r.policyname)||' ON equipements';
  END LOOP; END $$;

CREATE POLICY "equipements_select" ON equipements FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "equipements_write" ON equipements FOR ALL
  USING (auth.uid() IS NOT NULL AND get_my_role() <> 'lecteur')
  WITH CHECK (auth.uid() IS NOT NULL AND get_my_role() <> 'lecteur');

-- ── §B3 : Tables globales (pas de site_id) ───────────────────
-- equivalences, prix_fournisseurs, historique_prix, lots_achat,
-- fournisseurs, or_temps_passe, parc_vehicules

DO $$ DECLARE tbl TEXT; r RECORD; BEGIN
  FOREACH tbl IN ARRAY ARRAY['equivalences','prix_fournisseurs','historique_prix',
    'lots_achat','fournisseurs','or_temps_passe','parc_vehicules'] LOOP
    EXECUTE 'ALTER TABLE '||tbl||' ENABLE ROW LEVEL SECURITY';
    FOR r IN SELECT policyname FROM pg_policies WHERE tablename=tbl LOOP
      EXECUTE 'DROP POLICY IF EXISTS '||quote_ident(r.policyname)||' ON '||tbl; END LOOP;
    EXECUTE 'CREATE POLICY "'||tbl||'_select" ON '||tbl
      ||' FOR SELECT USING (auth.uid() IS NOT NULL)';
    EXECUTE 'CREATE POLICY "'||tbl||'_write" ON '||tbl||' FOR ALL '
      ||'USING (auth.uid() IS NOT NULL AND get_my_role()<>''lecteur'') '
      ||'WITH CHECK (auth.uid() IS NOT NULL AND get_my_role()<>''lecteur'')';
  END LOOP; END $$;

-- ── §B5 : Tables de référence (lecture auth, écriture admin) ──
-- filtration_vehicules, filtration_engins, parc_categories, vues_eclatees

DO $$ DECLARE tbl TEXT; r RECORD; BEGIN
  FOREACH tbl IN ARRAY ARRAY['filtration_vehicules','filtration_engins',
    'parc_categories','vues_eclatees'] LOOP
    EXECUTE 'ALTER TABLE '||tbl||' ENABLE ROW LEVEL SECURITY';
    FOR r IN SELECT policyname FROM pg_policies WHERE tablename=tbl LOOP
      EXECUTE 'DROP POLICY IF EXISTS '||quote_ident(r.policyname)||' ON '||tbl; END LOOP;
    EXECUTE 'CREATE POLICY "'||tbl||'_select" ON '||tbl
      ||' FOR SELECT USING (auth.uid() IS NOT NULL)';
    EXECUTE 'CREATE POLICY "'||tbl||'_write" ON '||tbl
      ||' FOR ALL USING (is_admin()) WITH CHECK (is_admin())';
  END LOOP; END $$;

-- ── §B5 : tarifs_techniciens — SENSIBLE (taux horaires) ──────
-- Lecture : tous les authentifiés. Écriture : admin uniquement.

ALTER TABLE tarifs_techniciens ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename='tarifs_techniciens' LOOP
    EXECUTE 'DROP POLICY IF EXISTS '||quote_ident(r.policyname)||' ON tarifs_techniciens';
  END LOOP; END $$;

CREATE POLICY "tarifs_techniciens_select" ON tarifs_techniciens FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "tarifs_techniciens_write" ON tarifs_techniciens FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- ── §B5 : Tables optionnelles (si elles existent en base) ────
-- ddv et ddv_lignes : non définies localement, appliquer si présentes.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='ddv') THEN
    EXECUTE 'ALTER TABLE ddv ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "ddv_select" ON ddv';
    EXECUTE 'DROP POLICY IF EXISTS "ddv_write"  ON ddv';
    EXECUTE 'CREATE POLICY "ddv_select" ON ddv FOR SELECT USING (auth.uid() IS NOT NULL)';
    EXECUTE 'CREATE POLICY "ddv_write" ON ddv FOR ALL '
      ||'USING (auth.uid() IS NOT NULL AND get_my_role()<>''lecteur'') '
      ||'WITH CHECK (auth.uid() IS NOT NULL AND get_my_role()<>''lecteur'')';
    RAISE NOTICE 'ddv : policies appliquées.';
  ELSE RAISE NOTICE 'ddv : table absente, ignorée.'; END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='ddv_lignes') THEN
    EXECUTE 'ALTER TABLE ddv_lignes ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "ddv_lignes_select" ON ddv_lignes';
    EXECUTE 'DROP POLICY IF EXISTS "ddv_lignes_write"  ON ddv_lignes';
    EXECUTE 'CREATE POLICY "ddv_lignes_select" ON ddv_lignes FOR SELECT USING (auth.uid() IS NOT NULL)';
    EXECUTE 'CREATE POLICY "ddv_lignes_write" ON ddv_lignes FOR ALL '
      ||'USING (auth.uid() IS NOT NULL AND get_my_role()<>''lecteur'') '
      ||'WITH CHECK (auth.uid() IS NOT NULL AND get_my_role()<>''lecteur'')';
    RAISE NOTICE 'ddv_lignes : policies appliquées.';
  ELSE RAISE NOTICE 'ddv_lignes : table absente, ignorée.'; END IF;
END $$;

-- ── §B5 : VUES ───────────────────────────────────────────────

-- mon_profil : tourne en SECURITY DEFINER (owner bypasse RLS sur utilisateurs)
-- auth.uid() dans le WHERE reste celui du caller — comportement voulu.
CREATE OR REPLACE VIEW mon_profil AS
SELECT id, nom, prenom, email, role, actif, site_id, derniere_connexion
FROM utilisateurs
WHERE auth_id = auth.uid();

-- vue_stock_critique : passer en SECURITY INVOKER (RLS du caller s'applique)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='vue_stock_critique') THEN
    EXECUTE 'ALTER VIEW vue_stock_critique SET (security_invoker = on)';
    RAISE NOTICE 'vue_stock_critique : security_invoker activé.';
  ELSE RAISE NOTICE 'vue_stock_critique : absente, ignorée.'; END IF;
END $$;

-- ── §B5 : STORAGE bucket vues-eclatees ───────────────────────
-- Retire les policies d'accès public et rend le bucket privé.

DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND (qual ILIKE '%vues-eclatees%' OR with_check ILIKE '%vues-eclatees%')
  LOOP
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS '||quote_ident(r.policyname)||' ON storage.objects';
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

UPDATE storage.buckets SET public = false WHERE name = 'vues-eclatees';

CREATE POLICY "vues_eclatees_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'vues-eclatees' AND auth.uid() IS NOT NULL);

CREATE POLICY "vues_eclatees_write" ON storage.objects
  FOR ALL USING    (bucket_id = 'vues-eclatees' AND is_admin())
  WITH CHECK       (bucket_id = 'vues-eclatees' AND is_admin());

-- ── VÉRIFICATION (à exécuter séparément après application) ───

-- 1. Toutes les policies — aucune ne doit avoir USING(true) :
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies WHERE schemaname='public'
-- ORDER BY tablename, cmd;

-- 2. Tables public sans aucune policy (doit retourner 0 lignes) :
-- SELECT t.tablename FROM pg_tables t
-- LEFT JOIN pg_policies p ON p.tablename=t.tablename AND p.schemaname='public'
-- WHERE t.schemaname='public' AND p.policyname IS NULL;

-- 3. Tables avec RLS désactivé (doit retourner 0 lignes) :
-- SELECT relname FROM pg_class
-- WHERE relnamespace='public'::regnamespace AND relkind='r' AND NOT relrowsecurity;
