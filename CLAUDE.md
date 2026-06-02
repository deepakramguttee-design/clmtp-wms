# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (http://localhost:5173)
npm run build     # Production build → dist/
npm run preview   # Preview the production build
```

No test framework is configured.

## Architecture

**Stack**: React 18 + Vite 5, Supabase (PostgreSQL), PWA via `vite-plugin-pwa` / Workbox.

### File layout

| File | Purpose |
|------|---------|
| `src/App.jsx` | ~4 300-line monolith: every page component, all UI, root state, routing |
| `src/db.js` | All Supabase read/write helpers (plain async functions, no ORM) |
| `src/supabase.js` | Supabase client (URL + anon key hardcoded — intentional for LAN deployment) |
| `src/products.js` | Static product catalog for the CLMTP Sablé site (~1 800 articles) |
| `src/parc.js` | Static vehicle/equipment registry used by the repair-orders module |

### Routing

There is no React Router. A single `page` state variable in the root `App` component drives navigation. The value is synced with `?page=` in the URL query string. Pages are selected with a chain of `if (page === "…")` checks around line 4245 of `App.jsx`.

Available page ids: `dashboard`, `stock`, `scanner`, `barcodes`, `mouvements`, `ordres`, `location`, `pret`, `fifo`, `prix`, `equivalences`, `catalogue`, `utilisateurs`.

### Multi-site model

Three sites are defined in the `SITES` constant (~line 3523):

- `clmtp_sable` — uses the static `ALL_PRODUCTS` array from `products.js`; stock overrides stored in `stock_overrides` table without a `site_id`
- `claisse_rail`, `stmf` — use the dynamic `catalogues` Supabase table; all stock, movements and orders are scoped by `site_id`

The active site is persisted in `localStorage("wms_site")`. On load, `siteId` determines which fetch functions are called (e.g. `getMouvementsSite` vs `getMouvements`).

### Stock calculation

Effective stock = `stock_overrides[article.id]` when present, otherwise `article.stock` from the catalog. Every stock movement calls `setStockOverrideSite` to write the new value back, so `stock_overrides` is the authoritative stock table.

### State management

All shared state (`stockOverrides`, `mouvements`, `ordres`, `equivalences`, `prixFournisseurs`, etc.) lives in the root `App` component and is passed down as props. There is no global state library.

### Authentication

Custom auth against the `utilisateurs` Supabase table (passwords stored in plaintext in `mot_de_passe`). Login is per-site (`loginUserMultiSite`). The returned user object is kept in React state only — there is no persistent session; refreshing the page requires re-login.

Role hierarchy (most to least privileged): `admin` → `magasinier_preparateur` → `magasinier` → `preparateur` → `technicien` → `lecteur`. Navigation items are filtered per role and per site via the `NAV_ALL` array (~line 3538).

### FIFO lots

Purchase lots are stored in the `lots_achat` Supabase table. `consommerFIFO(articleId, qty)` in `db.js` deducts stock from the oldest open lots first and returns consumed lots with their unit cost for reporting.

### Database schema

Run `SUPABASE_SETUP.sql` once in the Supabase SQL editor to create all tables and RLS policies. Key tables: `mouvements`, `stock_overrides`, `equivalences`, `ordres_reparation`, `prix_fournisseurs`, `historique_prix`, `lots_achat`, `catalogues`, `utilisateurs`, `user_permissions`, `locations`, `prets`.

### PWA / offline

The service worker (Workbox) caches all built assets. Supabase API calls use `NetworkFirst` with a 5-minute cache. The manifest exposes shortcuts for `stock`, `scanner`, and `ordres`.
