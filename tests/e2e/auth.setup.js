import fs from 'node:fs';
import path from 'node:path';
import { test as setup, expect } from '@playwright/test';
import { loadEnvTest } from './helpers/env.js';

const AUTH_FILE = 'tests/.auth/user.json';

// Connexion Supabase via l'UI de login, puis sauvegarde du storageState
// (la session supabase-js vit dans localStorage → capturée par storageState).
setup('authentification', async ({ page }) => {
  const env = loadEnvTest();

  await page.goto('/');

  // Étape 1 : choix du site (CLMTP SABLÉ par défaut)
  await page.getByRole('button', { name: /Accéder à/ }).click();

  // Étape 2 : formulaire de connexion
  await page.locator('input[type="email"]').fill(env.E2E_EMAIL);
  await page.locator('input[type="password"]').fill(env.E2E_PASSWORD);
  await page.getByRole('button', { name: /Se connecter/ }).click();

  // L'app est chargée quand la sidebar affiche "Tableau de bord"
  await expect(page.getByRole('button', { name: /Tableau de bord/ }).first())
    .toBeVisible({ timeout: 20000 });

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
});
