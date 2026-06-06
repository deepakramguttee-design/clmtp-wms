import { chromium } from 'playwright';

const br = await chromium.launch({ headless: true });
const page = await br.newPage();
await page.setViewportSize({ width: 1280, height: 900 });

await page.goto('http://localhost:5175');
await page.click('button:has-text("Accéder à")');
await page.waitForTimeout(400);
await page.fill('input[type="email"]', 'deepak.ramguttee@gmail.com');
await page.fill('input[type="password"]', 'KriLee2227*-');
await page.click('button:has-text("Se connecter")');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'C:/tmp/04_dashboard.png' });
console.log('Connecté, URL:', page.url());

// Chercher et cliquer sur la section "Parc & Engins" dans la sidebar
const parcSection = await page.$('text=Parc & Engins');
if (parcSection) {
  await parcSection.click();
  await page.waitForTimeout(600);
  console.log('Section Parc & Engins dépliée');
}
await page.screenshot({ path: 'C:/tmp/05_sidebar_parc.png' });

// Cliquer sur l'item "Parc véhicules & engins"
const parcItem = await page.$('text=Parc véhicules & engins');
if (parcItem) {
  await parcItem.click();
  await page.waitForTimeout(3000);
  console.log('Onglet Parc ouvert');
} else {
  console.log('Item Parc non trouvé, éléments sidebar:', await page.$$eval('[data-nav], nav button, aside button', els => els.map(e => e.textContent.trim())));
}
await page.screenshot({ path: 'C:/tmp/06_parc.png' });

// Scroll en haut pour voir les pills
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);
await page.screenshot({ path: 'C:/tmp/07_parc_top.png' });

await br.close();
