import { chromium } from 'playwright';
const br = await chromium.launch({ headless: true });
const page = await br.newPage();
await page.setViewportSize({ width: 1400, height: 900 });

await page.goto('http://localhost:5175');
await page.click('button:has-text("Accéder à")');
await page.waitForTimeout(300);
await page.fill('input[type="email"]', 'deepak.ramguttee@gmail.com');
await page.fill('input[type="password"]', 'KriLee2227*-');
await page.click('button:has-text("Se connecter")');
await page.waitForTimeout(2500);
await page.click('text=Parc & Engins');
await page.waitForTimeout(300);
await page.click('text=Parc véhicules & engins');
await page.waitForTimeout(3000);

// Onglet Tous doit être actif par défaut
await page.screenshot({ path: 'C:/tmp/cat_col_full.png' });

// Zoom sur le tableau uniquement (scroll horizontal pour voir Catégorie)
const table = await page.$('table');
if (table) {
  await table.screenshot({ path: 'C:/tmp/cat_col_table.png' });
}
console.log('Done');
await br.close();
