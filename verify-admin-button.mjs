import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';

function makeUser(role) {
  return JSON.stringify({
    id: 1, nom: 'Test', prenom: 'User', email: 'test@test.com',
    role, actif: true, site_id: 'clmtp_sable',
    created_at: new Date().toISOString(),
    derniere_connexion: new Date().toISOString(),
    permissions: null,
  });
}

async function testRole(browser, role) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // Intercept Supabase calls — return minimal valid responses so the app doesn't crash
  await page.route('**/rest/v1/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/storage/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  // Inject user into localStorage BEFORE the app boots
  await page.addInitScript((userJson) => {
    localStorage.setItem('wms_user', userJson);
    localStorage.setItem('wms_site', 'clmtp_sable');
  }, makeUser(role));

  await page.goto(BASE_URL);

  // Wait for the dashboard h1 to appear (app has loaded past login)
  try {
    await page.waitForSelector('h1', { timeout: 10000 });
  } catch {
    await page.screenshot({ path: `debug-${role}.png` });
  }

  const h1Text = await page.locator('h1').first().textContent().catch(() => '(none)');
  const adminBtnCount = await page.locator('button:has-text("Administration")').count();

  await ctx.close();
  return { role, h1Text: h1Text.trim(), adminBtnCount };
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  console.log('\n=== Vérification bouton Administration ===\n');

  const results = await Promise.all([
    testRole(browser, 'admin'),
    testRole(browser, 'technicien'),
    testRole(browser, 'magasinier'),
    testRole(browser, 'lecteur'),
    testRole(browser, 'preparateur'),
  ]);

  await browser.close();

  for (const r of results) {
    const visible = r.adminBtnCount > 0;
    const expected = r.role === 'admin';
    const ok = visible === expected;
    console.log(`${ok ? '✅' : '❌'} role=${r.role.padEnd(20)} bouton visible=${String(visible).padEnd(5)} (attendu=${expected})  h1="${r.h1Text}"`);
  }

  const allPass = results.every(r => (r.adminBtnCount > 0) === (r.role === 'admin'));
  console.log(`\nRÉSULTAT : ${allPass ? '✅ PASS' : '❌ FAIL'}`);
  process.exit(allPass ? 0 : 1);
})();
