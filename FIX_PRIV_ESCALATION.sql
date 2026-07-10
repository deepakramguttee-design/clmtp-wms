-- ============================================================
-- FIX CRITIQUE — Escalade de privilèges via utilisateurs (self-update)
-- Appliqué en production le 2026-07-10 (migration Supabase
-- `prevent_utilisateurs_privilege_self_escalation`, projet jtqlaiabxwbgwgduqzpl).
--
-- Problème : la policy RLS `utilisateurs_update` autorise le self-update
--   USING/WITH CHECK (auth_id = auth.uid() OR is_admin())
-- sans restriction de colonne, et le rôle `authenticated` a le GRANT UPDATE
-- sur role/site_id/permissions/actif. => n'importe quel utilisateur connecté
-- pouvait se promouvoir admin via PATCH direct sur l'API REST :
--   PATCH /rest/v1/utilisateurs?auth_id=eq.<son_uid>  body {"role":"admin"}
--
-- Correctif : trigger BEFORE UPDATE qui refuse toute modification des colonnes
-- privilégiées quand l'appelant est un utilisateur connecté non-admin.
--   * admin (session client, is_admin()=true)         -> autorisé
--   * service_role / edge functions (auth.uid()=NULL) -> autorisé
--   * utilisateur non-admin sur ses propres colonnes  -> BLOQUÉ
--   * colonnes non privilégiées (nom, prenom, email, derniere_connexion) -> OK
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_utilisateurs_priv_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF NEW.role        IS DISTINCT FROM OLD.role
       OR NEW.site_id     IS DISTINCT FROM OLD.site_id
       OR NEW.permissions IS DISTINCT FROM OLD.permissions
       OR NEW.actif       IS DISTINCT FROM OLD.actif THEN
      RAISE EXCEPTION 'Modification de champs privilégiés interdite (role, site_id, permissions, actif)'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_utilisateurs_priv_self_escalation ON public.utilisateurs;

CREATE TRIGGER trg_prevent_utilisateurs_priv_self_escalation
  BEFORE UPDATE ON public.utilisateurs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_utilisateurs_priv_self_escalation();

-- La fonction trigger ne doit pas être exposée en RPC (advisors 0028/0029).
-- Le trigger se déclenche indépendamment de ce privilège EXECUTE.
REVOKE EXECUTE ON FUNCTION public.prevent_utilisateurs_priv_self_escalation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_utilisateurs_priv_self_escalation() FROM anon;
REVOKE EXECUTE ON FUNCTION public.prevent_utilisateurs_priv_self_escalation() FROM authenticated;

-- ── Durcissement #4 — APPLIQUÉ en prod le 2026-07-10 ──
-- is_admin() n'a pas à être appelable en RPC par anon (advisor 0028, corrigé).
-- Conservé pour authenticated (requis par les policies RLS) et service_role.
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO service_role;

-- Note : les advisors 0029 restants (is_admin / get_my_role / get_my_site
-- exécutables par `authenticated`) sont VOULUS — indispensables à l'évaluation
-- des policies RLS dans le contexte de l'utilisateur connecté.
