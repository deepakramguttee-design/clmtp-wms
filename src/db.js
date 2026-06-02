// ── BASE DE DONNÉES SUPABASE ──────────────────────────────────────────────────
// Toutes les fonctions pour lire/écrire les données partagées

import { supabase } from './supabase.js'

// ── MOUVEMENTS ────────────────────────────────────────────────────────────────
export async function getMouvements() {
  const { data, error } = await supabase
    .from('mouvements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) { console.error(error); return []; }
  return data || []
}

export async function addMouvement(m) {
  const { data, error } = await supabase
    .from('mouvements')
    .insert([{
      type: m.type,
      article_id: m.articleId,
      article_name: m.articleName,
      fournisseur: m.fournisseur,
      quantite: m.quantite,
      stock_avant: m.stockAvant,
      stock_apres: m.stockApres,
      motif: m.motif || '',
      reference: m.reference || '',
    }])
    .select()
  if (error) { console.error(error); return null; }
  return data?.[0]
}

// ── STOCK OVERRIDES ───────────────────────────────────────────────────────────
export async function getStockOverrides() {
  const { data, error } = await supabase
    .from('stock_overrides')
    .select('*')
  if (error) { console.error(error); return {}; }
  const map = {}
  ;(data || []).forEach(r => { map[r.article_id] = r.stock })
  return map
}

export async function setStockOverride(articleId, stock) {
  const { error } = await supabase
    .from('stock_overrides')
    .upsert({ article_id: articleId, stock }, { onConflict: 'article_id' })
  if (error) console.error(error)
}

// ── ÉQUIVALENCES ──────────────────────────────────────────────────────────────
export async function getEquivalences() {
  const { data, error } = await supabase
    .from('equivalences')
    .select('*')
  if (error) { console.error(error); return {}; }
  const map = {}
  ;(data || []).forEach(r => {
    if (!map[r.article_id]) map[r.article_id] = []
    map[r.article_id].push(r.equivalent_id)
  })
  return map
}

export async function addEquivalence(articleId, equivalentId) {
  await supabase.from('equivalences').insert([
    { article_id: articleId, equivalent_id: equivalentId },
    { article_id: equivalentId, equivalent_id: articleId },
  ])
}

export async function removeEquivalence(articleId, equivalentId) {
  await supabase.from('equivalences')
    .delete()
    .or(`and(article_id.eq.${articleId},equivalent_id.eq.${equivalentId}),and(article_id.eq.${equivalentId},equivalent_id.eq.${articleId})`)
}

// ── ORDRES DE RÉPARATION ──────────────────────────────────────────────────────
export async function getOrdres() {
  const { data, error } = await supabase
    .from('ordres_reparation')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error(error); return []; }
  return (data || []).map(r => ({
    id: r.id,
    numero: r.numero,
    dateOuverture: r.created_at,
    dateCloture: r.date_cloture,
    statut: r.statut,
    machine: r.machine,
    immat: r.immat,
    typePanne: r.type_panne,
    technicien: r.technicien,
    priorite: r.priorite,
    description: r.description,
    pieces: r.pieces || [],
    notes: r.notes || '',
  }))
}

export async function createOrdre(ordre) {
  const { data, error } = await supabase
    .from('ordres_reparation')
    .insert([{
      numero: ordre.numero,
      statut: ordre.statut || 'ouvert',
      machine: ordre.machine,
      immat: ordre.immat || '',
      type_panne: ordre.typePanne || ordre.type_panne || '',
      technicien: ordre.technicien || '',
      priorite: ordre.priorite || 'normale',
      description: ordre.description || '',
      pieces: Array.isArray(ordre.pieces) ? ordre.pieces : [],
      notes: ordre.notes || '',
    }])
    .select()
  if (error) {
    console.error('createOrdre error:', JSON.stringify(error));
    alert('Erreur sauvegarde OR: ' + error.message);
    return null;
  }
  return data?.[0]
}

export async function updateOrdre(ordre) {
  const { error } = await supabase
    .from('ordres_reparation')
    .update({
      statut: ordre.statut,
      machine: ordre.machine,
      immat: ordre.immat || '',
      type_panne: ordre.typePanne,
      technicien: ordre.technicien || '',
      priorite: ordre.priorite,
      description: ordre.description || '',
      pieces: ordre.pieces,
      notes: ordre.notes || '',
      date_cloture: ordre.dateCloture,
    })
    .eq('id', ordre.id)
  if (error) console.error(error)
}

export async function deleteOrdre(id) {
  const { error } = await supabase
    .from('ordres_reparation')
    .delete()
    .eq('id', id)
  if (error) console.error(error)
}

// ── PRIX FOURNISSEURS ─────────────────────────────────────────────────────────
export async function getPrixFournisseurs() {
  const { data, error } = await supabase
    .from('prix_fournisseurs')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error(error); return []; }
  return data || []
}

export async function addPrixFournisseur(prix) {
  const { data, error } = await supabase
    .from('prix_fournisseurs')
    .insert([{
      article_id: prix.articleId,
      article_name: prix.articleName,
      fournisseur: prix.fournisseur,
      prix_ht: prix.prixHT,
      devise: prix.devise || 'EUR',
      delai_livraison: prix.delaiLivraison || 0,
      quantite_min: prix.quantiteMin || 1,
      notes: prix.notes || '',
      actif: true,
    }])
    .select()
  if (error) { console.error(error); return null; }
  return data?.[0]
}

export async function updatePrixFournisseur(id, updates) {
  const { error } = await supabase
    .from('prix_fournisseurs')
    .update(updates)
    .eq('id', id)
  if (error) console.error(error)
}

export async function deletePrixFournisseur(id) {
  const { error } = await supabase
    .from('prix_fournisseurs')
    .delete()
    .eq('id', id)
  if (error) console.error(error)
}

export async function getHistoriquePrix() {
  const { data, error } = await supabase
    .from('historique_prix')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) { console.error(error); return []; }
  return data || []
}

export async function addHistoriquePrix(h) {
  const { error } = await supabase
    .from('historique_prix')
    .insert([{
      article_id: h.articleId,
      article_name: h.articleName,
      fournisseur: h.fournisseur,
      ancien_prix: h.ancienPrix,
      nouveau_prix: h.nouveauPrix,
      motif: h.motif || '',
    }])
  if (error) console.error(error)
}

// ── UTILISATEURS ──────────────────────────────────────────────────────────────
export async function getUtilisateurs() {
  const { data, error } = await supabase
    .from('utilisateurs')
    .select('id,nom,prenom,email,mot_de_passe,role,actif,created_at,derniere_connexion,site_id,permissions')
    .order('created_at', { ascending: false })
  if (error) { console.error(error); return []; }
  return data || []
}

export async function loginUser(email, password) {
  try {
    // Récupérer d'abord par email uniquement
    const { data, error } = await supabase
      .from('utilisateurs')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('actif', true)

    if (error) { console.error('Login error:', error); return null; }
    if (!data || data.length === 0) { console.error('User not found'); return null; }

    const user = data[0];
    // Comparer le mot de passe
    if (user.mot_de_passe !== password) { console.error('Wrong password'); return null; }

    // Mettre à jour dernière connexion
    await supabase
      .from('utilisateurs')
      .update({ derniere_connexion: new Date().toISOString() })
      .eq('id', user.id)

    return user;
  } catch(e) {
    console.error('Login exception:', e);
    return null;
  }
}

export async function createUtilisateur(user) {
  const { data, error } = await supabase
    .from('utilisateurs')
    .insert([{
      nom: user.nom,
      prenom: user.prenom,
      email: user.email.toLowerCase().trim(),
      mot_de_passe: user.motDePasse,
      role: user.role,
      actif: true,
    }])
    .select()
  if (error) { console.error(error); return null; }
  return data?.[0]
}

export async function updateUtilisateur(id, updates) {
  const { error } = await supabase
    .from('utilisateurs')
    .update(updates)
    .eq('id', id)
  if (error) console.error(error)
}

export async function deleteUtilisateur(id) {
  const { error } = await supabase
    .from('utilisateurs')
    .delete()
    .eq('id', id)
  if (error) console.error(error)
}

// ── LOTS ACHAT (FIFO) ─────────────────────────────────────────────────────────
export async function getLotsArticle(articleId) {
  const { data, error } = await supabase
    .from('lots_achat')
    .select('*')
    .eq('article_id', articleId)
    .order('date_achat', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) { console.error(error); return []; }
  return data || []
}

export async function getAllLots() {
  const { data, error } = await supabase
    .from('lots_achat')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) { console.error(error); return []; }
  return data || []
}

export async function addLotAchat(lot) {
  const { data, error } = await supabase
    .from('lots_achat')
    .insert([{
      article_id:    lot.articleId,
      article_name:  lot.articleName,
      fournisseur:   lot.fournisseur || '',
      date_achat:    lot.dateAchat,
      qty_initiale:  lot.qty,
      qty_restante:  lot.qty,
      prix_unitaire: lot.prixUnitaire,
      devise:        lot.devise || 'EUR',
      reference_bon: lot.referenceBon || '',
      notes:         lot.notes || '',
      clos:          false,
    }])
    .select()
  if (error) { console.error('addLotAchat error:', error); return null; }
  return data?.[0]
}

export async function consommerFIFO(articleId, qtyAConsommer) {
  // Récupérer les lots ouverts dans l'ordre FIFO (plus ancien en premier)
  const { data: lots, error } = await supabase
    .from('lots_achat')
    .select('*')
    .eq('article_id', articleId)
    .eq('clos', false)
    .gt('qty_restante', 0)
    .order('date_achat', { ascending: true })
    .order('created_at', { ascending: true })

  if (error || !lots || lots.length === 0) return { consumed: [], totalCout: 0, qtyManquante: qtyAConsommer }

  let qtyRestante = qtyAConsommer
  let totalCout = 0
  const consumed = []

  for (const lot of lots) {
    if (qtyRestante <= 0) break
    const qtyPrise = Math.min(qtyRestante, lot.qty_restante)
    const nouvelleQtyRestante = lot.qty_restante - qtyPrise
    const clos = nouvelleQtyRestante === 0

    await supabase.from('lots_achat').update({
      qty_restante: nouvelleQtyRestante,
      clos,
    }).eq('id', lot.id)

    totalCout += qtyPrise * lot.prix_unitaire
    consumed.push({ lot, qtyPrise, prixUnit: lot.prix_unitaire })
    qtyRestante -= qtyPrise
  }

  return { consumed, totalCout: Math.round(totalCout * 100) / 100, qtyManquante: qtyRestante }
}

export async function updateLotAchat(id, updates) {
  const { error } = await supabase.from('lots_achat').update(updates).eq('id', id)
  if (error) console.error(error)
}

export async function deleteLotAchat(id) {
  const { error } = await supabase.from('lots_achat').delete().eq('id', id)
  if (error) console.error(error)
}

// ── MULTI-SITES ───────────────────────────────────────────────────────────────
export async function loginUserMultiSite(email, password, siteId) {
  try {
    const { data, error } = await supabase
      .from('utilisateurs')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('actif', true)
      .eq('site_id', siteId)
    if (error || !data || data.length === 0) return null
    const user = data[0]
    if (user.mot_de_passe !== password) return null
    await supabase.from('utilisateurs').update({ derniere_connexion: new Date().toISOString() }).eq('id', user.id)
    // Charger les permissions custom depuis user_permissions
    const { data: permsData } = await supabase
      .from('user_permissions')
      .select('modules')
      .eq('user_id', user.id)
      .limit(1)
    if (permsData?.[0]?.modules) {
      user.permissions = permsData[0].modules
    }
    return user
  } catch(e) { console.error(e); return null; }
}

// Catalogue dynamique (CLAISSE RAIL, STMF)
export async function addCatalogueArticle(siteId, article) {
  const { data, error } = await supabase
    .from('catalogues')
    .insert([{
      site_id: siteId,
      article_id: article.id,
      nom: article.name,
      sku: article.sku || '',
      categorie: article.category || '',
      fournisseur: article.fournisseur || '',
      stock: parseInt(article.stock) || 0,
      stock_min: parseInt(article.min) || 0,
      location: article.location || '',
      prix_ht: parseFloat(article.prix) || 0,
      unite: article.unit || 'pcs',
      actif: true,
    }])
    .select()
  if (error) { console.error('addCatalogueArticle:', error); return null; }
  return data?.[0]
}

export async function updateCatalogueArticle(siteId, articleId, updates) {
  const { error } = await supabase
    .from('catalogues')
    .update({
      nom: updates.name,
      fournisseur: updates.fournisseur || '',
      stock: parseInt(updates.stock) || 0,
      stock_min: parseInt(updates.min) || 0,
      location: updates.location || '',
      prix_ht: parseFloat(updates.prix) || 0,
      unite: updates.unit || 'pcs',
    })
    .eq('site_id', siteId)
    .eq('article_id', articleId)
  if (error) console.error('updateCatalogueArticle:', error)
  return !error
}

export async function deleteCatalogueArticle(siteId, articleId) {
  const { error } = await supabase
    .from('catalogues')
    .delete()
    .eq('site_id', siteId)
    .eq('article_id', articleId)
  if (error) console.error('deleteCatalogueArticle:', error)
  return !error
}

export async function getCatalogue(siteId) {
  const { data, error } = await supabase
    .from('catalogues')
    .select('*')
    .eq('site_id', siteId)
    .eq('actif', true)
    .order('nom')
  if (error) { console.error(error); return []; }
  return (data || []).map(r => ({
    id: r.article_id,
    name: r.nom,
    sku: r.sku,
    category: r.categorie,
    fournisseur: r.fournisseur,
    stock: r.stock,
    min: r.stock_min,
    location: r.location,
    prix: parseFloat(r.prix_ht)||0,
    unit: r.unite,
    status: r.stock===0?'rupture':r.stock_min>0&&r.stock<r.stock_min*0.3?'critical':r.stock_min>0&&r.stock<r.stock_min?'warning':'ok',
  }))
}

export async function importCatalogue(siteId, articles) {
  // Upsert en lot
  const rows = articles.map(a => ({
    site_id: siteId,
    article_id: a.id,
    nom: a.name,
    sku: a.sku||'',
    categorie: a.category||'',
    fournisseur: a.fournisseur||'',
    stock: parseInt(a.stock)||0,
    stock_min: parseInt(a.min)||0,
    location: a.location||'',
    prix_ht: parseFloat(a.prix)||0,
    unite: a.unit||'pcs',
    actif: true,
  }))
  const { error } = await supabase.from('catalogues').upsert(rows, { onConflict: 'site_id,article_id' })
  if (error) console.error('importCatalogue error:', error)
  return !error
}

export async function getStockOverridesSite(siteId) {
  const { data, error } = await supabase
    .from('stock_overrides')
    .select('*')
    .eq('site_id', siteId)
  if (error) { console.error(error); return {}; }
  const map = {}
  ;(data || []).forEach(r => { map[r.article_id] = r.stock })
  return map
}

export async function setStockOverrideSite(articleId, stock, siteId) {
  const { error } = await supabase
    .from('stock_overrides')
    .upsert(
      { article_id: articleId, stock, site_id: siteId },
      { onConflict: 'article_id,site_id' }
    )
  if (error) console.error('setStockOverrideSite:', error)
}

export async function getMouvementsSite(siteId) {
  const { data, error } = await supabase
    .from('mouvements')
    .select('*')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) { console.error(error); return []; }
  return data || []
}

export async function addMouvementSite(m, siteId) {
  // Normaliser camelCase → snake_case
  const record = {
    type:          m.type,
    article_id:    m.article_id   || m.articleId   || '',
    article_name:  m.article_name || m.articleName || '',
    fournisseur:   m.fournisseur  || '',
    quantite:      m.quantite     || 0,
    stock_avant:   m.stock_avant  || m.stockAvant  || 0,
    stock_apres:   m.stock_apres  || m.stockApres  || 0,
    motif:         m.motif        || '',
    reference:     m.reference    || '',
    num_bdc:       m.num_bdc      || '',
    cout_fifo:     m.cout_fifo    || 0,
    prix_unitaire: m.prix_unitaire || null,
    site_id:       siteId,
  };
  const { data, error } = await supabase
    .from('mouvements')
    .insert([record])
    .select()
  if (error) { console.error('addMouvementSite error:', error); return null; }
  return data?.[0]
}

export async function getOrdresSite(siteId) {
  const { data, error } = await supabase
    .from('ordres_reparation')
    .select('*')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
  if (error) { console.error(error); return []; }
  return (data || []).map(r => ({
    id: r.id, numero: r.numero, dateOuverture: r.created_at,
    dateCloture: r.date_cloture, statut: r.statut, machine: r.machine,
    immat: r.immat, typePanne: r.type_panne, technicien: r.technicien,
    priorite: r.priorite, description: r.description, pieces: r.pieces||[], notes: r.notes||'',
  }))
}

export async function createOrdreSite(ordre, siteId) {
  const { data, error } = await supabase
    .from('ordres_reparation')
    .insert([{
      numero: ordre.numero, statut: ordre.statut||'ouvert',
      machine: ordre.machine, immat: ordre.immat||'',
      type_panne: ordre.typePanne||ordre.type_panne||'',
      technicien: ordre.technicien||'', priorite: ordre.priorite||'normale',
      description: ordre.description||'', pieces: ordre.pieces||[], notes: ordre.notes||'',
      site_id: siteId,
    }])
    .select()
  if (error) { console.error('createOrdreSite:', error); return null; }
  return data?.[0]
}

export async function getUtilisateursSite(siteId) {
  const { data, error } = await supabase
    .from('utilisateurs')
    .select('id,nom,prenom,email,mot_de_passe,role,actif,created_at,derniere_connexion,site_id,permissions')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
  if (error) { console.error(error); return []; }
  return data || []
}

export async function createUtilisateurSite(user, siteId) {
  const { data, error } = await supabase
    .from('utilisateurs')
    .insert([{
      nom: user.nom, prenom: user.prenom,
      email: user.email.toLowerCase().trim(),
      mot_de_passe: user.motDePasse,
      role: user.role, actif: true, site_id: siteId,
    }])
    .select()
  if (error) { console.error(error); return null; }
  return data?.[0]
}

export async function updateUtilisateurPermissions(id, permissions) {
  const { data, error } = await supabase
    .from('utilisateurs')
    .update({ permissions: permissions })
    .eq('id', id)
    .select()
  if (error) {
    console.error('updateUtilisateurPermissions error:', error)
    return false
  }
  console.log('permissions updated:', data)
  return true
}

// ── SUPPRESSIONS ──────────────────────────────────────────────────────────────
export async function deleteMouvement(id) {
  // Ignorer les IDs locaux (timestamp > 10^12)
  const numId = parseInt(id)
  if (!numId || isNaN(numId) || numId > 999999999999) {
    console.warn('deleteMouvement: ID local ignoré', id)
    return true // Retourne true pour que l'UI supprime quand même l'élément local
  }
  const { error } = await supabase
    .from('mouvements')
    .delete()
    .eq('id', numId)
  if (error) {
    console.error('deleteMouvement error:', error)
    return false
  }
  console.log('deleteMouvement: supprimé id=', numId)
  return true
}

export async function deleteStockOverride(articleId) {
  const { error } = await supabase
    .from('stock_overrides')
    .delete()
    .eq('article_id', articleId)
  if (error) console.error('deleteStockOverride:', error)
  return !error
}

// ── LOCATIONS ─────────────────────────────────────────────────────────────────
export async function getLocations(siteId) {
  const { data, error } = await supabase.from('locations').select('*').eq('site_id', siteId).order('created_at', { ascending: false })
  if (error) { console.error(error); return []; }
  return data || []
}
export async function addLocation(loc, siteId) {
  const { data, error } = await supabase.from('locations').insert([{ ...loc, site_id: siteId }]).select()
  if (error) { console.error(error); return null; }
  return data?.[0]
}
export async function updateLocation(id, updates) {
  const { error } = await supabase.from('locations').update(updates).eq('id', id)
  if (error) console.error(error)
}
export async function deleteLocation(id) {
  const { error } = await supabase.from('locations').delete().eq('id', id)
  if (error) console.error(error)
  return !error
}

// ── PRÊTS ─────────────────────────────────────────────────────────────────────
export async function getPrets(siteId) {
  const { data, error } = await supabase.from('prets').select('*').eq('site_id', siteId).order('created_at', { ascending: false })
  if (error) { console.error(error); return []; }
  return data || []
}
export async function addPret(pret, siteId) {
  const { data, error } = await supabase.from('prets').insert([{ ...pret, site_id: siteId }]).select()
  if (error) { console.error(error); return null; }
  return data?.[0]
}
export async function updatePret(id, updates) {
  const { error } = await supabase.from('prets').update(updates).eq('id', id)
  if (error) console.error(error)
}
export async function deletePret(id) {
  const { error } = await supabase.from('prets').delete().eq('id', id)
  if (error) console.error(error)
  return !error
}

export async function getPermissions(userId) {
  const { data } = await supabase
    .from('user_permissions')
    .select('modules')
    .eq('user_id', userId)
    .limit(1)
  return data?.[0]?.modules || null
}

export async function getUserPermissions(id) {
  const { data } = await supabase
    .from('utilisateurs')
    .select('permissions')
    .eq('id', id)
    .limit(1)
  return data?.[0]?.permissions ?? null
}

// ── PERMISSIONS (table séparée) ───────────────────────────────────────────────
export async function savePermissions(userId, modules) {
  try {
    console.log('[savePermissions] userId:', userId, 'type:', typeof userId, 'modules:', modules);
    // Supprimer l'existant d'abord
    await supabase.from('user_permissions').delete().eq('user_id', Number(userId));
    // Insérer la nouvelle valeur
    const { data, error } = await supabase
      .from('user_permissions')
      .insert({ user_id: Number(userId), modules: modules, updated_at: new Date().toISOString() })
      .select();
    console.log('[savePermissions] result:', data, 'error:', error);
    if (error) { console.error('[savePermissions] ERROR:', error); return false; }
    return true;
  } catch(e) {
    console.error('[savePermissions] EXCEPTION:', e);
    return false;
  }
}

export async function deletePermissions(userId) {
  const { error } = await supabase.from('user_permissions').delete().eq('user_id', userId)
  if (error) console.error(error)
}