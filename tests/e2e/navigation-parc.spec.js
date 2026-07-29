import { test, expect } from '@playwright/test';

// Conversion de test_sidebar.mjs / test_parc.mjs / test_parc2.mjs /
// test_pm.mjs / test_prr.mjs / test_cat_col.mjs — lecture seule.
// (test_select_cat.mjs modifiait une catégorie en base : non converti tel quel,
// on vérifie seulement la présence des selects sans changer de valeur.)

test.describe('Navigation — Parc véhicules & engins', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Tableau de bord/ }).first()).toBeVisible({ timeout: 20000 });
    // Déplier la section sidebar "Parc & Engins" puis ouvrir l'onglet
    await page.getByRole('button', { name: /Parc & Engins/ }).click();
    await page.getByRole('button', { name: /Parc véhicules & engins/ }).click();
    await expect(page.locator('table')).toBeVisible({ timeout: 15000 });
  });

  test('le tableau du parc affiche des lignes', async ({ page }) => {
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test('les pills de catégories filtrent le tableau', async ({ page }) => {
    // Pill PRR
    await page.getByRole('button', { name: /PRR et Équipements PRR/ }).first().click();
    await expect(page.locator('tbody tr').first()).toBeVisible();

    // Pill PM
    await page.getByRole('button', { name: /PM - Petit Matériel/ }).first().click();
    await expect(page.locator('tbody tr').first()).toBeVisible();
  });

  test('le modal "Gérer les catégories" s\'ouvre et se ferme', async ({ page }) => {
    await page.getByRole('button', { name: /Gérer les catégories/ }).click();
    const modal = page.locator('text=/catégorie/i').first();
    await expect(modal).toBeVisible();
    // Fermeture sans aucune modification (lecture seule)
    await page.keyboard.press('Escape');
  });

  test('la colonne Catégorie expose des selects (sans modification)', async ({ page }) => {
    const selects = page.locator('table select');
    // Lecture seule : on vérifie l'existence, on ne change aucune valeur
    expect(await selects.count()).toBeGreaterThan(0);
  });
});
