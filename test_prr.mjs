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

// Tous les compteurs sidebar
const sidebarBtns = await page.$$eval('div[style*="210"] button, aside button', els =>
  els.map(e => e.textContent.trim()).filter(t => t.length > 2)
).catch(async () => {
  // fallback : lire tous les boutons de la sidebar
  return await page.$$eval('button', els =>
    els.map(e => e.textContent.trim()).filter(t => /\d+/.test(t) && t.length < 60)
  );
});
console.log('=== COMPTEURS SIDEBAR ===');
sidebarBtns.forEach(t => console.log(' ', t));

// Clic PRR
await page.click('button:has-text("PRR et Équipements")');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'C:/tmp/prr_tab.png' });

const count = await page.$eval('span:has-text("résultat")', el => el.textContent.trim()).catch(() => '?');
console.log('\nPRR résultats:', count);

const rows = await page.$$eval('tbody tr', trs => trs.slice(0,8).map(tr => {
  const cells = [...tr.querySelectorAll('td')];
  return (cells[0]?.textContent.trim()||'').padEnd(8) + ' | ' + (cells[1]?.textContent.trim()||'').slice(0,50);
}));
console.log('Premières lignes PRR:');
rows.forEach(r => console.log(' ', r));

await br.close();
