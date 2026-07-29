import { test, expect } from '@playwright/test';

// Création d'un OR avec un 2e technicien (champ "Technicien 2" du formulaire),
// puis saisie manuelle d'un temps attribué à ce 2e technicien.
// Seul flux autorisé à écrire : l'OR et sa session de temps créés ici
// sont supprimés en fin de test, avec un nettoyage de secours en afterEach.

const MACHINE_PREFIX = 'E2E-OR-';

// Accepte les confirm() natifs sans planter si un autre handler a déjà répondu
function autoAcceptDialogs(page) {
  page.on('dialog', d => d.accept().catch(() => {}));
}

async function gotoOrdres(page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Tableau de bord/ }).first()).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: /Ordres de réparation/ }).click();
  await expect(page.getByRole('heading', { name: /Ordres de réparation/ })).toBeVisible({ timeout: 15000 });
}

// Supprime tous les OR restants dont la machine commence par E2E-OR-
async function purgeTestOrders(page) {
  const search = page.getByPlaceholder(/Rechercher numéro, machine/);
  await search.fill(MACHINE_PREFIX);
  const deleteBtn = page.getByRole('button', { name: '🗑', exact: true }).first();
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(400); // laisse le filtre s'appliquer
    if (!(await deleteBtn.isVisible().catch(() => false))) break;
    await deleteBtn.click();
    await page.getByRole('button', { name: /🗑 Supprimer/ }).click();
    await expect(page.getByRole('button', { name: /🗑 Supprimer/ })).toHaveCount(0, { timeout: 10000 });
  }
  await expect(page.getByText(MACHINE_PREFIX)).toHaveCount(0, { timeout: 10000 });
}

test.describe('Ordres de réparation', () => {
  // Nettoyage de secours : quoi qu'il arrive dans le test, aucun OR E2E-OR-* ne survit
  test.afterEach(async ({ page }) => {
    autoAcceptDialogs(page);
    await gotoOrdres(page);
    await purgeTestOrders(page);
  });

  test('création d\'un OR avec 2e technicien, pointage, puis nettoyage', async ({ page }) => {
    const machine = `${MACHINE_PREFIX}${Date.now()}`;
    let technicien2 = 'Deuxième Technicien E2E';

    autoAcceptDialogs(page);
    await gotoOrdres(page);

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
    const tech1Select = page.locator('select', {
      has: page.locator('option', { hasText: 'Sélectionner un technicien' }),
    });
    if (await tech1Select.count()) {
      const nbOptions = await tech1Select.locator('option').count();
      if (nbOptions > 1) await tech1Select.selectOption({ index: 1 });
    } else {
      await page.locator('input[placeholder="Nom du technicien"]:visible').fill('Premier Technicien E2E');
    }

    // Technicien 2 : select "— Aucun 2e technicien —" si utilisateurs, sinon saisie libre
    const tech2Select = page.locator('select', {
      has: page.locator('option', { hasText: 'Aucun 2e technicien' }),
    });
    if (await tech2Select.count()) {
      const nbOptions = await tech2Select.locator('option').count();
      // index 2 = un technicien différent du 1er quand il y a au moins 2 utilisateurs
      await tech2Select.selectOption({ index: nbOptions > 2 ? 2 : 1 });
      technicien2 = await tech2Select.inputValue();
    } else {
      await page.locator('input[placeholder="Nom du 2e technicien"]:visible').fill(technicien2);
    }
    expect(technicien2).toBeTruthy();

    await page.getByRole('button', { name: /Créer l'OR/ }).click();

    try {
      // La fiche OR s'ouvre automatiquement après création
      await expect(page.getByText(machine).first()).toBeVisible({ timeout: 15000 });

      // ── Pointage attribué au 2e technicien : saisie manuelle de temps ──
      await page.getByRole('button', { name: /Temps passé/ }).click();
      await expect(page.getByText('Aucune session enregistrée')).toBeVisible({ timeout: 15000 });
      await page.getByRole('button', { name: /Ajouter temps manuellement/ }).click();
      await page.getByRole('button', { name: 'Durée directe' }).click();

      // Grille "Durée directe" : [Heure début (opt.), Heures, Minutes]
      await page.locator('input[type="number"]:visible').first().fill('1');

      // Champ Technicien du formulaire manuel : <select> des techniciens
      // affectés à l'OR quand il y en a, sinon <input> libre
      // (filter visible : l'onglet Fiche masqué contient un select équivalent)
      const manualTechSelect = page.locator('select', {
        has: page.locator('option', { hasText: /^— Sélectionner —$/ }),
      }).filter({ visible: true });
      if (await manualTechSelect.count()) {
        await manualTechSelect.first().selectOption(technicien2);
      } else {
        await page.locator('input[placeholder="Nom du technicien"]:visible').fill(technicien2);
      }
      await page.getByRole('button', { name: /Enregistrer/ }).click();

      // La session apparaît dans l'historique, attribuée au 2e technicien
      await expect(page.getByText('Aucune session enregistrée')).toHaveCount(0, { timeout: 15000 });
      await expect(page.getByText(`· ${technicien2}`).filter({ visible: true }).first())
        .toBeVisible({ timeout: 15000 });

      // ── Nettoyage 1 : suppression de la session de temps ──
      await page.getByRole('button', { name: '🗑️' }).filter({ visible: true }).first().click();
      await expect(page.getByText('Aucune session enregistrée')).toBeVisible({ timeout: 15000 });
    } finally {
      // ── Fermer la fiche AVANT le nettoyage (sinon la recherche de la liste
      // est inaccessible derrière le modal) ──
      const closeBtn = page.getByRole('button', { name: '✕' }).filter({ visible: true }).first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click().catch(() => {});
      }

      // ── Nettoyage 2 : suppression de l'OR créé ──
      await purgeTestOrders(page);
    }
  });
});
