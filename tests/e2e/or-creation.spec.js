import { test, expect } from '@playwright/test';

// Création d'un OR avec un 2e technicien (saisie manuelle de temps).
// Seul flux autorisé à écrire : l'OR et sa session de temps créés ici
// sont supprimés en fin de test (nettoyage systématique via finally).

test.describe('Ordres de réparation', () => {
  test('création d\'un OR, ajout d\'un 2e technicien, puis nettoyage', async ({ page }) => {
    const machine = `E2E-OR-${Date.now()}`;
    const technicien2 = 'Deuxième Technicien E2E';

    // Les suppressions passent par confirm() natif → auto-acceptation
    page.on('dialog', dialog => dialog.accept());

    await page.goto('/');
    await expect(page.getByRole('button', { name: /Tableau de bord/ }).first()).toBeVisible({ timeout: 20000 });
    await page.getByRole('button', { name: /Ordres de réparation/ }).click();
    await expect(page.getByRole('heading', { name: /Ordres de réparation/ })).toBeVisible({ timeout: 15000 });

    // ── Création ──
    await page.getByRole('button', { name: /Nouvel OR/ }).click();
    await expect(page.getByRole('heading', { name: /Nouvel OR/ })).toBeVisible();

    // Véhicule/engin : saisie libre (le champ accepte un texte hors référentiel)
    await page.getByPlaceholder(/Désignation, code véhicule/).fill(machine);
    await page.keyboard.press('Escape'); // ferme le dropdown d'autocomplete

    // Type de panne : option "Autre" + précision
    const panneSelect = page.locator('select', {
      has: page.locator('option', { hasText: 'Sélectionner le type de panne' }),
    });
    await panneSelect.selectOption('Autre');
    await page.getByPlaceholder(/Préciser le type de panne/).fill('Test E2E');

    // Technicien 1 : select si des utilisateurs existent, sinon saisie libre
    const techSelect = page.locator('select', {
      has: page.locator('option', { hasText: 'Sélectionner un technicien' }),
    });
    if (await techSelect.count()) {
      const nbOptions = await techSelect.locator('option').count();
      if (nbOptions > 1) await techSelect.selectOption({ index: 1 });
    } else {
      await page.locator('input[placeholder="Nom du technicien"]:visible').fill('Premier Technicien E2E');
    }

    await page.getByRole('button', { name: /Créer l'OR/ }).click();

    try {
      // La fiche OR s'ouvre automatiquement après création
      await expect(page.getByText(machine).first()).toBeVisible({ timeout: 15000 });

      // ── 2e technicien : saisie manuelle de temps ──
      await page.getByRole('button', { name: /Temps passé/ }).click();
      await page.getByRole('button', { name: /Ajouter temps manuellement/ }).click();
      await page.getByRole('button', { name: 'Durée directe' }).click();

      // Grille "Durée directe" : [Heure début (opt.), Heures, Minutes]
      await page.locator('input[type="number"]:visible').first().fill('1');
      await page.locator('input[placeholder="Nom du technicien"]:visible').fill(technicien2);
      await page.getByRole('button', { name: /Enregistrer/ }).click();

      // La session du 2e technicien apparaît dans l'historique
      // (filter visible : le nom existe aussi dans l'onglet Fiche masqué)
      await expect(page.getByText(technicien2).filter({ visible: true }).first())
        .toBeVisible({ timeout: 15000 });

      // ── Nettoyage 1 : suppression de la session de temps ──
      await page.getByRole('button', { name: '🗑️' }).filter({ visible: true }).first().click();
      await expect(page.getByText(technicien2)).toHaveCount(0, { timeout: 15000 });
    } finally {
      // ── Nettoyage 2 : suppression de l'OR ──
      // Fermer la fiche si encore ouverte
      const closeBtn = page.getByRole('button', { name: '✕' }).first();
      if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();

      // Isoler l'OR créé via la recherche, puis supprimer
      await page.getByPlaceholder(/Rechercher numéro, machine/).fill(machine);
      const deleteBtn = page.getByRole('button', { name: '🗑', exact: true }).first();
      await expect(deleteBtn).toBeVisible({ timeout: 10000 });
      await deleteBtn.click();
      await page.getByRole('button', { name: /🗑 Supprimer/ }).click();

      // L'OR n'apparaît plus dans la liste
      await expect(page.getByText(machine)).toHaveCount(0, { timeout: 15000 });
    }
  });
});
