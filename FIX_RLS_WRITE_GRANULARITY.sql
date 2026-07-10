-- ============================================================
-- FIX #2 — Granularité des écritures RLS (intégrité économique)
-- Appliqué en production le 2026-07-10
-- (migration Supabase `restrict_economic_tables_write_to_magasinier_plus`).
--
-- Problème : les policies d'écriture des tables économiques autorisaient
-- tout rôle <> 'lecteur' (donc technicien, preparateur) à modifier prix,
-- historiques de prix, lots d'achat (base de coût FIFO) et fournisseurs via
-- l'API REST — alors que l'UI réserve déjà ces écrans aux rôles magasinier+.
-- Risque : falsification économique / manipulation des coûts FIFO.
--
-- Correctif : écriture réservée à admin / magasinier / magasinier_preparateur.
-- La LECTURE reste ouverte à tous les authentifiés (consultation des prix OK).
--
-- Volontairement NON modifié (flux légitimes des rôles inférieurs) :
--   * mouvements, stock_overrides  -> sortie de pièces sur OR (handleSortirPiece,
--     accessible aux technicien/preparateur)
--   * ordres_reparation, equivalences, parc_vehicules, catalogues, etc.
--
-- Vérifié : un technicien est bloqué en écriture sur lots_achat ; un
-- magasinier/admin est autorisé.
-- ============================================================

DO $$ DECLARE tbl TEXT; BEGIN
  FOREACH tbl IN ARRAY ARRAY['prix_fournisseurs','historique_prix','lots_achat','fournisseurs'] LOOP
    EXECUTE 'DROP POLICY IF EXISTS "'||tbl||'_write" ON public.'||tbl;
    EXECUTE 'CREATE POLICY "'||tbl||'_write" ON public.'||tbl||' FOR ALL '
      ||'USING (auth.uid() IS NOT NULL AND get_my_role() IN (''admin'',''magasinier'',''magasinier_preparateur'')) '
      ||'WITH CHECK (auth.uid() IS NOT NULL AND get_my_role() IN (''admin'',''magasinier'',''magasinier_preparateur''))';
  END LOOP; END $$;
