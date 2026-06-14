# CLMTP WMS — CLAUDE.md

## Stack
- Vite + React 18 + Supabase
- Tailwind CSS + shadcn/ui
- Netlify (origin: clmtp-wms sur GitHub, netlify: clmtp repo)
- Local : C:\Users\Deepak RAMGUTTEE\Downloads\LogiWMS_v4_prix_1\wms-project

## Contexte métier
- Approvisionneur chez CLMTP (ferroviaire/travaux publics, Sablé-sur-Sarthe)
- 3 sites : CLMTP SABLÉ, CLAISSE RAIL, STMF
- Super-admin : deepak.ramguttee@gmail.com
- Modules : Stock, Chantiers, Parc Véhicules, Ordres de Réparation, Outillage, Vue Éclatée, Filtres

## Rules

### Output
- Code only. No prose unless asked.
- No "Bien sûr !", no résumé après modification.
- No ellipsis `// ... reste du code`. Fichiers complets uniquement.
- No over-engineering. Solution minimale qui fonctionne.

### Workflow
- Lire le fichier avant d'éditer. Jamais en aveugle.
- Solution complète. Pas de stubs partiels.
- Tester une fois. Corriger silencieusement.
- Pas de features spéculatives. Faire exactement ce qui est demandé.

### Supabase
- RLS activé. Toujours filtrer par `site_id` pour isolation multi-site.
- Utiliser les hooks Supabase existants, ne pas recréer.
- Permissions via table `user_permissions`. Ne pas contourner.
- Pas de données en dur — tout vient de Supabase.

### React
- Composants fonctionnels + hooks uniquement.
- Zustand ou Context pour state global selon pattern existant.
- Tailwind uniquement pour le style. Pas de CSS inline sauf exception.
- Sidebar sombre / contenu clair (thème actuel du projet).

### Git
- Deux remotes : `origin` → GitHub `clmtp-wms`, `netlify` → repo `clmtp`
- Commit message en français, concis.
- Push les deux après chaque feature stable.

## Modules actifs
| Module | Table Supabase | Statut |
|---|---|---|
| Stock | stock_items | ✅ |
| Chantiers | chantiers, chantier_stock | ✅ |
| Parc Véhicules | parc_vehicules, parc_categories | ✅ |
| Ordres de Réparation | ordres_reparation | ✅ |
| Outillage Milwaukee | outillage_items | ✅ |
| Vue Éclatée | vues_eclatees (Storage) | ✅ |
| Références Filtres | filtration_vehicules, filtration_engins | 🚧 |

## Rôles / Permissions
- `super_admin` — accès total tous sites (deepak.ramguttee@gmail.com)
- `admin` — accès total sur son site
- `editeur` — lecture + écriture
- `magasinier_preparateur` — stock + préparation chantier
- `lecteur` — lecture seule

## Techniciens OR (tarifs_techniciens)
- Mehdi DUVEAU
- Ludovic ARMANGE
- Allan MILLION

## Véhicules — Classification
- GEISMAR-VPS → catégorie VPS (regex actif)
- GEISMAR-PM → catégorie PM (regex actif)
