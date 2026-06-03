# Vue éclatée — Design Spec
**Date:** 2026-06-03  
**Projet:** LogiWMS v4 (React + Vite + Supabase)

---

## Objectif

Ajouter un module "Vue éclatée" accessible à tous les rôles sur tous les sites. La page affiche, en sections verticales, les schémas éclatés des équipements pour les 3 sites (CLMTP SABLÉ, CLAISSE RAIL, STMF). Les admins peuvent ajouter, modifier et supprimer des équipements. Les autres rôles consultent uniquement.

---

## Données

### Table Supabase : `vues_eclatees`

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | uuid | PK, default gen_random_uuid() |
| `site_id` | text | NOT NULL — valeurs : `clmtp_sable`, `claisse_rail`, `stmf` |
| `nom_equipement` | text | NOT NULL |
| `description` | text | nullable |
| `image_url` | text | nullable — chemin public Storage |
| `ordre` | int | default 0 — réservé pour tri futur |
| `created_at` | timestamptz | default now() |

### Supabase Storage

- Bucket : `vues-eclatees` (accès **public**)
- Chemin d'upload : `{site_id}/{timestamp}_{nom_fichier_sanitisé}`
- Suppression image lors du delete d'un équipement (best-effort, non bloquant)

### Helpers `src/db.js` (4 fonctions à ajouter)

```js
getVuesEclatees()                    // SELECT *, ORDER BY site_id, ordre, created_at
addVueEclatee(payload)               // INSERT, retourne la ligne créée
updateVueEclatee(id, payload)        // UPDATE par id
deleteVueEclatee(id)                 // DELETE par id
```

Upload image : géré directement dans le composant via `supabase.storage.from('vues-eclatees').upload(path, file)` puis `supabase.storage.from('vues-eclatees').getPublicUrl(path)`.

---

## Composant `src/VueEclatee.jsx`

### Props

```js
{ user, siteId }
// user.role — pour conditionner l'affichage des actions admin
// siteId — contexte courant (non utilisé pour filtrer l'affichage)
```

### État local

| State | Type | Usage |
|---|---|---|
| `equipements` | array | Données chargées depuis Supabase |
| `loading` | bool | Spinner initial |
| `lightbox` | object\|null | Équipement affiché en plein écran |
| `showForm` | bool | Modal ajout/édition ouverte |
| `editTarget` | object\|null | null = ajout, objet = édition |
| `form` | object | `{nom, description, site_id, imageFile, imagePreview}` |
| `saving` | bool | Upload + insert/update en cours |
| `uploading` | bool | Progress upload image |

### Layout

```
┌──────────────────────────────────────────────────────────┐
│  🔍 Vue éclatée          [+ Ajouter équipement] (admin)  │
│  X équipements · 3 sites                                 │
├──────────────────────────────────────────────────────────┤
│  [Section CLMTP SABLÉ]                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│  │ thumbnail│ │ thumbnail│ │    ...   │                  │
│  │  Nom     │ │  Nom     │ │          │                  │
│  │ [✏️][🗑] │ │ [✏️][🗑] │ │          │  (admin only)   │
│  └──────────┘ └──────────┘ └──────────┘                 │
│                                                          │
│  [Section CLAISSE RAIL]  ...                             │
│  [Section STMF]          ...                             │
└──────────────────────────────────────────────────────────┘
```

- Grille : `repeat(auto-fill, minmax(200px, 1fr))`, gap 16px
- Carte : fond blanc, border-radius 14px, border `1px solid #e5e7eb`
  - Thumbnail : aspect ratio 4/3, `object-fit: cover`, fond `#f3f4f6` si pas d'image
  - Nom en dessous (fontWeight 700, fontSize 13)
  - Boutons ✏️🗑 visibles uniquement si `user.role === "admin"`
- Click carte → lightbox

### Lightbox

- Overlay fixe, fond `rgba(0,0,0,0.85)`, zIndex 1000
- Image centrée, max 90vw × 85vh, `object-fit: contain`
- Nom + description en bas
- Bouton ✕ en haut à droite
- Click overlay = fermeture

### Modal Ajout/Édition (admin)

Champs :
- **Nom** * (input text)
- **Site** * (select : CLMTP SABLÉ / CLAISSE RAIL / STMF) — pré-sélectionné sur `siteId` courant
- **Description** (textarea, optionnel)
- **Image** * en ajout, optionnel en édition (file input, accept `image/*`)
  - Preview de l'image sélectionnée (max-height 150px)
  - En édition : affiche l'image actuelle si pas de nouveau fichier

Logique submit :
1. Si nouveau fichier → upload vers Storage → récupérer `image_url`
2. Insert ou update en base
3. Mise à jour du state local (pas de re-fetch)

### Sections vides

- Non-admin : `"Aucun équipement enregistré pour ce site."`
- Admin : bouton `"+ Ajouter le premier équipement"` (ouvre modal avec site pré-sélectionné)

---

## Intégration `App.jsx`

### 1. Import en haut de fichier
```js
import VueEclatee from './VueEclatee.jsx';
```

### 2. `NAV_ALL` — nouvelle entrée (après `equivalences`)
```js
{ id:"vue_eclatee", label:"Vue éclatée", icon:"🔍",
  roles:["admin","technicien","magasinier","preparateur","magasinier_preparateur","lecteur"],
  sites:["clmtp_sable","claisse_rail","stmf"] },
```

### 3. `MODULES_PERMISSIONS` — nouvelle entrée
```js
{ id:"vue_eclatee", label:"Vue éclatée", icon:"🔍", desc:"Schémas éclatés des équipements" },
```

### 4. `DEFAULT_PERMISSIONS` — ajout dans tous les rôles non-admin
```js
technicien:             [..., "vue_eclatee"],
magasinier:             [..., "vue_eclatee"],
preparateur:            [..., "vue_eclatee"],
magasinier_preparateur: [..., "vue_eclatee"],
lecteur:                [..., "vue_eclatee"],
```

### 5. `renderPage()` — nouvelle ligne
```js
if(page==="vue_eclatee") return <VueEclatee user={user} siteId={siteId}/>;
```

---

## SQL à exécuter dans Supabase

```sql
-- Table
CREATE TABLE IF NOT EXISTS vues_eclatees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id text NOT NULL CHECK (site_id IN ('clmtp_sable','claisse_rail','stmf')),
  nom_equipement text NOT NULL,
  description text,
  image_url text,
  ordre int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE vues_eclatees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture publique vues_eclatees"
  ON vues_eclatees FOR SELECT USING (true);
CREATE POLICY "Ecriture anon vues_eclatees"
  ON vues_eclatees FOR ALL USING (true) WITH CHECK (true);

-- Storage bucket (à créer via Dashboard ou SQL)
-- Bucket name: vues-eclatees, public: true
```

---

## Contraintes et décisions

- **Pas de React Router** : navigation via `page` state, URL `?page=vue_eclatee`
- **Style cohérent** : police DM Sans, couleurs `#111827` / `#f1f5f9` / `#e5e7eb`, même border-radius que le reste
- **Supabase Storage bucket public** : les images sont accessibles par URL directe sans auth (acceptable pour des schémas techniques internes sur LAN)
- **Upload dans le composant** : pas de helper db.js pour l'upload (logique UI-spécifique avec preview)
- **Pas de pagination** : les schémas éclatés sont peu nombreux par nature
- **Suppression image best-effort** : si la suppression Storage échoue, la ligne est quand même supprimée en base
