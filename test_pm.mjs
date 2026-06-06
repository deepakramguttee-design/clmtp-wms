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

// Clic sur PM dans la sidebar
await page.click('button:has-text("PM - Petit Matériel")');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'C:/tmp/pm_tab.png' });

// Compteur PM
const sidebarText = await page.$eval('button:has-text("PM - Petit Matériel")', el => el.textContent.trim());
console.log('Sidebar PM:', sidebarText);

// Nb résultats affiché
const count = await page.$eval('span:has-text("résultat")', el => el.textContent.trim()).catch(() => '?');
console.log('Résultats:', count);

// 5 premières lignes
const rows = await page.$$eval('tbody tr', trs => trs.slice(0,5).map(tr => {
  const cells = [...tr.querySelectorAll('td')];
  return cells[0]?.textContent.trim() + ' | ' + cells[1]?.textContent.trim().slice(0,40);
}));
rows.forEach(r => console.log(' ', r));

await br.close();
