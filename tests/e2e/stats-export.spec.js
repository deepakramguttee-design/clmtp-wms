import { test, expect } from '@playwright/test';

// Export Excel des statistiques (admin). Le fichier est généré côté client
// par XLSX.writeFile : aucune écriture en base → lecture seule.

test.describe('Statistiques — Export Excel', () => {
  test('l\'export télécharge un fichier statistiques_*.xlsx', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Tableau de bord/ }).first()).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: /Statistiques/ }).first().click();
    await expect(page.getByRole('heading', { name: /Statistiques/ })).toBeVisible({ timeout: 15000 });

    // Le bouton est désactivé pendant le chargement des données
    const exportBtn = page.getByRole('button', { name: /Export Excel/ });
    await expect(exportBtn).toBeEnabled({ timeout: 30000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await exportBtn.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^statistiques_.+\.xlsx$/);
  });
});
