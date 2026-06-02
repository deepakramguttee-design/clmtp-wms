# Admin Dashboard — Design Spec
**Date**: 2026-06-02
**Projet**: WMS CLMTP (LogiWMS v4)

---

## Contexte

Le WMS possède déjà un `Dashboard` visible par tous les rôles (`page=dashboard`). Ce spec décrit une **page séparée** (`page=admin`) accessible uniquement au rôle `admin`, affichant une vue agrégée multi-sites avec KPIs avancés, graphiques et supervision des utilisateurs.

---

## Architecture

### Fichiers touchés

| Fichier | Modification |
|---------|-------------|
| `src/AdminDashboard.jsx` | **Nouveau** — composant complet |
| `src/App.jsx` | Import + entrée `NAV_ALL` + `if (page==="admin")` |
| `src/db.js` | Aucun ajout nécessaire (réutilise les fonctions existantes) |
| `package.json` | Ajout dépendance `recharts` |

### Intégration dans App.jsx

```js
// Import
import AdminDashboard from "./AdminDashboard.jsx";

// NAV_ALL — nouvelle entrée
{ id:"admin", label:"Admin", icon:"⚙️", roles:["admin"], sites:["clmtp_sable","claisse_rail","stmf"] }

// Switch de rendu (~ligne 4245)
if (page === "admin") return <AdminDashboard user={user} siteId={siteId} />;
```

---

## Données & fetch

Le composant gère son propre état local. Au montage et sur clic "Actualiser", il lance **8 requêtes en parallèle** via `Promise.allSettled` (tolérant aux échecs partiels) :

| # | Donnée | Source |
|---|--------|--------|
| 1 | Stock SABLÉ | `ALL_PRODUCTS` (import statique) + `getStockOverrides()` |
| 2 | Stock CLAISSE RAIL | `getCatalogue("claisse_rail")` |
| 3 | Stock STMF | `getCatalogue("stmf")` |
| 4 | Mouvements 30 jours | `supabase.from("mouvements").select("*").gte("created_at", now-30j)` |
| 5 | Prêts SABLÉ | `getPrets("clmtp_sable")` |
| 6 | Prêts CLAISSE RAIL + STMF | `getPrets("claisse_rail")`, `getPrets("stmf")` — fusionnés |
| 7 | Ordres tous sites | `getOrdresSite("clmtp_sable")` + `getOrdresSite("claisse_rail")` + `getOrdresSite("stmf")` — fusionnés |
| 8 | Utilisateurs | `getUtilisateurs()` triés par `derniere_connexion DESC` |

**Note** : les mouvements SABLÉ ont `site_id = null` en base (legacy). Pour le BarChart "volume/site", on distingue par `site_id IS NULL → SABLÉ`, `site_id = "claisse_rail"`, `site_id = "stmf"`.

**État local du composant** :
```js
{
  loading: bool,
  lastRefresh: Date | null,
  error: { [key]: string },   // erreurs par bloc, indépendantes
  stockSable: [],
  stockClaisse: [],
  stockStmf: [],
  mouvements: [],
  ordres: [],       // fusionnés 3 sites
  prets: [],        // fusionnés 3 sites
  utilisateurs: [],
}
```

---

## Layout

**Fond** : `#0f172a` (légèrement plus sombre que `#111827` pour différencier du dashboard standard)

### Header
- Titre "Administration"
- Date/heure du dernier refresh
- Bouton "⟳ Actualiser" (désactivé pendant fetch)

### Ligne 2 — 5 KPI Cards
Grille `repeat(5, 1fr)` → `repeat(3, 1fr)` sur tablette (< 1024px) → `repeat(2, 1fr)` sur mobile (< 640px)

| Card | Calcul | Couleur |
|------|--------|---------|
| Total références | `stockSable.length + stockClaisse.length + stockStmf.length` | `#3b82f6` bleu |
| Valeur stock globale | `Σ (stock × prix)` tous sites | `#10b981` vert |
| Ruptures totales | articles avec `stock === 0` tous sites | `#ef4444` rouge |
| OR ouverts | `ordres.filter(o => !["termine","annule"].includes(o.statut)).length` (depuis fetch interne tous sites) | `#8b5cf6` violet |
| Prêts actifs | `prets.filter(p => !p.date_retour_effective)` | `#f59e0b` orange |

### Ligne 3 — Stock par site (3 cards)
Chaque card affiche : nom du site + icône, nb références, valeur totale €, nb ruptures, barre de progression `(en_stock / total) × 100%` colorée selon taux.

### Ligne 4 — Graphique mouvements + Alertes stock
- **Gauche (60%)** : `BarChart` recharts — 7 derniers jours, 2 séries (entrées vert `#10b981`, sorties rouge `#ef4444`), tooltip, légende
- **Droite (40%)** : liste scrollable des articles sous seuil min, triés par `(stock / min)` ASC, badge rouge si `stock === 0`, orange si `stock < min`

### Ligne 5 — Prêts + Activité utilisateurs
- **Gauche (50%)** : table des prêts non rendus — colonnes : article, emprunteur, site, date retour prévue (rouge si dépassée vs aujourd'hui)
- **Droite (50%)** :
  - Liste des 8 dernières connexions avec avatar initiales, nom, site, date relative
  - Mini `BarChart` horizontal : volume mouvements/site sur 30j (3 barres : SABLÉ, CLAISSE RAIL, STMF)

---

## Sécurité & droits

Double vérification du rôle :
1. `NAV_ALL` filtre déjà le lien de navigation
2. `AdminDashboard` vérifie `user?.role !== "admin"` au premier rendu et affiche un écran `403` simple (`"Accès réservé aux administrateurs"`) si la condition n'est pas remplie

---

## Gestion des erreurs & cas limites

- `Promise.allSettled` : une requête en échec n'empêche pas les autres de s'afficher
- Chaque bloc affiche son propre message d'erreur inline
- Skeleton loading (pulse CSS) pendant fetch — pas de spinner global
- Bouton Actualiser désactivé pendant le fetch (évite appels concurrents)
- `prets.date_retour_prevue` absent → colonne date vide, pas de crash
- `utilisateurs.derniere_connexion` null → affiche "Jamais connecté"
- Stock SABLÉ toujours disponible (données statiques `ALL_PRODUCTS` en fallback)

---

## Dépendances

```bash
npm install recharts
```

Recharts est tree-shakeable — seuls `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `Legend`, `ResponsiveContainer` seront importés.

---

## Hors scope

- Temps réel (pas de Supabase Realtime / WebSocket)
- Export PDF/Excel du dashboard
- Filtres de période configurables
- Notifications push
