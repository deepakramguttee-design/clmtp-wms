import { test, expect } from '@playwright/test';

// Conversion de verify-admin-button.mjs.
// L'ancien script simulait 5 rôles via localStorage "wms_user", clé que l'app
// n'utilise plus depuis la migration vers Supabase Auth (AuthContext).
// Ici on vérifie, avec la session réelle (compte admin de .env.test), que les
// entrées réservées aux admins sont visibles et accessibles. Lecture seule.

test.describe('Visibilité des modules admin', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Tableau de bord/ }).first()).toBeVisible({ timeout: 20000 });
  });

  test('le bouton Administration est visible pour un admin', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Administration/ }).first()).toBeVisible();
  });

  test('la page Statistiques est accessible (pas de blocage 403)', async ({ page }) => {
    await page.getByRole('button', { name: /Statistiques/ }).first().click();
    await expect(page.getByRole('heading', { name: /Statistiques/ })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Accès réservé aux administrateurs')).toHaveCount(0);
  });
});
