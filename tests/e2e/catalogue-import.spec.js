import { test, expect } from '@playwright/test';

// F-004 — Import Excel du catalogue.
// Contrainte lecture seule : on ne déclenche PAS l'import réel (upsert Supabase),
// on valide le flux UI complet jusqu'au sélecteur de fichier.

test.describe('Catalogue — Import Excel (F-004)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Tableau de bord/ }).first()).toBeVisible({ timeout: 20000 });
    // CLMTP SABLÉ utilise un catalogue statique (pas d'import) : on bascule
    // sur CLAISSE RAIL, où l'import Excel est actif. Changement purement
    // client (setSiteId + localStorage), sans écriture en base.
    await page.getByRole('button', { name: /CLAISSE RAIL/ }).click();
    await page.getByRole('button', { name: /Catalogue articles/ }).click();
    await expect(page.getByRole('heading', { name: /Catalogue/ })).toBeVisible({ timeout: 15000 });
  });

  test('le modal d\'import s\'ouvre avec les colonnes attendues', async ({ page }) => {
    await page.getByRole('button', { name: /Importer/ }).first().click();

    await expect(page.getByRole('heading', { name: /Import catalogue Excel/ })).toBeVisible();
    // Colonnes obligatoires signalées par *
    await expect(page.getByText('SKU *', { exact: true })).toBeVisible();
    await expect(page.getByText('Nom *', { exact: true })).toBeVisible();
    // Colonnes optionnelles
    for (const col of ['Fournisseur', 'Stock', 'Prix HT']) {
      await expect(page.getByText(col, { exact: true }).first()).toBeVisible();
    }

    // Le sélecteur de fichier accepte les formats Excel/CSV
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveAttribute('accept', '.xlsx,.xls,.csv');

    // Fermeture sans importer (lecture seule)
    await page.getByRole('button', { name: 'Annuler' }).click();
    await expect(page.getByRole('heading', { name: /Import catalogue Excel/ })).toHaveCount(0);
  });

  test('le bouton Modèle Excel est proposé', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Modèle Excel/ })).toBeVisible();
  });
});
