import { chromium } from 'playwright';

const br = await chromium.launch({ headless: true });
const page = await br.newPage();
await page.setViewportSize({ width: 1280, height: 900 });

// Login
await page.goto('http://localhost:5175');
await page.click('button:has-text("Accéder à")');
await page.waitForTimeout(400);
await page.fill('input[type="email"]', 'deepak.ramguttee@gmail.com');
await page.fill('input[type="password"]', 'KriLee2227*-');
await page.click('button:has-text("Se connecter")');
await page.waitForTimeout(2500);

// Aller sur Parc
await page.click('text=Parc & Engins');
await page.waitForTimeout(400);
await page.click('text=Parc véhicules & engins');
await page.waitForTimeout(2500);

// Screenshot pills (scroll horizontal pour voir toutes les pills)
await page.screenshot({ path: 'C:/tmp/08_pills_all.png', fullPage: false });

// Cliquer sur la pill PRR
await page.click('button:has-text("PRR et Équipements PRR")');
await page.waitForTimeout(800);
await page.screenshot({ path: 'C:/tmp/09_pill_prr.png' });
console.log('Pill PRR cliquée');

// Cliquer sur pill PM
await page.click('button:has-text("PM - Petit Matériel")');
await page.waitForTimeout(800);
await page.screenshot({ path: 'C:/tmp/10_pill_pm.png' });
console.log('Pill PM cliquée');

// Ouvrir le modal "Gérer les catégories"
await page.click('button:has-text("Gérer les catégories")');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'C:/tmp/11_modal_cats.png' });
console.log('Modal catégories ouvert');

// Scroll bas du modal pour voir le formulaire
await page.evaluate(() => {
  const modal = document.querySelector('[style*="overflow-y: auto"], [style*="overflowY"]');
  if (modal) modal.scrollTop = 9999;
});
await page.waitForTimeout(400);
await page.screenshot({ path: 'C:/tmp/12_modal_form.png' });

await br.close();
