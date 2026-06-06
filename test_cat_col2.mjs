import { chromium } from 'playwright';
const br = await chromium.launch({ headless: true });
const page = await br.newPage();
await page.setViewportSize({ width: 1500, height: 900 });

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

// Scroll vers le tableau pour le centrer dans la vue
await page.evaluate(() => {
  const t = document.querySelector('table');
  if (t) t.scrollIntoView({ block: 'start' });
});
await page.waitForTimeout(300);

// Clip sur la zone tableau : header + 6 premières lignes
const tableBox = await page.evaluate(() => {
  const t = document.querySelector('table');
  if (!t) return null;
  const r = t.getBoundingClientRect();
  return { x: Math.max(0, r.x - 10), y: Math.max(0, r.y - 5), width: Math.min(r.width + 20, 1480), height: 320 };
});

await page.screenshot({ path: 'C:/tmp/cat_header.png', clip: tableBox || undefined });
console.log('clip:', JSON.stringify(tableBox));
await br.close();
