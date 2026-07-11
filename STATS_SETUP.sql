-- ============================================================
-- STATS_SETUP.sql — Module Statistiques (Administration, admin only)
-- Agrégations côté serveur pour le dashboard analytique du WMS.
--
-- Modèle de sécurité :
--   • Fonctions SECURITY INVOKER (défaut) → le RLS de l'appelant s'applique.
--     Seul un admin voit les lignes tous-sites (branche is_admin() des policies).
--   • Garde en tête : RAISE EXCEPTION si NOT is_admin() (défense en profondeur).
--   • REVOKE anon + GRANT EXECUTE authenticated uniquement.
--   • Aucune fonction SECURITY DEFINER exposée ici (is_admin() est un helper
--     interne pré-existant, défini dans AUTH_RLS_MIGRATION.sql).
--
-- Conventions données (schéma live 2026-07) :
--   • mouvements.site_id NULL = clmtp_sable → normalisé via COALESCE.
--   • Valeur consommée = mouvements.cout_fifo (prix_unitaire est NULL sur sortie).
--   • Consommateur = sortie liée à un OR via mouvements.reference = ordres.numero.
--   • « Créateur d'OR » = ordres_reparation.technicien (pas de created_by en base).
--
-- Paramètres communs :
--   p_days  INT   nombre de jours glissants (NULL = tout l'historique)
--   p_site  TEXT  id de site (NULL = tous les sites)
-- Idempotent : CREATE OR REPLACE. À exécuter dans le SQL editor Supabase.
-- ============================================================

-- #1 — TOP produits les plus sortis (bar chart horizontal)
CREATE OR REPLACE FUNCTION stats_top_produits(p_days INT DEFAULT 90, p_site TEXT DEFAULT NULL, p_limit INT DEFAULT 20)
RETURNS TABLE(article_id TEXT, article_name TEXT, total_qte BIGINT, total_cout NUMERIC, nb_sorties BIGINT)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Accès réservé aux administrateurs'; END IF;
  RETURN QUERY
  SELECT m.article_id, max(m.article_name),
         sum(m.quantite)::BIGINT, COALESCE(sum(m.cout_fifo),0), count(*)::BIGINT
  FROM mouvements m
  WHERE m.type='sortie'
    AND (p_days IS NULL OR m.created_at >= now() - make_interval(days => p_days))
    AND (p_site IS NULL OR COALESCE(m.site_id,'clmtp_sable') = p_site)
  GROUP BY m.article_id
  ORDER BY 3 DESC
  LIMIT p_limit;
END $$;

-- #2 — TOP consommateurs (par machine OU technicien, sorties liées à un OR)
CREATE OR REPLACE FUNCTION stats_top_consommateurs(p_days INT DEFAULT 90, p_site TEXT DEFAULT NULL, p_dim TEXT DEFAULT 'machine', p_limit INT DEFAULT 15)
RETURNS TABLE(label TEXT, total_qte BIGINT, total_cout NUMERIC, nb_or BIGINT)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Accès réservé aux administrateurs'; END IF;
  RETURN QUERY
  SELECT COALESCE(NULLIF(CASE WHEN p_dim='technicien' THEN o.technicien ELSE o.machine END,''), '(non renseigné)'),
         sum(m.quantite)::BIGINT, COALESCE(sum(m.cout_fifo),0), count(DISTINCT o.numero)::BIGINT
  FROM mouvements m
  JOIN ordres_reparation o ON o.numero = m.reference
  WHERE m.type='sortie' AND m.reference <> ''
    AND (p_days IS NULL OR m.created_at >= now() - make_interval(days => p_days))
    AND (p_site IS NULL OR COALESCE(m.site_id,'clmtp_sable') = p_site)
  GROUP BY 1
  ORDER BY 3 DESC
  LIMIT p_limit;
END $$;

-- #3a — TOP « créateurs » d'OR (proxy = technicien)
CREATE OR REPLACE FUNCTION stats_or_par_technicien(p_days INT DEFAULT 365, p_site TEXT DEFAULT NULL, p_limit INT DEFAULT 15)
RETURNS TABLE(technicien TEXT, nb_or BIGINT)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Accès réservé aux administrateurs'; END IF;
  RETURN QUERY
  SELECT COALESCE(NULLIF(o.technicien,''),'(non renseigné)'), count(*)::BIGINT
  FROM ordres_reparation o
  WHERE (p_days IS NULL OR o.created_at >= now() - make_interval(days => p_days))
    AND (p_site IS NULL OR COALESCE(o.site_id,'clmtp_sable') = p_site)
  GROUP BY 1 ORDER BY 2 DESC LIMIT p_limit;
END $$;

-- #3b — Évolution mensuelle des OR (line chart, 12 mois glissants)
CREATE OR REPLACE FUNCTION stats_or_mensuel(p_months INT DEFAULT 12, p_site TEXT DEFAULT NULL)
RETURNS TABLE(mois DATE, nb_or BIGINT)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Accès réservé aux administrateurs'; END IF;
  RETURN QUERY
  WITH months AS (
    SELECT generate_series(date_trunc('month', now()) - make_interval(months => p_months-1),
                           date_trunc('month', now()), interval '1 month')::DATE AS mois)
  SELECT mm.mois, count(o.id)::BIGINT
  FROM months mm
  LEFT JOIN ordres_reparation o
    ON date_trunc('month', o.created_at)::DATE = mm.mois
   AND (p_site IS NULL OR COALESCE(o.site_id,'clmtp_sable') = p_site)
  GROUP BY mm.mois ORDER BY mm.mois;
END $$;

-- #4 — Volume de sorties par mois (line chart, 12 mois : quantité + valeur)
CREATE OR REPLACE FUNCTION stats_sorties_mensuel(p_months INT DEFAULT 12, p_site TEXT DEFAULT NULL)
RETURNS TABLE(mois DATE, total_qte BIGINT, total_cout NUMERIC)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Accès réservé aux administrateurs'; END IF;
  RETURN QUERY
  WITH months AS (
    SELECT generate_series(date_trunc('month', now()) - make_interval(months => p_months-1),
                           date_trunc('month', now()), interval '1 month')::DATE AS mois)
  SELECT mm.mois, COALESCE(sum(m.quantite),0)::BIGINT, COALESCE(sum(m.cout_fifo),0)
  FROM months mm
  LEFT JOIN mouvements m
    ON m.type='sortie' AND date_trunc('month', m.created_at)::DATE = mm.mois
   AND (p_site IS NULL OR COALESCE(m.site_id,'clmtp_sable') = p_site)
  GROUP BY mm.mois ORDER BY mm.mois;
END $$;

-- #5 — Répartition par site (pie / bar groupé)
CREATE OR REPLACE FUNCTION stats_par_site(p_days INT DEFAULT 90)
RETURNS TABLE(site TEXT, total_qte BIGINT, total_cout NUMERIC, nb_or BIGINT)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Accès réservé aux administrateurs'; END IF;
  RETURN QUERY
  WITH s AS (
    SELECT COALESCE(site_id,'clmtp_sable') site, sum(quantite) q, sum(cout_fifo) c
    FROM mouvements WHERE type='sortie'
      AND (p_days IS NULL OR created_at >= now() - make_interval(days => p_days))
    GROUP BY 1),
  o AS (
    SELECT COALESCE(site_id,'clmtp_sable') site, count(*) n
    FROM ordres_reparation
    WHERE (p_days IS NULL OR created_at >= now() - make_interval(days => p_days))
    GROUP BY 1)
  SELECT COALESCE(s.site,o.site), COALESCE(s.q,0)::BIGINT, COALESCE(s.c,0), COALESCE(o.n,0)::BIGINT
  FROM s FULL OUTER JOIN o USING (site);
END $$;

-- #6 — Cartes KPI (une ligne, mois courant)
CREATE OR REPLACE FUNCTION stats_kpi(p_site TEXT DEFAULT NULL)
RETURNS TABLE(sorties_mois BIGINT, cout_mois NUMERIC, nb_or_mois BIGINT, ref_top_id TEXT, ref_top_name TEXT, ref_top_qte BIGINT)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE d TIMESTAMPTZ := date_trunc('month', now());
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Accès réservé aux administrateurs'; END IF;
  RETURN QUERY
  SELECT
    (SELECT COALESCE(sum(quantite),0)::BIGINT FROM mouvements
       WHERE type='sortie' AND created_at>=d AND (p_site IS NULL OR COALESCE(site_id,'clmtp_sable')=p_site)),
    (SELECT COALESCE(sum(cout_fifo),0) FROM mouvements
       WHERE type='sortie' AND created_at>=d AND (p_site IS NULL OR COALESCE(site_id,'clmtp_sable')=p_site)),
    (SELECT count(*)::BIGINT FROM ordres_reparation
       WHERE created_at>=d AND (p_site IS NULL OR COALESCE(site_id,'clmtp_sable')=p_site)),
    t.article_id, t.article_name, t.total_qte
  FROM (SELECT article_id, max(article_name) article_name, sum(quantite)::BIGINT total_qte
        FROM mouvements WHERE type='sortie' AND created_at>=d
          AND (p_site IS NULL OR COALESCE(site_id,'clmtp_sable')=p_site)
        GROUP BY article_id ORDER BY 3 DESC LIMIT 1) t;
END $$;

-- ── Permissions : révoquer anon/public, autoriser authenticated ──────────────
-- La garde is_admin() interne restreint l'accès effectif aux administrateurs.
DO $$ DECLARE fn TEXT; BEGIN
  FOREACH fn IN ARRAY ARRAY['stats_top_produits(int,text,int)','stats_top_consommateurs(int,text,text,int)',
    'stats_or_par_technicien(int,text,int)','stats_or_mensuel(int,text)','stats_sorties_mensuel(int,text)',
    'stats_par_site(int)','stats_kpi(text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP; END $$;

-- ── VÉRIFICATION (exécuter séparément) ───────────────────────────────────────
-- Aucune fonction stats_* ne doit être SECURITY DEFINER :
-- SELECT proname, prosecdef FROM pg_proc
-- WHERE proname LIKE 'stats\_%' ORDER BY proname;
